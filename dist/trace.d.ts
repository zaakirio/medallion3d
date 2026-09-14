/**
 * Contour tracing: mask → ordered outline → simplified polygon.
 *
 * Moore-neighbour boundary tracing over the largest blob, then Douglas–Peucker.
 * No dependencies; this is what lets a pin's custom silhouette become real
 * geometry instead of a texture on a circle.
 */
export type Point = {
    x: number;
    y: number;
};
/** Ordered outer boundary of the first foreground blob, in pixel coordinates. */
export declare function traceContour(mask: Uint8Array, width: number, height: number): Point[];
/** Douglas–Peucker polyline simplification. */
export declare function simplify(points: Point[], epsilon?: number): Point[];
/**
 * Chaikin corner-cutting on a closed loop. Turns the traced pixel staircase into
 * a flowing outline, so the coin's curves read as curves rather than facets.
 */
export declare function smoothClosed(points: Point[], iterations?: number): Point[];
/**
 * Map a pixel-space contour into centred world coordinates.
 * `size` is the target width/height of the longest edge.
 */
export declare function contourToPoints(contour: Point[], bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}, size?: number): Point[];
//# sourceMappingURL=trace.d.ts.map