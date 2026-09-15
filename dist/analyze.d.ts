/**
 * Image analysis: turn a flat pin PNG into the maps a 3D medallion needs.
 *
 * Pure — no DOM, no Three.js. Feed it RGBA pixels and get back a silhouette
 * mask, a height field, and material maps. This is the "no 3D assets" core:
 * every map is derived from the artwork at runtime.
 */
export type PixelInput = {
    /** RGBA, 4 bytes per pixel, row-major. */
    data: Uint8ClampedArray | Uint8Array;
    width: number;
    height: number;
};
export type PinAnalysis = {
    width: number;
    height: number;
    /** 0 = empty, 255 = solid silhouette. */
    mask: Uint8Array;
    /** Raised vs. inset; 0..255. Gold ridges are high. */
    heightMap: Uint8Array;
    /** 0..255 metalness (gold areas). */
    metalness: Uint8Array;
    /** 0..255 roughness. */
    roughness: Uint8Array;
    /** RGBA with the background removed, for the coin face. */
    face: Uint8ClampedArray;
    /** Fraction of the silhouette classified as gold. */
    goldRatio: number;
    /** Pixels classified as gold-painted (the metal recolour mask). */
    goldMask: Uint8Array;
    /** The silhouette's outermost border band (the struck-metal rim). */
    ring: Uint8Array;
    bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
};
export declare function analyzePin({ data, width, height }: PixelInput): PinAnalysis;
//# sourceMappingURL=analyze.d.ts.map