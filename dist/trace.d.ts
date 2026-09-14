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