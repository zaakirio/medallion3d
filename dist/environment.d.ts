/**
 * Procedural studio environment.
 *
 * Minted's pull is "real studio reflections that sweep across the metal as it
 * turns". We get that from an HDR environment map — but generating it from
 * emissive geometry means the library ships no asset files at all, which is
 * the whole point.
 *
 * The dome is the quiet workhorse: head-on, a mirror reflects whatever sits
 * behind the viewer, and an empty hemisphere reads as dead metal. A soft
 * zenith-to-floor gradient — like a photo sweep wrapping the set — fills the
 * gold with a natural luminous falloff, while the panels and strips supply the
 * defined highlights that sweep as the medal turns.
 */
import * as THREE from "three";
export type StudioOptions = {
    /** Overall exposure of the virtual softboxes. */
    intensity?: number;
    background?: THREE.ColorRepresentation;
};
export declare function createStudioEnvironment(renderer: THREE.WebGLRenderer, { intensity, background }?: StudioOptions): THREE.Texture;
//# sourceMappingURL=environment.d.ts.map