// Shared contract between engine, UI, filters and preload. Frozen after Phase 1.

export type Category =
  | 'featured' | 'face' | 'eyes' | 'hands' | 'body' | 'background' | 'color' | 'retro' | 'art';
export type Need = 'face' | 'hands' | 'gestures' | 'pose' | 'segment';
export type Cost = 'light' | 'medium' | 'heavy';

export type Param =
  | { type: 'range'; label: string; min: number; max: number; step?: number; default: number }
  | { type: 'color'; label: string; default: string }
  | { type: 'select'; label: string; options: string[]; default: string }
  | { type: 'toggle'; label: string; default: boolean };
export type ParamValues = Record<string, number | string | boolean>;

// Landmarks are normalised 0..1 in UN-mirrored frame space (x right, y down).
export interface Pt { x: number; y: number; z: number }
export interface FaceResult { faces: Pt[][]; blendshapes: Record<string, number>[] } // 478 pts/face
export interface HandsResult { hands: Pt[][]; handedness: ('Left' | 'Right')[]; gestures: string[] } // 21 pts/hand
export interface PoseResult { poses: Pt[][] } // 33 pts/pose

export interface Frame {
  input: WebGLTexture;
  output: WebGLFramebuffer | null; // null = default framebuffer
  width: number; height: number;
  time: number; dt: number;         // seconds
  face?: FaceResult; hands?: HandsResult; pose?: PoseResult;
  mask?: WebGLTexture;              // person mask, R channel 0..1
}

export interface FilterInstance {
  render(f: Frame, params: ParamValues): void;
  dispose(): void;
}

export interface FilterDef {
  id: string; name: string; category: Exclude<Category, 'featured'>;
  icon: string;                      // emoji
  cost: Cost; needs: Need[];
  hint: string;                      // one line for tooltip/tutorial
  params: Record<string, Param>;
  create(gl: WebGL2RenderingContext): FilterInstance;
}

export interface Layer { uid: string; filterId: string; enabled: boolean; params: ParamValues }
export interface Preset { id: string; name: string; icon: string; layers: Omit<Layer, 'uid'>[] }

export interface EngineStats { fps: number; trackMs: number; renderMs: number }
export interface EngineApi {
  start(canvas: HTMLCanvasElement, deviceId?: string): Promise<void>;
  stop(): void;
  setLayers(layers: Layer[]): void;
  listCameras(): Promise<MediaDeviceInfo[]>;
  snapshot(): Promise<Blob>;
  onStats(cb: (s: EngineStats) => void): () => void;
  onFrame(cb: (bgr: Uint8Array, w: number, h: number) => void): () => void; // for vcam
  onError(cb: (e: Error) => void): () => void;
}

export interface VcamApi {
  available(): boolean;              // DLL loaded + registered
  start(width: number, height: number, fps: number): boolean;
  send(bgr: Uint8Array): void;       // width*height*3 bytes, top-down rows
  stop(): void;
}

export interface Settings {
  cameraId: string | null;
  width: number; height: number; fps: number;     // default 1280x720@30
  lastLayers: Omit<Layer, 'uid'>[];
  tutorialDone: boolean;
  closeToTray: boolean;                           // default true
  hotkeys: { next: string; prev: string };        // 'Control+Alt+Right' / 'Control+Alt+Left'
}

// Commands the main process (tray menu, global hotkeys) sends to the UI.
export type Command = { type: 'preset'; id: string } | { type: 'camera' }; // preset id may be 'next' | 'prev'
export interface PresetInfo { id: string; name: string; icon: string }

export interface CamtoysApi {
  settings: { get(): Promise<Settings>; set(patch: Partial<Settings>): Promise<Settings> };
  vcam: VcamApi;
  quit(): void;
  // Added in Phase 6 (additive):
  saveSnapshot(png: Uint8Array): Promise<string>;   // returns the saved file path
  setPresets(list: PresetInfo[]): void;             // feeds the tray Presets submenu
  onCommand(cb: (c: Command) => void): () => void;
}
