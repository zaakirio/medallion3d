/**
 * Procedural studio environment.
 *
 * Minted's pull is "real studio reflections that sweep across the metal as it
 * turns". We get that from an HDR environment map — but generating it from a
 * few emissive planes means the library ships no asset files at all, which is
 * the whole point.
 */
import * as THREE from "three";
export type StudioOptions = {
    /** Overall exposure of the virtual softboxes. */
    intensity?: number;
    background?: THREE.ColorRepresentation;
};
export declare function createStudioEnvironment(renderer: THREE.WebGLRenderer, { intensity, background }?: StudioOptions): THREE.Texture;
//# sourceMappingURL=environment.d.ts.map