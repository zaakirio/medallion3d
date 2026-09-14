/**
 * Viewer: WebGL renderer + momentum spin + pointer tilt.
 *
 * Framework-agnostic on purpose. Give it a container and a PinAnalysis; it owns
 * the loop. React / React Native hosts wrap this or consume `createMedallion`
 * directly with their own renderer.
 */
import * as THREE from "three";
import type { PinAnalysis } from "./analyze.js";
import { type Medallion, type MedallionOptions } from "./medallion.js";
export type ViewerOptions = MedallionOptions & {
    /** Idle spin, radians/second. */
    autoSpin?: number;
    /** How quickly a flick decays, per second. */
    damping?: number;
    /** Flip the coin 180° on tap. */
    flipOnTap?: boolean;
};
export type Viewer = {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    medallion: Medallion;
    /** Swap the artwork without rebuilding the renderer. */
    setAnalysis(analysis: PinAnalysis): void;
    /** Nudge it, e.g. from a haptic tap. */
    spin(radiansPerSecond: number): void;
    dispose(): void;
};
export declare function createViewer(container: HTMLElement, analysis: PinAnalysis, options?: ViewerOptions): Viewer;
//# sourceMappingURL=viewer.d.ts.map