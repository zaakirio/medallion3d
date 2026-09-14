/**
 * Image analysis: turn a flat pin PNG into the maps a 3D medallion needs.
 *
 * Pure — no DOM, no Three.js. Feed it RGBA pixels and get back a silhouette
 * mask, a height field, and material maps. This is the "no 3D assets" core:
 * every map is derived from the artwork at runtime.
 */
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
/** RGB → HSV with h in degrees, s/v in 0..1. */
function rgbToHsv(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === rn)
            h = ((gn - bn) / d) % 6;
        else if (max === gn)
            h = (bn - rn) / d + 2;
        else
            h = (rn - gn) / d + 4;
        h *= 60;
        if (h < 0)
            h += 360;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
}
function classify(r, g, b, a) {
    if (a < 16)
        return "background";
    const { h, s, v } = rgbToHsv(r, g, b);
    // Near-neutral and bright → the page the pin sits on.
    if (s < 0.14 && v > 0.82)
        return "background";
    // Warm yellow hue band = the gold metal outline.
    if (h >= 26 && h <= 62 && s > 0.22 && v > 0.32)
        return "gold";
    return "enamel";
}
/** In-place separable box blur, `radius` px, on a single channel. */
function boxBlur(src, width, height, radius) {
    if (radius <= 0)
        return src;
    const tmp = new Uint8Array(src.length);
    const out = new Uint8Array(src.length);
    for (let y = 0; y < height; y++) {
        let sum = 0, count = 0;
        for (let x = -radius; x <= radius; x++) {
            const xi = Math.min(width - 1, Math.max(0, x));
            sum += src[y * width + xi];
            count++;
        }
        for (let x = 0; x < width; x++) {
            tmp[y * width + x] = sum / count;
            const add = src[y * width + Math.min(width - 1, x + radius + 1)];
            const drop = src[y * width + Math.max(0, x - radius)];
            sum += add - drop;
        }
    }
    for (let x = 0; x < width; x++) {
        let sum = 0, count = 0;
        for (let y = -radius; y <= radius; y++) {
            const yi = Math.min(height - 1, Math.max(0, y));
            sum += tmp[yi * width + x];
            count++;
        }
        for (let y = 0; y < height; y++) {
            out[y * width + x] = sum / count;
            const add = tmp[Math.min(height - 1, y + radius + 1) * width + x];
            const drop = tmp[Math.max(0, y - radius) * width + x];
            sum += add - drop;
        }
    }
    return out;
}
/**
 * Keep the largest connected foreground blob, then fill any interior holes, so
 * a pin with pale detail inside (clouds, lettering) still yields one solid coin.
 */
