
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { Visuals3D } from './components/Visuals3D';
import { Overlay } from './components/Overlay';
import { VisionManager, EMA, distance3D, clamp, lerp, SoundManager } from './utils'; // SoundManager
import { AppMode, AppSettings, PictureItem, Month, CursorState, VideoSettings } from './types';
import { NormalizedLandmark } from "@mediapipe/tasks-vision";

// --- CONSTANTS FOR INTERACTION TUNING ---
const PINCH_THRESHOLD_ON = 0.04;  // Distance to trigger click
const PINCH_THRESHOLD_OFF = 0.055; // Distance to release click (Hysteresis)
const CURSOR_SMOOTHING = 0.5;    // Increased from 0.25 for higher sensitivity
const ANCHOR_STRENGTH = 0.95;     // 95% Anchor, 5% Realtime during pinch (prevents jump)

// Initial slot count
const INITIAL_SLOTS = 20;

export default function App() {
  // --- State ---
  const [mode, setMode] = useState<AppMode>(AppMode.AGGREGATE);
  const [settings, setSettings] = useState<AppSettings>({ 
    slotCount: INITIAL_SLOTS, 
    frameScale: 1.8, 
    nebulaDensity: 1.0, 
    driftSpeed: 0.2,    
    browseSpacing: 0.22, 
    focusZoom: 1.3       
  });
  
  // Camera Filter Settings
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    contrast: 1.1,
    saturation: 1.2,
    brightness: 1.0,
    blur: 0,
    warmth: 0
  });

  const [items, setItems] = useState<PictureItem[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Month>('ALL');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(true);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Cursor State
  const [cursor, setCursor] = useState<CursorState>({ 
      x: 0, y: 0, active: false, clicking: false, lastClickTime: 0 
  });

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const requestRef = useRef<number | null>(null);
  const lastLeftHandTime = useRef<number>(0);
  
  // Left Hand Smoothing
  const leftHandX_EMA = useRef(new EMA(0.1)); 
  const leftPinchSmoother = useRef(new EMA(0.2));
  const leftOpenPalmSmoother = useRef(new EMA(0.2));

  // Right Hand Logic Refs
  const cursorX_EMA = useRef(new EMA(CURSOR_SMOOTHING)); 
  const cursorY_EMA = useRef(new EMA(CURSOR_SMOOTHING));
  const isPinchingRef = useRef(false); // Track pinch state for edge detection
  const anchorPos = useRef<{x: number, y: number} | null>(null); // Anchor for click stability
  const lastCursorPos = useRef<{x: number, y: number}>({ x: 0, y: 0 }); // Track delta for scrolling
  
  // Event Simulation Refs
  const isDraggingUI = useRef(false);
  const dragTarget = useRef<Element | null>(null);
  const lastHoveredElement = useRef<Element | null>(null);

  // --- Filtering Logic ---
  const filteredItems = useMemo(() => {
    if (selectedMonth === 'ALL') return items;
    return items.map(item => {
        if (item.type === 'EMPTY') return item;
        if (item.month && item.month !== selectedMonth) {
            return { ...item, type: 'EMPTY' as const, texture: undefined };
        }
        return item;
    });
  }, [items, selectedMonth]);

  // --- Initialization ---
  useEffect(() => {
    const newItems: PictureItem[] = [];
    for (let i = 0; i < settings.slotCount; i++) {
        if (items[i]) {
            newItems.push(items[i]);
        } else {
            newItems.push({
                id: `slot-${Date.now()}-${i}`,
                type: 'EMPTY',
                aspectRatio: 1.0,
                month: 'ALL'
            });
        }
    }
    if (newItems.length > settings.slotCount) {
        newItems.length = settings.slotCount;
    }
    setItems(newItems);
  }, [settings.slotCount]);

  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      videoRef.current.srcObject = stream;
      videoRef.current.addEventListener("loadeddata", predictWebcam);
    } catch (e) {
      console.error("Camera denied:", e);
      setPermissionError(true);
    }
  };

  useEffect(() => {
    const initVision = async () => {
      try {
        const vm = VisionManager.getInstance();
        await vm.initialize();
        await startCamera();
        setIsLoading(false);
      } catch (e) {
        console.error("Vision init failed:", e);
        setPermissionError(true);
        setIsLoading(false);
      }
    };
    initVision();
  }, []);

  // --- Audio Ducking Logic ---
  useEffect(() => {
      if (!audioRef.current) return;
      
      const focusedItem = items.find(i => i.id === focusedId);
      const isVideoFocused = mode === AppMode.FOCUS && focusedItem?.type === 'VIDEO';
      
      // Sound Effect for Focus
      if (mode === AppMode.FOCUS) {
          SoundManager.play('focus');
      }

      if (isVideoFocused) {
          audioRef.current.volume = 0.3; // Duck BGM
      } else {
          audioRef.current.volume = 1.0; // Restore BGM
      }
  }, [mode, focusedId, items]);


  // --- Gesture Loop ---

  const predictWebcam = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const vm = VisionManager.getInstance();

    if (!video || !canvas || !vm.handLandmarker) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const startTimeMs = performance.now();
    let results;
    try {
        if (video.currentTime > 0) {
            results = vm.handLandmarker.detectForVideo(video, startTimeMs);
        }
    } catch (e) { console.warn(e) }

    // Clear canvas (processing happens hidden)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (results && results.landmarks.length > 0) {
        let leftHandFound = false;
        let rightHandFound = false;

        for (let i = 0; i < results.landmarks.length; i++) {
            const landmarks = results.landmarks[i];
            const handedness = results.handedness[i][0].categoryName; 
            
            if (handedness === "Left") {
                leftHandFound = true;
                processLeftHand(landmarks);
            } else if (handedness === "Right") {
                rightHandFound = true;
                processRightHand(landmarks);
            }
        }

        if (leftHandFound) {
            lastLeftHandTime.current = Date.now();
        }

        if (!leftHandFound && Date.now() - lastLeftHandTime.current > 500) {
             setMode(prev => prev !== AppMode.AGGREGATE ? AppMode.AGGREGATE : prev);
        }

        if (!rightHandFound) {
            setCursor(prev => ({ ...prev, active: false, clicking: false }));
            resetDrag();
        }

    } else {
         if (Date.now() - lastLeftHandTime.current > 500) { 
            setMode(prev => prev !== AppMode.AGGREGATE ? AppMode.AGGREGATE : prev);
        }
        setCursor(prev => ({ ...prev, active: false }));
        resetDrag();
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  }, []); // Logic is mostly self-contained or uses refs

  const resetDrag = () => {
      if (isDraggingUI.current && dragTarget.current) {
        const evt = new PointerEvent('pointerup', { bubbles: true, cancelable: true });
        dragTarget.current.dispatchEvent(evt);
        isDraggingUI.current = false;
        dragTarget.current = null;
      }
  };

  // --- LEFT HAND: SCENE CONTROL ---
  const processLeftHand = (landmarks: NormalizedLandmark[]) => {
      if (isDraggingUI.current) return;

      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const middleMCP = landmarks[9];

      const pinchDist = distance3D(thumbTip, indexTip);
      const isPinchingRaw = pinchDist < 0.05 ? 1 : 0; 
      const pinchVal = leftPinchSmoother.current.update(isPinchingRaw);
      const isPinchActive = pinchVal > 0.6;

      const wrist = landmarks[0];
      const tips = [8, 12, 16, 20];
      const pips = [6, 10, 14, 18];
      let extendedCount = 0;
      for(let i=0; i<tips.length; i++) {
          const dTip = distance3D(wrist, landmarks[tips[i]]);
          const dPip = distance3D(wrist, landmarks[pips[i]]);
          if (dTip > dPip * 1.1) extendedCount++;
      }
      const isOpenRaw = extendedCount >= 3 ? 1 : 0;
      const openVal = leftOpenPalmSmoother.current.update(isOpenRaw);
      const isOpenActive = openVal > 0.6;

      setMode((currentMode) => {
          if (isPinchActive) return AppMode.FOCUS;
          if (currentMode === AppMode.FOCUS && pinchVal < 0.4) {
               return isOpenActive ? AppMode.BROWSE : AppMode.AGGREGATE;
          }
          if (isOpenActive) return AppMode.BROWSE;
          return AppMode.AGGREGATE;
      });

      const screenX = 1 - middleMCP.x;
      const smoothedX = leftHandX_EMA.current.update(screenX);
      
      setMode(currentMode => {
          if (currentMode === AppMode.BROWSE) {
              const delta = smoothedX - 0.5;
              setScrollOffset(prev => prev + delta * 0.15); 
          }
          return currentMode;
      });
  };

  // --- RIGHT HAND: UI CONTROL (CURSOR) ---
  const processRightHand = (landmarks: NormalizedLandmark[]) => {
      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];
      
      // 1. Smoothing (EMA)
      const rawX = (1 - indexTip.x) * window.innerWidth;
      const rawY = indexTip.y * window.innerHeight;
      const smoothX = cursorX_EMA.current.update(rawX);
      const smoothY = cursorY_EMA.current.update(rawY);

      // 2. Pinch Detection with Hysteresis
      const pinchDist = distance3D(thumbTip, indexTip);
      const wasPinching = isPinchingRef.current;
      let isPinchingNow = wasPinching;

      if (pinchDist < PINCH_THRESHOLD_ON) {
          isPinchingNow = true;
      } else if (pinchDist > PINCH_THRESHOLD_OFF) {
          isPinchingNow = false;
      }
      
      isPinchingRef.current = isPinchingNow;

      // 3. Anchor Logic (Stability)
      let outputX = smoothX;
      let outputY = smoothY;

      // Rising Edge: Just started pinching -> Set Anchor
      if (isPinchingNow && !wasPinching) {
          anchorPos.current = { x: smoothX, y: smoothY };
          SoundManager.play('click'); // Play sound on click
      }
      
      // If pinching, prefer the Anchor position to prevent jump
      if (isPinchingNow && anchorPos.current) {
          // Weighted average: mostly anchor, slight drift allowed
          outputX = lerp(anchorPos.current.x, smoothX, 1 - ANCHOR_STRENGTH);
          outputY = lerp(anchorPos.current.y, smoothY, 1 - ANCHOR_STRENGTH);
      } else {
          // Release Edge: Clear anchor
          if (!isPinchingNow && wasPinching) {
              anchorPos.current = null;
          }
      }

      // Calculate movement delta for scrolling
      const deltaY = outputY - lastCursorPos.current.y;
      lastCursorPos.current = { x: outputX, y: outputY };

      // Update Cursor State
      setCursor(prev => ({
          x: outputX,
          y: outputY,
          active: true,
          clicking: isPinchingNow,
          lastClickTime: (isPinchingNow && !wasPinching) ? Date.now() : prev.lastClickTime
      }));

      // 4. Dispatch Events
      handleCursorInteraction(outputX, outputY, deltaY, isPinchingNow, wasPinching);
  };

  const handleCursorInteraction = (x: number, y: number, deltaY: number, isDown: boolean, wasDown: boolean) => {
      // Find element (ignoring cursor itself which should be pointer-events: none)
      const element = document.elementFromPoint(x, y);

      // --- Hover Simulation ---
      if (element !== lastHoveredElement.current) {
          // Leave old
          if (lastHoveredElement.current) {
             lastHoveredElement.current.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
             lastHoveredElement.current.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
          }
          // Enter new
          if (element) {
             element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
             element.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
          }
          lastHoveredElement.current = element;
      }
      // Move (Trigger :hover styles in some envs)
      if (element) {
          element.dispatchEvent(new PointerEvent('pointermove', { 
              bubbles: true, cancelable: true, clientX: x, clientY: y 
          }));
      }

      // --- Click / Drag Logic ---
      
      // RISING EDGE (Click Start)
      if (isDown && !wasDown) {
          if (element) {
              isDraggingUI.current = true;
              dragTarget.current = element;
              
              // Simulate full press sequence
              element.dispatchEvent(new PointerEvent('pointerdown', {
                  bubbles: true, cancelable: true, clientX: x, clientY: y, isPrimary: true
              }));
              element.dispatchEvent(new MouseEvent('mousedown', {
                  bubbles: true, cancelable: true, clientX: x, clientY: y
              }));
          }
      } 
      // HOLDING (Dragging)
      else if (isDown && wasDown && isDraggingUI.current && dragTarget.current) {
          // Scroll Logic for Sidebar
          const scrollContainer = document.getElementById('month-scroll-container');
          if (scrollContainer && (scrollContainer === dragTarget.current || scrollContainer.contains(dragTarget.current))) {
               // Inverse scroll: Drag up -> Scroll down
               scrollContainer.scrollTop -= deltaY;
          }

          // Drag events go to the original target (capture behavior)
          dragTarget.current.dispatchEvent(new PointerEvent('pointermove', {
              bubbles: true, cancelable: true, clientX: x, clientY: y, isPrimary: true
          }));
      }
      // FALLING EDGE (Click Release)
      else if (!isDown && wasDown && isDraggingUI.current && dragTarget.current) {
          // Release
          dragTarget.current.dispatchEvent(new PointerEvent('pointerup', {
              bubbles: true, cancelable: true, clientX: x, clientY: y, isPrimary: true
          }));
          dragTarget.current.dispatchEvent(new MouseEvent('mouseup', {
              bubbles: true, cancelable: true, clientX: x, clientY: y
          }));
          // Click!
          dragTarget.current.dispatchEvent(new MouseEvent('click', {
              bubbles: true, cancelable: true, clientX: x, clientY: y
          }));

          isDraggingUI.current = false;
          dragTarget.current = null;
      }
  };

  // --- Logic Hooks ---
  useEffect(() => {
    if (filteredItems.length === 0) {
        setFocusedId(null);
        return;
    }
    const angleStep = (Math.PI * 2) / filteredItems.length;
    const rawIndex = Math.round(-scrollOffset / angleStep);
    const len = filteredItems.length;
    const wrappedIndex = ((rawIndex % len) + len) % len;
    
    if (filteredItems[wrappedIndex]) {
        setFocusedId(filteredItems[wrappedIndex].id);
    }
  }, [scrollOffset, filteredItems]);

  // --- Media Handlers ---
  const handleMediaUpload = (files: FileList) => {
    setNeedsInteraction(false);
    SoundManager.play('success'); // Play sound
    const newFiles = Array.from(files);
    
    setItems(prevItems => {
        const nextItems = [...prevItems];
        let fileIdx = 0;
        for (let i = 0; i < nextItems.length && fileIdx < newFiles.length; i++) {
            if (nextItems[i].type === 'EMPTY') {
                const file = newFiles[fileIdx];
                const url = URL.createObjectURL(file);
                const isVideo = file.type.startsWith('video');
                const type: 'IMAGE' | 'VIDEO' = isVideo ? 'VIDEO' : 'IMAGE';
                
                nextItems[i] = {
                    ...nextItems[i],
                    type: type,
                    url: url,
                    aspectRatio: 1,
                    month: selectedMonth 
                };

                if (type === 'IMAGE') {
                    const img = new Image();
                    img.src = url;
                    const id = nextItems[i].id;
                    img.onload = () => {
                        const texture = new THREE.Texture(img);
                        texture.needsUpdate = true;
                        texture.colorSpace = THREE.SRGBColorSpace;
                        setItems(current => current.map(item => item.id === id ? { ...item, texture, aspectRatio: img.width / img.height } : item));
                    };
                } else {
                    const videoEl = document.createElement('video');
                    videoEl.src = url;
                    videoEl.muted = false; // Unmuted by default for playback
                    videoEl.loop = true;
                    videoEl.playsInline = true;
                    videoEl.crossOrigin = "anonymous";
                    const id = nextItems[i].id;
                    videoEl.onloadedmetadata = () => {
                        const texture = new THREE.VideoTexture(videoEl);
                        texture.colorSpace = THREE.SRGBColorSpace;
                        setItems(current => current.map(item => item.id === id ? { ...item, texture, videoElement: videoEl, aspectRatio: videoEl.videoWidth / videoEl.videoHeight } : item));
                    }
                }
                fileIdx++;
            }
        }
        return nextItems;
    });
  };

  const handleClearMedia = () => {
      setItems(prev => prev.map(item => ({ ...item, type: 'EMPTY', url: undefined, texture: undefined, videoElement: undefined, aspectRatio: 1.0, month: 'ALL' })));
  };

  const handleMusicUpload = (file: File) => {
    setNeedsInteraction(false);
    SoundManager.play('success');
    const url = URL.createObjectURL(file);
    audioRef.current.src = url;
    audioRef.current.loop = true;
    audioRef.current.play().then(() => setMusicPlaying(true)).catch(() => setMusicPlaying(false));
  };

  const toggleMusic = () => {
    setNeedsInteraction(false);
    if (audioRef.current.paused) {
        audioRef.current.play().then(() => setMusicPlaying(true));
    } else {
        audioRef.current.pause();
        setMusicPlaying(false);
    }
  };

  const handleGlobalClick = () => {
    SoundManager.init(); // Initialize audio context
    setNeedsInteraction(false);
    if (musicPlaying && audioRef.current.paused) {
        audioRef.current.play();
    }
  };

  return (
    <div className="relative w-full h-full" onClick={handleGlobalClick}>
      
      {/* Background Camera Feed */}
      <video 
        ref={videoRef} 
        className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 z-0 transition-[filter] duration-200" 
        style={{
            filter: `
                contrast(${videoSettings.contrast}) 
                saturate(${videoSettings.saturation}) 
                brightness(${videoSettings.brightness}) 
                blur(${videoSettings.blur}px)
                sepia(${videoSettings.warmth})
            `
        }}
        autoPlay 
        playsInline 
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* 3D Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <div className="w-full h-full pointer-events-auto">
            <Visuals3D 
                items={filteredItems}
                mode={mode}
                scrollOffset={scrollOffset}
                focusedId={focusedId}
                frameScale={settings.frameScale}
                nebulaDensity={settings.nebulaDensity}
                driftSpeed={settings.driftSpeed}
                browseSpacing={settings.browseSpacing}
                focusZoom={settings.focusZoom}
                onFrameClick={handleGlobalClick}
            />
        </div>
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-20 pointer-events-none ui-layer">
          <Overlay 
            mode={mode}
            settings={settings}
            setSettings={setSettings}
            videoSettings={videoSettings}
            setVideoSettings={setVideoSettings}
            onUploadMedia={handleMediaUpload}
            onClearMedia={handleClearMedia}
            onUploadMusic={handleMusicUpload}
            musicPlaying={musicPlaying}
            toggleMusic={toggleMusic}
            permissionError={permissionError}
            needsInteraction={needsInteraction}
            isLoading={isLoading}
            cursor={cursor}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
          />
      </div>
    </div>
  );
}
