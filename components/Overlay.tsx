
import React, { useState, useRef, useEffect } from 'react';
import { AppMode, AppSettings, CursorState, Month, MONTHS, VideoSettings } from '../types';
import { SoundManager } from '../utils';

interface OverlayProps {
  mode: AppMode;
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  videoSettings: VideoSettings;
  setVideoSettings: (v: VideoSettings) => void;
  onUploadMedia: (files: FileList) => void;
  onClearMedia: () => void;
  onUploadMusic: (file: File) => void;
  musicPlaying: boolean;
  toggleMusic: () => void;
  permissionError: boolean;
  needsInteraction: boolean;
  isLoading: boolean;
  cursor: CursorState;
  selectedMonth: Month;
  setSelectedMonth: (m: Month) => void;
}

export const Overlay: React.FC<OverlayProps> = ({
  mode,
  settings,
  setSettings,
  videoSettings,
  setVideoSettings,
  onUploadMedia,
  onClearMedia,
  onUploadMusic,
  musicPlaying,
  toggleMusic,
  permissionError,
  needsInteraction,
  isLoading,
  cursor,
  selectedMonth,
  setSelectedMonth
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [isMonthMenuOpen, setIsMonthMenuOpen] = useState(false);

  // Helper for mode display name
  const getModeLabel = () => {
      switch(mode) {
          case AppMode.BROWSE: return "BROWSE";
          case AppMode.FOCUS: return "FOCUS";
          case AppMode.AGGREGATE: return "SPHERE";
          default: return "";
      }
  };

  const getStatusColor = () => {
      switch(mode) {
          case AppMode.FOCUS: return 'bg-green-400 shadow-[0_0_8px_#4ade80]';
          case AppMode.BROWSE: return 'bg-blue-400 shadow-[0_0_8px_#60a5fa]';
          case AppMode.AGGREGATE: return 'bg-purple-400 shadow-[0_0_8px_#d8b4fe]';
          default: return 'bg-white/50';
      }
  };

  const handleMonthSelect = (m: Month) => {
      if (selectedMonth !== m) {
          SoundManager.play('switch');
          setSelectedMonth(m);
      }
      setIsMonthMenuOpen(false); // Close menu after selection
  };

  const toggleMonthMenu = () => {
      SoundManager.play('click');
      setIsMonthMenuOpen(!isMonthMenuOpen);
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex justify-between z-10 overflow-hidden p-6">
      
      {/* --- VIRTUAL CURSOR (RIGHT HAND) --- */}
      {cursor.active && (
        <div 
            className="fixed pointer-events-none z-[100] transition-transform duration-75 ease-out will-change-transform"
            style={{ 
                left: 0, 
                top: 0, 
                transform: `translate(${cursor.x}px, ${cursor.y}px)`
            }}
        >
            {/* Main Cursor Ring */}
            <div className={`
                w-10 h-10 -ml-5 -mt-5 rounded-full border-2 
                flex items-center justify-center
                ${cursor.clicking ? 'border-green-400 bg-green-400/20 scale-90' : 'border-white/80 bg-white/5 scale-100'}
                transition-all duration-150 shadow-[0_0_15px_rgba(255,255,255,0.3)]
            `}>
                <div className={`w-1.5 h-1.5 bg-white rounded-full ${cursor.clicking ? 'scale-125' : ''}`} />
            </div>

            {/* Ripple Effect on Click */}
            <div 
                key={cursor.lastClickTime} 
                className={`
                    absolute top-0 left-0 -ml-5 -mt-5 w-10 h-10 rounded-full border border-green-300
                    ${cursor.clicking ? 'animate-ping opacity-75' : 'opacity-0'}
                `}
            />

            {/* Label */}
            <div className="absolute left-6 top-1 text-[9px] text-white/70 font-mono tracking-wider whitespace-nowrap bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
                UI HAND
            </div>
        </div>
      )}


      {/* --- LEFT COLUMN: CONTROLS & INFO --- */}
      {/* Z-index increased to 50 to sit above backdrop (z-40). Pointer-events-none on container, auto on children. */}
      <div className="flex flex-col justify-between items-start h-full pointer-events-none z-50 w-auto">
        
        {/* 1. TOP TITLE */}
        <div className="select-none pl-1 pointer-events-auto">
            <div className="text-[10px] font-mono text-white/40 tracking-[0.4em] uppercase mb-1 ml-1">
                {selectedMonth === 'ALL' ? 'Annual Collection' : selectedMonth}
            </div>
            <h1 className="text-5xl font-serif italic font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-200 to-white/40 drop-shadow-lg leading-tight">
                Memory <span className="text-xl align-top text-white/30 font-light not-italic font-sans">2025</span>
            </h1>
        </div>

        {/* 2. MIDDLE MONTH SELECTOR */}
        <div className="relative group my-auto pointer-events-auto">
             {/* Trigger Capsule */}
            <button
                onClick={toggleMonthMenu}
                onMouseEnter={() => SoundManager.play('hover')}
                className={`
                    relative z-40 w-16 h-16 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/20 
                    flex flex-col items-center justify-center gap-0.5 shadow-[0_0_30px_rgba(0,0,0,0.3)] 
                    transition-all duration-300 hover:scale-105 hover:bg-white/10
                    ${isMonthMenuOpen ? 'border-white/40 bg-white/15' : ''}
                `}
            >
                <span className="text-[8px] text-white/50 font-mono">2025</span>
                <span className="text-sm font-bold text-white tracking-widest">{selectedMonth.substring(0, 3)}</span>
                
                {/* Chevron */}
                <svg 
                    className={`w-3 h-3 text-white/50 transition-transform duration-300 ${isMonthMenuOpen ? 'rotate-180' : 'rotate-0'}`} 
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
            </button>

            {/* Expandable Panel - Centered vertically relative to button */}
            <div 
                id="month-scroll-container"
                className={`
                    absolute left-full ml-4 top-1/2 -translate-y-1/2 
                    w-28 max-h-[85vh] overflow-y-auto scrollbar-hide
                    bg-black/60 backdrop-blur-2xl rounded-[1.2rem] border border-white/10 
                    flex flex-col gap-1.5 p-2 shadow-2xl origin-left z-30
                    transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]
                    ${isMonthMenuOpen ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-90 -translate-x-4 pointer-events-none'}
                `}
            >
                 <div className="text-[9px] text-white/40 font-mono text-center py-1.5 border-b border-white/10 mb-1">SELECT</div>
                 {MONTHS.map(m => {
                     const isSelected = selectedMonth === m;
                     return (
                        <button
                            key={m}
                            onClick={() => handleMonthSelect(m)}
                            onMouseEnter={() => SoundManager.play('hover')}
                            className={`
                                group relative w-full h-8 rounded-full flex items-center justify-between px-3 transition-all duration-200
                                ${isSelected ? 'bg-white text-black shadow-lg scale-100' : 'bg-white/5 text-white/60 hover:bg-white/20 hover:text-white hover:scale-105'}
                            `}
                        >
                            <span className="text-[9px] font-bold tracking-widest">{m.substring(0, 3)}</span>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                        </button>
                     );
                 })}
            </div>
        </div>

        {/* 3. BOTTOM SETTINGS & STATUS */}
        <div className="flex flex-col gap-4 items-start relative pl-1 pointer-events-auto">
            
            {/* Mode Indicator */}
             <div className="flex items-center gap-3 px-3 py-1.5 bg-white/5 backdrop-blur-md rounded-lg border border-white/5 text-white text-[10px] font-mono tracking-widest shadow-sm">
                <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor()} animate-pulse`}></span>
                {getModeLabel()}
            </div>

            <div className="flex gap-3">
                {/* Settings Toggle */}
                <div className="relative">
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        onMouseEnter={() => SoundManager.play('hover')}
                        className={`p-2.5 rounded-full border border-white/10 transition-all shadow-lg backdrop-blur-md flex items-center justify-center w-10 h-10 ${showSettings ? 'bg-white text-black scale-110' : 'bg-black/40 text-white hover:bg-white/20'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    </button>
                    
                    {/* Settings Panel */}
                    {showSettings && (
                        <div 
                            className="absolute bottom-full left-0 mb-4 bg-black/80 backdrop-blur-2xl border border-white/10 p-5 rounded-2xl text-white text-xs w-72 shadow-2xl animate-fade-in-up origin-bottom-left max-h-[80vh] overflow-y-auto z-50 cursor-auto" 
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            
                            {/* SCENE CONFIG */}
                            <div className="font-bold text-white/90 uppercase tracking-widest border-b border-white/10 pb-2 mb-4">Scene Config</div>
                            {['Count', 'Frame Scale', 'Sphere Radius', 'Sphere Speed'].map((label, i) => {
                                const keys: (keyof AppSettings)[] = ['slotCount', 'frameScale', 'nebulaDensity', 'driftSpeed'];
                                const mins = [5, 0.5, 0.1, 0.0];
                                const maxs = [50, 3.0, 3.0, 2.0];
                                const steps = [1, 0.1, 0.1, 0.1];
                                const key = keys[i];
                                return (
                                    <div key={key} className="mb-5">
                                        <label className="flex justify-between text-gray-400 mb-2 font-mono">
                                            <span>{label}</span> <span className="text-white">{settings[key]}</span>
                                        </label>
                                        <input 
                                            type="range" min={mins[i]} max={maxs[i]} step={steps[i]} value={settings[key]} 
                                            onChange={(e) => setSettings({...settings, [key]: Number(e.target.value)})}
                                            onMouseEnter={() => SoundManager.play('hover')}
                                            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:accent-green-300 transition-colors"
                                        />
                                    </div>
                                )
                            })}

                            {/* CAMERA FILTERS */}
                            <div className="font-bold text-white/90 uppercase tracking-widest border-b border-white/10 pb-2 mb-4 mt-2">Camera Style</div>
                            {[
                                { label: 'Contrast', key: 'contrast', min: 0.5, max: 2.0, step: 0.1 },
                                { label: 'Saturation', key: 'saturation', min: 0.0, max: 2.0, step: 0.1 },
                                { label: 'Brightness', key: 'brightness', min: 0.5, max: 1.5, step: 0.05 },
                                { label: 'Warmth', key: 'warmth', min: 0, max: 1, step: 0.05 },
                                { label: 'Softness', key: 'blur', min: 0, max: 10, step: 1 }
                            ].map((item) => (
                                <div key={item.key} className="mb-5 last:mb-0">
                                    <label className="flex justify-between text-gray-400 mb-2 font-mono">
                                        <span>{item.label}</span> <span className="text-white">{videoSettings[item.key as keyof VideoSettings]}</span>
                                    </label>
                                    <input 
                                        type="range" min={item.min} max={item.max} step={item.step} 
                                        value={videoSettings[item.key as keyof VideoSettings]} 
                                        onChange={(e) => setVideoSettings({...videoSettings, [item.key]: Number(e.target.value)})}
                                        onMouseEnter={() => SoundManager.play('hover')}
                                        className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:accent-orange-300 transition-colors"
                                    />
                                </div>
                            ))}

                        </div>
                    )}
                </div>

                <div className="relative">
                    <button 
                        onClick={() => setShowTips(!showTips)} 
                        onMouseEnter={() => SoundManager.play('hover')}
                        className="flex items-center justify-center w-10 h-10 bg-black/40 hover:bg-white/10 backdrop-blur-md rounded-full border border-white/10 transition-all text-white shadow-lg"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>
                    {/* Tips Panel */}
                    <div className={`
                        overflow-hidden transition-all duration-300 ease-in-out bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl origin-bottom-left absolute bottom-full left-0 mb-4 w-64
                        ${showTips ? 'max-h-96 opacity-100 p-5' : 'max-h-0 opacity-0 p-0 border-0'}
                    `}>
                        <div className="text-xs text-white/70 space-y-3">
                            <div className="font-bold text-white/90 uppercase tracking-widest border-b border-white/10 pb-2 mb-2">Controls</div>
                            <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                                <div className="col-span-2 text-orange-300 font-bold text-[10px]">LEFT HAND (SCENE)</div>
                                <span>Open Palm</span> <span className="text-blue-300 text-right">Browse</span>
                                <span>Pinch</span> <span className="text-green-300 text-right">Focus</span>
                                
                                <div className="col-span-2 text-green-300 font-bold text-[10px] mt-2">RIGHT HAND (UI)</div>
                                <span>Index</span> <span className="text-white text-right">Cursor</span>
                                <span>Pinch</span> <span className="text-white text-right">Click & Drag</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>

      </div>

      {/* --- RIGHT COLUMN: ACTIONS --- */}
      {/* Z-index increased to 50 to sit above backdrop. Pointer-events-none on container, auto on children. */}
      <div className="flex flex-col justify-between items-end h-full pointer-events-none z-50">
        
        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pointer-events-auto">
            <div className="flex gap-2 p-1.5 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-lg">
                {/* Upload */}
                <label 
                    onMouseEnter={() => SoundManager.play('hover')}
                    className="group relative cursor-pointer p-3 rounded-lg bg-white/5 hover:bg-white/20 transition-all border border-white/5 hover:border-white/30 text-white w-10 h-10 flex items-center justify-center"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                    <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => e.target.files && onUploadMedia(e.target.files)}/>
                    <span className="absolute right-full mr-3 bg-black/80 px-2 py-1 text-[9px] rounded text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10">Upload Media</span>
                </label>

                {/* Clear */}
                <button 
                    onClick={onClearMedia} 
                    onMouseEnter={() => SoundManager.play('hover')}
                    className="group relative p-3 rounded-lg bg-white/5 hover:bg-red-500/20 transition-all border border-white/5 hover:border-red-500/30 text-white hover:text-red-200 w-10 h-10 flex items-center justify-center"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>

            <div className="flex gap-2 p-1.5 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-lg">
                {/* Music */}
                <label 
                    onMouseEnter={() => SoundManager.play('hover')}
                    className="group relative cursor-pointer p-3 rounded-lg bg-white/5 hover:bg-blue-500/20 transition-all border border-white/5 hover:border-blue-400/30 text-blue-100 w-10 h-10 flex items-center justify-center"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
                    <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files && onUploadMusic(e.target.files[0])}/>
                    <span className="absolute right-full mr-3 bg-black/80 px-2 py-1 text-[9px] rounded text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10">BGM</span>
                </label>

                {/* Play/Pause */}
                <button 
                    onClick={toggleMusic} 
                    onMouseEnter={() => SoundManager.play('hover')}
                    className={`group relative p-3 rounded-lg transition-all border border-white/5 w-10 h-10 flex items-center justify-center ${musicPlaying ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-white/5 text-white hover:bg-white/20'}`}
                >
                        {musicPlaying ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                        ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path></svg>
                        )}
                </button>
            </div>
        </div>

        {/* Status Info */}
        <div className={`px-4 py-2 bg-black/20 backdrop-blur-md rounded-full border border-white/5 text-[9px] text-white/40 font-mono tracking-widest uppercase pointer-events-auto ${permissionError ? 'text-red-400 border-red-500/50' : ''}`}>
            {permissionError ? "CAMERA ACCESS ERROR" : "STEREO VISION • ACTIVE"}
        </div>

      </div>

      {/* MIDDLE PROMPT */}
      {needsInteraction && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-2xl p-10 rounded-2xl border border-white/10 text-center shadow-[0_0_80px_rgba(0,0,0,0.8)]">
            {isLoading ? (
                <div className="flex flex-col items-center animate-pulse">
                    <div className="text-2xl text-white font-serif italic tracking-widest mb-2">System Initializing</div>
                    <div className="text-xs text-white/50 font-mono">LOADING VISION MODELS...</div>
                </div>
            ) : (
                <div className="flex flex-col items-center animate-pulse">
                    <h2 className="text-4xl text-white font-serif italic mb-4 tracking-widest drop-shadow-lg">Start Experience</h2>
                    <div className="text-xs text-white/60 font-mono tracking-[0.2em] uppercase bg-white/10 px-4 py-2 rounded">Click to Enter</div>
                </div>
            )}
        </div>
        </div>
      )}

      {/* SETTINGS BACKDROP */}
      {/* Z-index 40. Sits below the UI columns (z-50) but covers the 3D scene. */}
      {showSettings && <div className="fixed inset-0 bg-transparent z-40 pointer-events-auto" onClick={() => setShowSettings(false)} />}
      
      <style>{`
        .animate-fade-in-up { animation: fadeInUp 0.3s ease-out forwards; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};
