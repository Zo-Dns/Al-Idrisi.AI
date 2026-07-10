// خادم ملفات ساكن بسيط لمعاينة الاطلس المبني
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = "E:/AI-Atlas-Project";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]);
  if (p === "/") p = "/ai-how-ai-works.html";
  const file = join(ROOT, p);
  if (!file.startsWith(ROOT.replace(/\//g, "\\")) && !file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (!existsSync(file)) { res.writeHead(404); res.end("not found: " + p); return; }
  res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
}).listen(8087, () => console.log("atlas static server on http://localhost:8087"));
