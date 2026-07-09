// يبني jeelpixel-file-network.html من files-raw.txt + network-template.html
// قراءة وكتابة داخل المجلد المؤقت فقط — لا يلمس مشروع المستخدم.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// فك ترميز مسارات git المقتبسة بنمط C (للاسماء غير اللاتينية)
function unquote(p) {
  if (!p.startsWith('"') || !p.endsWith('"')) return p;
  const inner = p.slice(1, -1);
  const bytes = [];
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c !== "\\") { bytes.push(...Buffer.from(c, "utf8")); continue; }
    const n = inner[++i];
    if (n >= "0" && n <= "7") {
      const oct = inner.slice(i, i + 3);
      bytes.push(parseInt(oct, 8));
      i += 2;
    } else {
      const map = { n: 10, t: 9, r: 13, '"': 34, "\\": 92 };
      bytes.push(map[n] ?? n.charCodeAt(0));
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

function groupOf(path) {
  if (path.startsWith("artifacts/kids-tech")) return 0;
  if (path.startsWith("artifacts/api-server")) return 1;
  if (path.startsWith("artifacts/mockup-sandbox")) return 2;
  if (path.startsWith("lib/db")) return 3;
  if (path === "lib" || path.startsWith("lib/")) return 4;
  if (path === "scripts" || path.startsWith("scripts/")) return 5;
  if (path.startsWith(".claude")) return 6;
  return 7;
}

const raw = readFileSync(join(here, "files-raw.txt"), "utf8");
const files = [];
for (const line of raw.split("\n")) {
  if (!line.trim()) continue;
  const tab = line.indexOf("\t");
  if (tab < 0) continue;
  const meta = line.slice(0, tab).trim().split(/\s+/);
  const size = parseInt(meta[meta.length - 1], 10) || 0;
  const path = unquote(line.slice(tab + 1).trim());
  files.push({ path, size });
}

// بناء الشجرة: العقدة 0 هي الجذر
const nodes = [{ n: "", p: -1, t: 1, s: 0, g: 7 }];
const dirIndex = new Map([["", 0]]);

function ensureDir(path) {
  if (dirIndex.has(path)) return dirIndex.get(path);
  const slash = path.lastIndexOf("/");
  const parentPath = slash >= 0 ? path.slice(0, slash) : "";
  const parent = ensureDir(parentPath);
  const idx = nodes.length;
  nodes.push({ n: path.slice(slash + 1), p: parent, t: 1, s: 0, g: groupOf(path) });
  dirIndex.set(path, idx);
  return idx;
}

for (const f of files) {
  const slash = f.path.lastIndexOf("/");
  const parentPath = slash >= 0 ? f.path.slice(0, slash) : "";
  const parent = ensureDir(parentPath);
  nodes.push({ n: f.path.slice(slash + 1), p: parent, t: 0, s: f.size, g: groupOf(f.path) });
}

const dirCount = nodes.filter((n) => n.t === 1).length - 1;
console.log(`files=${files.length} dirs=${dirCount} nodes=${nodes.length}`);

const json = JSON.stringify({ nodes }).replace(/<\//g, "<\\/");
const template = readFileSync(join(here, "network-template.html"), "utf8");
if (!template.includes("/*__DATA__*/null")) throw new Error("placeholder not found");
const out = template.replace("/*__DATA__*/null", json);
writeFileSync(join(here, "jeelpixel-file-network.html"), out, "utf8");
console.log("written: jeelpixel-file-network.html (" + Math.round(out.length / 1024) + " KB)");