function solidify(mask, width, height) {
    const seen = new Uint8Array(mask.length);
    let best = [];
    const stack = new Int32Array(mask.length);
    for (let start = 0; start < mask.length; start++) {
        if (!mask[start] || seen[start])
            continue;
        let top = 0;
        stack[top++] = start;
        seen[start] = 1;
        const group = [];
        while (top > 0) {
            const i = stack[--top];
            group.push(i);
            const x = i % width, y = (i / width) | 0;
            const neighbours = [
                x > 0 ? i - 1 : -1,
                x < width - 1 ? i + 1 : -1,
                y > 0 ? i - width : -1,
                y < height - 1 ? i + width : -1,
            ];
            for (const n of neighbours) {
                if (n >= 0 && mask[n] && !seen[n]) {
                    seen[n] = 1;
                    stack[top++] = n;
                }
            }
        }
        if (group.length > best.length)
            best = group;
    }
    const solid = new Uint8Array(mask.length);
    for (const i of best)
        solid[i] = 255;
    // Flood the outside; whatever background is unreachable is an interior hole.
    const outside = new Uint8Array(mask.length);
    let top = 0;
    const push = (i) => { if (!solid[i] && !outside[i]) {
        outside[i] = 1;
        stack[top++] = i;
    } };
    for (let x = 0; x < width; x++) {
        push(x);
        push((height - 1) * width + x);
    }
    for (let y = 0; y < height; y++) {
        push(y * width);
        push(y * width + width - 1);
    }
    while (top > 0) {
        const i = stack[--top];
        const x = i % width, y = (i / width) | 0;
        if (x > 0)
            push(i - 1);
        if (x < width - 1)
            push(i + 1);
        if (y > 0)
            push(i - width);
        if (y < height - 1)
            push(i + width);
    }
    for (let i = 0; i < solid.length; i++)
        if (!solid[i] && !outside[i])
            solid[i] = 255;
    return solid;
}
export function analyzePin({ data, width, height }) {
    const n = width * height;
    const raw = new Uint8Array(n);
    const isGold = new Uint8Array(n);
    const face = new Uint8ClampedArray(n * 4);
    let goldCount = 0, fgCount = 0;
    for (let i = 0; i < n; i++) {
        const o = i * 4;
        const r = data[o], g = data[o + 1], b = data[o + 2], a = data[o + 3];
        const kind = classify(r, g, b, a);
        face[o] = r;
        face[o + 1] = g;
        face[o + 2] = b;
        if (kind === "background") {
            face[o + 3] = 0;
            continue;
        }
        raw[i] = 255;
        face[o + 3] = a;
        fgCount++;
        if (kind === "gold") {
            isGold[i] = 255;
            goldCount++;
        }
    }
    const mask = solidify(raw, width, height);
    // Bleed the artwork outward into any silhouette pixel the classifier called
    // background (the pin's own edge pixels blend into the page). Without this the
    // face is clipped at the outline and the extruded gold body shows through as a
    // fat border that the flat artwork does not have.
    const bleeded = new Uint8ClampedArray(face);
    {
        const filled = new Uint8Array(n);
        const queue = [];
        for (let i = 0; i < n; i++) {
            if (mask[i] && bleeded[i * 4 + 3] >= 16) {
                filled[i] = 1;
                queue.push(i);
            }
        }
        for (let head = 0; head < queue.length; head++) {
            const i = queue[head];
            const x = i % width, y = (i / width) | 0;
            const neighbours = [
                x > 0 ? i - 1 : -1,
                x < width - 1 ? i + 1 : -1,
                y > 0 ? i - width : -1,
                y < height - 1 ? i + width : -1,
            ];
            for (const j of neighbours) {
                if (j < 0 || !mask[j] || filled[j])
                    continue;
                bleeded[j * 4] = bleeded[i * 4];
                bleeded[j * 4 + 1] = bleeded[i * 4 + 1];
                bleeded[j * 4 + 2] = bleeded[i * 4 + 2];
                filled[j] = 1;
                queue.push(j);
            }
        }
        // Everything inside the silhouette is opaque now.
        for (let i = 0; i < n; i++)
            if (mask[i])
                bleeded[i * 4 + 3] = 255;
    }
    // Height: gold ridges sit proud, enamel is a shallow inlay, everything else flat.
    const heightField = new Uint8Array(n);
    const metalness = new Uint8Array(n);
    const roughness = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        if (!mask[i]) {
            metalness[i] = 0;
            roughness[i] = 200;
            continue;
        }
        if (isGold[i]) {
            heightField[i] = 235;
            metalness[i] = 255;
            roughness[i] = 55;
        }
        else {
            heightField[i] = 72;
            metalness[i] = 0;
            roughness[i] = 205;
        }
    }
    const smoothHeight = boxBlur(boxBlur(heightField, width, height, 2), width, height, 1);
    const smoothMetal = boxBlur(metalness, width, height, 1);
    // Silhouette bounds, for UV mapping and framing.
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (mask[y * width + x]) {
                if (x < minX)
                    minX = x;
                if (x > maxX)
                    maxX = x;
                if (y < minY)
                    minY = y;
                if (y > maxY)
                    maxY = y;
            }
        }
    }
    if (maxX < minX) {
        minX = 0;
        minY = 0;
        maxX = width - 1;
        maxY = height - 1;
    }
    return {
        width, height,
        mask,
        heightMap: smoothHeight,
        metalness: smoothMetal,
        roughness,
        face: bleeded,
        goldRatio: fgCount ? goldCount / fgCount : 0,
        bounds: { minX, minY, maxX, maxY },
    };
}
//# sourceMappingURL=analyze.js.map