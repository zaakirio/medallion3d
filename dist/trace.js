/**
 * Contour tracing: mask → ordered outline → simplified polygon.
 *
 * Moore-neighbour boundary tracing over the largest blob, then Douglas–Peucker.
 * No dependencies; this is what lets a pin's custom silhouette become real
 * geometry instead of a texture on a circle.
 */
const NEIGHBOURS = [
    { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
    { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
];
const dirIndex = (from, to) => {
    const dx = to.x - from.x, dy = to.y - from.y;
    for (let i = 0; i < 8; i++)
        if (NEIGHBOURS[i].x === dx && NEIGHBOURS[i].y === dy)
            return i;
    return 0;
};
/** Ordered outer boundary of the first foreground blob, in pixel coordinates. */
export function traceContour(mask, width, height) {
    const at = (x, y) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] > 0;
    let start = null;
    for (let y = 0; y < height && !start; y++) {
        for (let x = 0; x < width; x++)
            if (mask[y * width + x]) {
                start = { x, y };
                break;
            }
    }
    if (!start)
        return [];
    const contour = [start];
    let current = start;
    let backtrack = { x: start.x - 1, y: start.y };
    const maxSteps = width * height * 4;
    for (let step = 0; step < maxSteps; step++) {
        const from = dirIndex(current, backtrack);
        let found = null;
        for (let k = 1; k <= 8; k++) {
            const d = NEIGHBOURS[(from + k) % 8];
            const nx = current.x + d.x, ny = current.y + d.y;
            if (at(nx, ny)) {
                found = { x: nx, y: ny };
                break;
            }
        }
        if (!found)
            break;
        backtrack = current;
        current = found;
        if (current.x === start.x && current.y === start.y)
            break;
        contour.push(current);
    }
    return contour;
}
function perpendicularDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx === 0 && dy === 0)
        return Math.hypot(p.x - a.x, p.y - a.y);
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    const clamped = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + clamped * dx), p.y - (a.y + clamped * dy));
}
/** Douglas–Peucker polyline simplification. */
export function simplify(points, epsilon = 1.4) {
    if (points.length < 3)
        return points;
    let maxDist = 0, index = 0;
    for (let i = 1; i < points.length - 1; i++) {
        const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
        if (d > maxDist) {
            maxDist = d;
            index = i;
        }
    }
    if (maxDist <= epsilon)
        return [points[0], points[points.length - 1]];
    const left = simplify(points.slice(0, index + 1), epsilon);
    const right = simplify(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
}
/**
 * Chaikin corner-cutting on a closed loop. Turns the traced pixel staircase into
 * a flowing outline, so the coin's curves read as curves rather than facets.
 */
export function smoothClosed(points, iterations = 2) {
    if (points.length < 3)
        return points;
    let current = points;
    for (let pass = 0; pass < iterations; pass++) {
        const next = [];
        for (let i = 0; i < current.length; i++) {
            const a = current[i];
            const b = current[(i + 1) % current.length];
            next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
            next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
        }
        current = next;
    }
    return current;
}
/**
 * Map a pixel-space contour into centred world coordinates.
 * `size` is the target width/height of the longest edge.
 */
export function contourToPoints(contour, bounds, size = 2) {
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) || 1;
    const scale = size / span;
    return contour.map((p) => ({ x: (p.x - cx) * scale, y: -(p.y - cy) * scale }));
}
//# sourceMappingURL=trace.js.map