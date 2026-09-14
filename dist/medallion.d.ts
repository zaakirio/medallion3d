/**
 * Medallion builder: PinAnalysis → a THREE.Group coin.
 *
 * The body is the pin's own silhouette extruded with a bevel; the face is the
 * same silhouette carrying the artwork plus a derived normal map, so the gold
 * outline reads as raised metal and the enamel sits in shallow inlay.
 */
import * as THREE from "three";
import type { PinAnalysis } from "./analyze.js";
export type MedallionOptions = {
    /** Longest edge of the coin, in world units. */
    size?: number;
    /** Coin thickness. */
    thickness?: number;
    /** Bevel width; drives how much the rim catches the light. */
    bevel?: number;
    goldColor?: THREE.ColorRepresentation;
    /** Normal-map strength for the embossed artwork. */
    relief?: number;
    envMap?: THREE.Texture | null;
    /** Trace the pin outline (true) or fall back to a circular coin (false). */
    silhouette?: boolean;
};
export type Medallion = {
    group: THREE.Group;
    body: THREE.Mesh;
    face: THREE.Mesh;
    /** Drop-in update when a new env map arrives. */
    setEnvironment(env: THREE.Texture | null): void;
    dispose(): void;
};
export declare function createMedallion(analysis: PinAnalysis, options?: MedallionOptions): Medallion;
export declare function summarise(analysis: PinAnalysis): string;
//# sourceMappingURL=medallion.d.ts.map