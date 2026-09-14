// Debug driver: serves the demo statically, drives the viewer to exact angles
// with Playwright, and saves HD screenshots per pin/angle.
//   node demo/debug-driver.mjs [tag]
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL("..", import.meta.url)); // repo root
const require = createRequire(join(root, "package.json"));
const { chromium } = require(join(root, "..", "LingoBite", "node_modules", "playwright", "index.js"));

const tag = process.argv[2] || "before";
const PORT = 5199;

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".png": "image/png", ".json": "application/json",
  ".map": "application/json", ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    const file = join(root, path === "/" ? "demo/debug.html" : path);
    const data = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end("nope");
  }
});
await new Promise((ok) => server.listen(PORT, "127.0.0.1", ok));

const PINS = [
  "eiffel-tower",
  "accordion",
  "saint-basils-cathedral",
  "dallah-coffee",
  "ramadan-lantern",
  "pelmeni",
  "matryoshka-doll",
  "croissant",
  "fleur-de-lis",
  "gallic-rooster",
  "falcon",
  "oud",
  "arabesque-tilework",
];

// [yaw°, pitch°, label] — yaw = turn left/right, pitch = tip up/down.
const ANGLES = [
  [0, 0, "face"],
  [25, 0, "yaw25"],
  [55, 0, "yaw55"],
  [0, 22, "pitch22"],
  [0, -22, "pitch-22"],
  [35, 14, "hero"],
];

const outDir = join(root, "demo", "shots", tag);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

const page = await browser.newPage({
  viewport: { width: 420, height: 420 },
  deviceScaleFactor: 2, // HD, like a 2x phone
});
page.on("pageerror", (e) => console.error(`[pageerror] ${e.message}`));

for (const pin of PINS) {
  await page.goto(`http://127.0.0.1:${PORT}/demo/debug.html?pin=./pins/${pin}.png`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction("window.__ready === true", null, { timeout: 30000 });
  // Copy the flat asset once for side-by-side comparison.
  await page.evaluate(async (pin) => {
    const r = await fetch(`./pins/${pin}.png`);
    const blob = await r.blob();
    return new Promise((ok) => {
      const reader = new FileReader();
      reader.onload = () => ok(reader.result);
      reader.readAsDataURL(blob);
    });
  }, pin).then((dataUrl) =>
    writeFile(join(outDir, `${pin}-flat.png`), Buffer.from(String(dataUrl).split(",")[1], "base64")),
  );

  for (const [yaw, pitch, label] of ANGLES) {
    await page.evaluate((deg) => window.__setRot(deg[0], deg[1]), [yaw, pitch]);
    await page.waitForFunction(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
    const frame = page.locator(".frame");
    await frame.screenshot({ path: join(outDir, `${pin}-${label}.png`) });
    console.log(`${tag}/${pin}-${label}.png`);
  }
}

await browser.close();
server.close();
console.log("done");
