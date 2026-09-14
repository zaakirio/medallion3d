// Build a contact sheet (flat | angles) for one pin, screenshot it.
//   node demo/sheet.mjs <tag> <pin> [pin...]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(join(root, "package.json"));
const { chromium } = require(join(root, "..", "LingoBite", "node_modules", "playwright", "index.js"));

const [tag, ...pins] = process.argv.slice(2);
const dir = join(root, "demo", "shots", tag);
await mkdir(join(root, "demo", "shots"), { recursive: true });

const ANGLES = ["face", "yaw25", "yaw55", "pitch22", "hero"];
const b64 = async (p) => (await readFile(p)).toString("base64");

let rows = "";
for (const pin of pins) {
  const flat = await b64(join(dir, `${pin}-flat.png`));
  rows += `<tr><th>${pin}<br>flat 2D</th><td><img src="data:image/png;base64,${flat}"></td>`;
  for (const a of ANGLES) {
    const img = await b64(join(dir, `${pin}-${a}.png`));
    rows += `<td><img src="data:image/png;base64,${img}"><small>${a}</small></td>`;
  }
  rows += "</tr>";
}

const html = `<!doctype html><style>
body{margin:0;background:#222;font:12px ui-monospace,monospace;color:#eee}
table{border-collapse:collapse}th,td{border:1px solid #444;padding:2px;text-align:center}
img{width:170px;display:block}small{color:#999}
</style><table>${rows}</table>`;

const sheetPath = join(dir, `_sheet.html`);
await writeFile(sheetPath, html);

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1240, height: 400 } });
await page.goto(`file://${sheetPath}`);
await page.setViewportSize({ width: 1240, height: 0 });
const h = await page.evaluate(() => document.body.scrollHeight);
await page.setViewportSize({ width: 1240, height: h });
await page.screenshot({ path: join(dir, `_sheet-${pins.join("-")}.png`), fullPage: true });
await browser.close();
console.log(join(dir, `_sheet-${pins.join("-")}.png`));
