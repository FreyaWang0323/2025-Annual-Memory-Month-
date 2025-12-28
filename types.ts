
import * as THREE from 'three';

export enum AppMode {
  BROWSE = 'BROWSE',
  FOCUS = 'FOCUS',
  AGGREGATE = 'AGGREGATE',
}

export type MediaType = 'IMAGE' | 'VIDEO' | 'EMPTY';

export const MONTHS = ['ALL', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
export type Month = typeof MONTHS[number];

export interface PictureItem {
  id: string;
  type: MediaType;
  url?: string;
  month?: Month;
  aspectRatio: number; // width / height
  // Fix: Ensure THREE namespace is available for these types
  texture?: THREE.Texture | THREE.VideoTexture;
  videoElement?: HTMLVideoElement;
}

export interface HandGestureState {
  isHandPresent: boolean;
  isPinching: boolean;
  isOpenPalm: boolean;
  handX: number; // Normalized 0-1
  handY: number; // Normalized 0-1
}

export interface CursorState {
  x: number;
  y: number;
  active: boolean; // Is hand detected
  clicking: boolean; // Is pinching
  lastClickTime: number; // Timestamp for ripple animation
}

export interface AppSettings {
  slotCount: number;
  frameScale: number;
  nebulaDensity: number; // Controls Sphere Radius in Aggregate mode
  driftSpeed: number;    // Controls Rotation Speed in Aggregate mode
  browseSpacing: number; // Controls distance between frames in Browse mode
  focusZoom: number;     // Controls the scale multiplier when an item is focused
}

export interface VideoSettings {
  contrast: number;   // 0.5 - 2.0 (Default 1.0)
  saturation: number; // 0.0 - 2.0 (Default 1.0)
  brightness: number; // 0.5 - 1.5 (Default 1.0)
  blur: number;       // 0 - 10px (Default 0, simulating Sharpness)
  warmth: number;     // 0 - 1 (Sepia amount, simulating Temperature)
}
