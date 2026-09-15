/**
 * Viewer: WebGL renderer plus direct-manipulation rotation.
 *
 * The medal behaves like an ordinary 3D object: drag it and it turns to follow
 * your hand, horizontally and vertically, and stays where you leave it. No
 * auto-spin, no momentum, no tap-to-flip.
 *
 * Framework-agnostic on purpose. Give it a container and a PinAnalysis; it owns
 * the loop. React / React Native hosts wrap this or consume `createMedallion`.
 */
import * as THREE from "three";
import type { PinAnalysis } from "./analyze.js";
import { type Medallion, type MedallionOptions } from "./medallion.js";
export type ViewerOptions = MedallionOptions & {
    /** How far the object tips up/down, in radians (default 80°). */
    maxTilt?: number;
    /** Radians of rotation per pixel dragged. */
    radiansPerPixel?: number;
    /** Resting pose: a slight turn so the metal catches light before the first
     * drag (default yaw 14°, pitch 6°). Zero both for a flat head-on rest. */
    initialPose?: {
        yaw?: number;
        pitch?: number;
    };
    /** Slow turntable rotation, radians per second (default 0.35 — a lap in
     * ~18s). Pauses while dragging and resumes from where the drag left it.
     * 0 disables. */
    idleSpin?: number;
};
export type Viewer = {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    medallion: Medallion;
    /** Swap the artwork without rebuilding the renderer. */
    setAnalysis(analysis: PinAnalysis): void;
    /** Put the object back to face-on. */
    reset(): void;
    dispose(): void;
};
export declare function createViewer(container: HTMLElement, analysis: PinAnalysis, options?: ViewerOptions): Viewer;
//# sourceMappingURL=viewer.d.ts.map