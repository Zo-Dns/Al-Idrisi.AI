// خادم ملفات ساكن بسيط لمعاينة الاطلس المبني
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT || 8087);
const HOST = process.env.HOST || "127.0.0.1";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]);
  if (p === "/" || p === "/ai-how-ai-works.html") p = "/pages/ai-how-ai-works.html";
  let file = resolve(ROOT, "." + p);
  const rel = relative(ROOT, file);
  if (rel.startsWith("..") || isAbsolute(rel)) { res.writeHead(403); res.end(); return; }
  if (!existsSync(file)) { res.writeHead(404); res.end("not found: " + p); return; }
  if (statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404); res.end("not found: " + p); return; }
  res.writeHead(200, {
    "Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(req.method === "HEAD" ? undefined : readFileSync(file));
}).listen(PORT, HOST, () => {
  const shownHost = HOST === "0.0.0.0" ? "<local-network-ip>" : HOST;
  console.log(`atlas static server on http://${shownHost}:${PORT}`);
});
