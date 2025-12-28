
import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Effects, Edges, useTexture } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { AppMode, PictureItem } from '../types';
import { lerp } from '../utils';

// Fix for TypeScript not recognizing R3F elements in JSX.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      primitive: any;
      planeGeometry: any;
      boxGeometry: any;
      meshBasicMaterial: any;
      meshStandardMaterial: any;
      ambientLight: any;
      pointLight: any;
      spotLight: any;
      group: any;
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      primitive: any;
      planeGeometry: any;
      boxGeometry: any;
      meshBasicMaterial: any;
      meshStandardMaterial: any;
      ambientLight: any;
      pointLight: any;
      spotLight: any;
      group: any;
    }
  }
}

// --- Constants ---
const MIN_RADIUS = 9.0;
const ITEM_ARC_SPACING = 1.6; // Approx physical width including gap

interface Visuals3DProps {
  items: PictureItem[];
  mode: AppMode;
  scrollOffset: number;
  focusedId: string | null;
  frameScale: number;
  nebulaDensity: number;
  driftSpeed: number;
  browseSpacing: number;
  focusZoom: number;
  onFrameClick: () => void;
}

// Helper for Sphere Distribution (Fibonacci Lattice)
const getSpherePosition = (index: number, total: number, radius: number) => {
    const phi = Math.acos(1 - 2 * (index + 0.5) / total);
    const theta = Math.PI * (1 + 5 ** 0.5) * (index + 0.5);
    
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    
    return new THREE.Vector3(x, y, z);
};

const FrameMesh: React.FC<{
  item: PictureItem;
  index: number;
  total: number;
  mode: AppMode;
  scrollOffset: number;
  focusedId: string | null;
  frameScale: number;
  nebulaDensity: number;
  driftSpeed: number;
  browseSpacing: number;
  focusZoom: number;
}> = ({ item, index, total, mode, scrollOffset, focusedId, frameScale, nebulaDensity, driftSpeed, browseSpacing, focusZoom }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const isFocused = mode === AppMode.FOCUS && item.id === focusedId;

  // Smooth movement loop
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const tPos = new THREE.Vector3();
    const tRot = new THREE.Euler(0, 0, 0);
    let tScale = frameScale;
    
    const time = state.clock.elapsedTime;
    
    if (mode === AppMode.AGGREGATE) {
      // --- AGGREGATE "GEOMETRIC SPHERE" MODE (IDLE / DEFAULT) ---
      
      const sphereRadius = 4.5 * nebulaDensity;
      const basePos = getSpherePosition(index, total, sphereRadius);
      
      const rotSpeed = driftSpeed; 
      const angle = time * rotSpeed;
      
      const rotatedX = basePos.x * Math.cos(angle) - basePos.z * Math.sin(angle);
      const rotatedZ = basePos.x * Math.sin(angle) + basePos.z * Math.cos(angle);
      
      tPos.set(rotatedX, basePos.y, rotatedZ);
      
      tRot.set(0, -angle + Math.atan2(basePos.x, basePos.z), 0); 
      tRot.x += Math.sin(time + index) * 0.1;

      tScale = 0.8; 

    } else {
      // --- BROWSE / FOCUS MODE ---
      
      // Calculate dynamic radius to ensure frames form a complete circle (connected end-to-end)
      const circumference = Math.max(total * ITEM_ARC_SPACING, MIN_RADIUS * 2 * Math.PI);
      const radius = circumference / (2 * Math.PI);
      const centerZ = radius + 1.5; // Ensure the closest point is at a comfortable viewing distance (around Z=1.5)

      // Distribute evenly along the circle
      const angleStep = (Math.PI * 2) / total;
      
      // Position logic
      const theta = index * angleStep + scrollOffset;
      
      tPos.x = radius * Math.sin(theta);
      tPos.z = centerZ - radius * Math.cos(theta);
      tPos.y = Math.sin(index * 0.5 + time) * 0.2; 

      tRot.y = -theta; 

      // Hide frames that are behind the camera to prevent clutter
      if (tPos.z > centerZ + radius * 0.5) { 
         // tScale = 0.01; 
      }

      if (mode === AppMode.FOCUS && item.id === focusedId) {
            // Slightly bulge forward to Z=2.2 (Ring closest point is Z=1.5) and scale up
            tPos.set(0, 0, 2.2); 
            tRot.set(0, 0, 0); 
            tScale = frameScale * focusZoom; 
      }
    }

    // --- LERP TO TARGET ---
    let speed = 3.5;
    if (mode === AppMode.FOCUS) speed = 5;
    if (mode === AppMode.AGGREGATE) speed = 2.5;
    
    meshRef.current.position.lerp(tPos, delta * speed);
    
    const targetQuat = new THREE.Quaternion().setFromEuler(tRot);
    meshRef.current.quaternion.slerp(targetQuat, delta * speed);

    // Scale Logic
    let scaleX = 1;
    let scaleY = 1;
    if (item.aspectRatio > 1) {
      scaleY = 1 / item.aspectRatio;
    } else {
      scaleX = item.aspectRatio;
    }
    
    meshRef.current.scale.lerp(new THREE.Vector3(
      scaleX * tScale,
      scaleY * tScale,
      tScale
    ), delta * speed);

    // Video Playback Logic
    if (item.type === 'VIDEO' && item.videoElement) {
        if (isFocused && mode === AppMode.FOCUS) {
            if (item.videoElement.paused) {
                const playPromise = item.videoElement.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {});
                }
            }
        } else {
            if (!item.videoElement.paused) {
                item.videoElement.pause();
            }
        }
    }
  });

  // Material setup
  const material = useMemo(() => {
    if (item.type === 'EMPTY') {
        return new THREE.MeshBasicMaterial({ 
            color: 0x000000, 
            transparent: true, 
            opacity: 0.2, 
            side: THREE.DoubleSide
        });
    } else if (item.texture) {
        return new THREE.MeshBasicMaterial({ 
            map: item.texture,
            color: 0xffffff,
            side: THREE.DoubleSide,
            toneMapped: false 
        });
    }
    return new THREE.MeshBasicMaterial({ color: 0x111111 });
  }, [item.type, item.texture]);

  // Frame Border Color Logic
  const borderColor = useMemo(() => {
      if (isFocused) return new THREE.Color("#ffaa88").multiplyScalar(3); 
      if (item.type === 'EMPTY') return new THREE.Color("#ff4444").multiplyScalar(1.2); 
      return new THREE.Color("#aaaaaa").multiplyScalar(1.5); // Boost intensity for visibility against bloom threshold
  }, [isFocused, item.type]);

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 0.05]} />
      <primitive object={material} attach="material" />
      
      {/* Emissive Edges for Bloom */}
      <Edges 
        scale={1.0} 
        threshold={15} 
        color={borderColor} 
      />

      {/* Backside/Glow panel */}
      <mesh scale={[1.05, 1.05, 0.9]}>
        <planeGeometry />
        <meshBasicMaterial 
            color={isFocused ? "#ffffff" : "#000000"} 
            transparent 
            opacity={isFocused ? 0.1 : 0.5} 
            side={THREE.BackSide}
        />
      </mesh>
    </mesh>
  );
};

