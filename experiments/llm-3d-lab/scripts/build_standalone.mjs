/* يجمع المختبر كاملا في ملف HTML واحد يفتح بنقرة مزدوجة من القرص — صفر خوادم وصفر شبكة.
   الوحدات (Three.js وOrbitControls والرياضيات والمشهد) تضمن كروابط data: عبر importmap،
   وبيانات النموذج تحقن في window.__TINY_GPT_DATA__ فلا يبقى اي fetch.
   التشغيل: node experiments/llm-3d-lab/scripts/build_standalone.mjs */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LAB = dirname(dirname(fileURLToPath(import.meta.url)));
const VENDOR = join(LAB, "..", "nn-3d-simulation", "vendor", "three");

const dataUrl = (code) => "data:text/javascript;base64," + Buffer.from(code, "utf8").toString("base64");

const three = readFileSync(join(VENDOR, "three.module.js"), "utf8");
const orbit = readFileSync(join(VENDOR, "OrbitControls.js"), "utf8")
  .replace("from './three.module.js'", 'from "three"');
const gpt = readFileSync(join(LAB, "src", "gpt.js"), "utf8");
const scene = readFileSync(join(LAB, "src", "scene.js"), "utf8")
  .replace('import * as THREE from "../../nn-3d-simulation/vendor/three/three.module.js";', 'import * as THREE from "three";')
  .replace('import { OrbitControls } from "../../nn-3d-simulation/vendor/three/OrbitControls.js";', 'import { OrbitControls } from "orbit";')
  .replace('from "./gpt.js"', 'from "gptmath"');
const css = readFileSync(join(LAB, "src", "lab.css"), "utf8");
const model = readFileSync(join(LAB, "data", "tiny-gpt.json"), "utf8");

const html = readFileSync(join(LAB, "index.html"), "utf8");
const mainStart = html.indexOf("<main");
const mainEnd = html.indexOf("</main>") + "</main>".length;
if (mainStart < 0 || mainEnd < 0) throw new Error("main block not found in index.html");
const mainBlock = html.slice(mainStart, mainEnd);

const importmap = JSON.stringify({ imports: { three: dataUrl(three), orbit: dataUrl(orbit), gptmath: dataUrl(gpt) } });

const out = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>مختبر النموذج اللغوي 3D — نسخة منفردة</title>
<style>
${css}
</style>
</head>
<body>
${mainBlock}
<script>window.__TINY_GPT_DATA__ = ${model};</script>
<script type="importmap">${importmap}</script>
<script type="module">
${scene}
</script>
</body>
</html>
`;

const target = join(LAB, "standalone.html");
writeFileSync(target, out, "utf8");
console.log(`wrote ${target} (${(out.length / 1e6).toFixed(2)} MB) — يفتح بنقرة مزدوجة بلا خادم`);
