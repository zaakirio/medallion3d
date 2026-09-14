// Diagnostic: draw the flat pin, the analysis mask (red), the traced silhouette
// bounds (blue), and the derived face/height maps, all at 341px.
import { loadPin, traceContour, simplify, contourToPoints } from "../dist/index.js";

const pin = new URLSearchParams(location.search).get("pin") || "./pins/ramadan-lantern.png";
const analysis = await loadPin(pin);
const { width, height, mask, face, heightMap, metalness } = analysis;

const put = (id, data) => {
  const c = document.getElementById(id);
  c.width = width; c.height = height;
  c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
};

// 1. flat art + mask boundary in red
{
  const out = new Uint8ClampedArray(face);
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (mask[i] !== mask[i - 1] || mask[i] !== mask[i + 1] || mask[i] !== mask[i - width] || mask[i] !== mask[i + width]) {
        out[i * 4] = 255; out[i * 4 + 1] = 0; out[i * 4 + 2] = 0; out[i * 4 + 3] = 255;
      }
    }
  put("c1", out);
}
// 2. height map, 3. metalness map
put("c2", new Uint8ClampedArray(Array.from({ length: width * height * 4 }, (_, i) => heightMap[i >> 2] || 0).map((v, i) => (i % 4 === 3 ? 255 : v))));
put("c3", new Uint8ClampedArray(Array.from({ length: width * height * 4 }, (_, i) => metalness[i >> 2] || 0).map((v, i) => (i % 4 === 3 ? 255 : v))));

// 4. traced polygon over flat art
{
  const contour = traceContour(mask, width, height);
  const pts = contourToPoints(simplify(contour, Math.max(0.35, (Math.max(analysis.bounds.maxX - analysis.bounds.minX, analysis.bounds.maxY - analysis.bounds.minY)) / 2400)), analysis.bounds, 2);
  const c = document.getElementById("c4");
  c.width = width; c.height = height;
  const ctx = c.getContext("2d");
  ctx.putImageData(new ImageData(new Uint8ClampedArray(face), width, height), 0, 0);
  ctx.strokeStyle = "#00ffcc";
  ctx.lineWidth = 1;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = p.x / 2 * (analysis.bounds.maxX - analysis.bounds.minX) + analysis.bounds.minX;
    const y = -p.y / 2 * (analysis.bounds.maxY - analysis.bounds.minY) + analysis.bounds.minY;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();
}

const info = document.getElementById("info");
const b = analysis.bounds;
info.textContent = `canvas ${width}x${height} · bounds x:${b.minX}-${b.maxX} y:${b.minY}-${b.maxY} · gold ${(analysis.goldRatio * 100) | 0}% · polygon pts ${pts.length}`;
window.__ready = true;