const SceneContent: React.FC<Visuals3DProps> = ({ items, mode, scrollOffset, focusedId, frameScale, nebulaDensity, driftSpeed, browseSpacing, focusZoom }) => {
  const { scene } = useThree();
  
  // AR Mode: Removed Fog and Background Color to allow video feed to show through
  useEffect(() => {
    scene.background = null; 
    scene.fog = null;
  }, [scene]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#ff8866" />
      <pointLight position={[-10, -5, -5]} intensity={1.0} color="#cc4444" />
      <spotLight position={[0, 0, 8]} angle={0.5} penumbra={1} intensity={2} color="#fff0ee" />

      {/* Stars and Sparkles removed for pure AR experience */}

      <group>
        {items.map((item, i) => {
          return (
            <FrameMesh 
              key={item.id} 
              index={i}
              total={items.length}
              item={item} 
              mode={mode} 
              scrollOffset={scrollOffset}
              focusedId={focusedId}
              frameScale={frameScale}
              nebulaDensity={nebulaDensity}
              driftSpeed={driftSpeed}
              browseSpacing={browseSpacing}
              focusZoom={focusZoom}
            />
          );
        })}
      </group>

      <EffectComposer enableNormalPass={false}>
        <Bloom 
            luminanceThreshold={1.1} 
            mipmapBlur 
            intensity={0.6} 
            radius={0.4}
        />
      </EffectComposer>
    </>
  );
};

export const Visuals3D: React.FC<Visuals3DProps> = (props) => {
  return (
    <Canvas 
        className="w-full h-full block" 
        camera={{ position: [0, 0, 5], fov: 50 }} 
        onClick={props.onFrameClick}
        dpr={[1, 2]} 
        gl={{ 
            antialias: true,
            alpha: true, // Enable transparency for AR background
            powerPreference: "high-performance",
            stencil: false,
            depth: true
        }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
};
