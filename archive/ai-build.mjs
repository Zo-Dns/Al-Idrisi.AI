// يبني ai-how-ai-works.html من ai-content.mjs + ai-network-template.html
// كل شيء داخل المجلد المؤقت — لا يلمس مشروع المستخدم.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GROUPS, NODES, JOURNEY } from "./ai-content.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/* روابط عابرة بين المجموعات (مفهومان مرتبطان عبر الفروع) */
const XLINKS = [
  ["rlhf", "rl"],
  ["transformer", "llm"],
  ["gpu", "pretraining"],
  ["databias", "bias"],
  ["embeddings", "tokens"],
  ["vision", "cnn"],
  ["imagegen", "gan"],
  ["alexnet", "cnn"],
  ["alphago", "rl"],
  ["attention2017", "transformer"],
  ["chatgpt2022", "llm"],
  ["nlp", "llm"],
  ["safety", "rlhf"],
  ["rag", "hallucination"],
  ["cutoff", "rag"],
  ["genai", "llm"],
  ["genai", "imagegen"],
  ["benchmarks", "evaluation"],
  ["scaling", "gpu"],
  ["multimodal", "vision"],
  ["promptinjection", "redteam"],
];

/* حارس التشكيل: المدة والهمزة حرفان مسموحان، الحركات ممنوعة */
const HARAKAT = /[ً-ْٰ]/;
for (const nd of NODES) {
  for (const v of [nd.n, nd.d, nd.e]) {
    if (v && HARAKAT.test(v)) throw new Error("تشكيل مكتشف في العقدة: " + nd.k);
  }
}
for (const s of JOURNEY) {
  if (HARAKAT.test(s.t)) throw new Error("تشكيل مكتشف في خطوة الرحلة: " + s.k);
}
for (const g of GROUPS) {
  if (HARAKAT.test(g.name)) throw new Error("تشكيل مكتشف في اسم مجموعة: " + g.name);
}

/* تحويل المفاتيح الى فهارس */
const keyToIdx = new Map(NODES.map((nd, i) => [nd.k, i]));
if (keyToIdx.size !== NODES.length) throw new Error("مفاتيح مكررة");
if (NODES[0].k !== "root") throw new Error("العقدة الاولى يجب ان تكون root");

const nodes = NODES.map((nd) => {
  if (nd.p !== null && !keyToIdx.has(nd.p)) throw new Error("اب مجهول: " + nd.p + " في " + nd.k);
  return {
    k: nd.k,
    n: nd.n,
    e: nd.e,
    p: nd.p === null ? -1 : keyToIdx.get(nd.p),
    g: nd.g,
    h: nd.h ? 1 : 0,
    d: nd.d,
  };
});

const xlinks = XLINKS.map(([a, b]) => {
  if (!keyToIdx.has(a) || !keyToIdx.has(b)) throw new Error("رابط عابر بمفتاح مجهول: " + a + "-" + b);
  return [keyToIdx.get(a), keyToIdx.get(b)];
});

const journey = JOURNEY.map((s) => {
  if (!keyToIdx.has(s.k)) throw new Error("خطوة رحلة بمفتاح مجهول: " + s.k);
  const r = (s.rel || []).map((k2) => {
    if (!keyToIdx.has(k2)) throw new Error("مفهوم rel مجهول: " + k2 + " في خطوة " + s.k);
    return keyToIdx.get(k2);
  });
  return { i: keyToIdx.get(s.k), t: s.t, r };
});

const data = { groups: GROUPS, nodes, xlinks, journey };
const json = JSON.stringify(data).replace(/<\//g, "<\\/");

const template = readFileSync(join(here, "ai-network-template.html"), "utf8");
if (!template.includes("/*__DATA__*/null")) throw new Error("placeholder not found");
const body = template.replace("/*__DATA__*/null", json);

/* ربط الخريطة المتخصصة: رابط الويب للنسخة المنشورة، ورابط ملف محلي لنسخة سطح المكتب */
const LLM_MAP_ONLINE = "https://claude.ai/code/artifact/eb777ddc-c0f2-4884-9111-fba1a4266f98";
const bodyOnline = body.split("__LLM_MAP_URL__").join(LLM_MAP_ONLINE);
const bodyLocal = body.split("__LLM_MAP_URL__").join("llm-how-llms-work.html");
writeFileSync(join(here, "ai-how-ai-works.html"), bodyOnline, "utf8");

/* نسخة مستقلة بهيكل كامل وترويسة UTF-8 للفتح المحلي */
const standalone = '<!doctype html>\n<html lang="ar">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n' + bodyLocal + "\n</body>\n</html>\n";
writeFileSync(join(here, "ai-how-ai-works-standalone.html"), standalone, "utf8");

console.log(`nodes=${nodes.length} xlinks=${xlinks.length} journey=${journey.length} size=${Math.round(body.length / 1024)}KB — OK`);
