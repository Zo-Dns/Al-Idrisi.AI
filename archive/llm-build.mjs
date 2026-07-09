// يبني llm-how-llms-work.html من llm-content.mjs + llm-network-template.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GROUPS, NODES, JOURNEY } from "./llm-content.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/* روابط عابرة بين المجموعات */
const XLINKS = [
  ["temp2", "hallu2"],
  ["rag2", "hallu2"],
  ["scaling2", "gpuclusters"],
  ["rlhf2", "alignment"],
  ["constitutional", "alignment"],
  ["cot", "reasoning2"],
  ["decoder", "autoregressive"],
  ["moe", "inference2"],
  ["deepseek", "moe"],
  ["kvcache", "context2"],
  ["paper2017", "transformer2"],
  ["icl", "gpt"],
  ["nexttoken", "autoregressive"],
];

/* حارس التشكيل: الحركات ممنوعة، المدة والهمزة حروف مشروعة */
const HARAKAT = /[ً-ْٰ]/;
for (const nd of NODES) {
  for (const v of [nd.n, nd.d, nd.e]) {
    if (v && HARAKAT.test(v)) throw new Error("تشكيل مكتشف في العقدة: " + nd.k);
  }
}
for (const s of JOURNEY) if (HARAKAT.test(s.t)) throw new Error("تشكيل في خطوة: " + s.k);
for (const g of GROUPS) if (HARAKAT.test(g.name)) throw new Error("تشكيل في مجموعة: " + g.name);

const keyToIdx = new Map(NODES.map((nd, i) => [nd.k, i]));
if (keyToIdx.size !== NODES.length) throw new Error("مفاتيح مكررة");
if (NODES[0].k !== "root") throw new Error("العقدة الاولى يجب ان تكون root");

const nodes = NODES.map((nd) => {
  if (nd.p !== null && !keyToIdx.has(nd.p)) throw new Error("اب مجهول: " + nd.p + " في " + nd.k);
  return {
    k: nd.k, n: nd.n, e: nd.e,
    p: nd.p === null ? -1 : keyToIdx.get(nd.p),
    g: nd.g, h: nd.h ? 1 : 0, d: nd.d,
  };
});
const xlinks = XLINKS.map(([a, b]) => {
  if (!keyToIdx.has(a) || !keyToIdx.has(b)) throw new Error("رابط عابر مجهول: " + a + "-" + b);
  return [keyToIdx.get(a), keyToIdx.get(b)];
});
const journey = JOURNEY.map((s) => {
  if (!keyToIdx.has(s.k)) throw new Error("خطوة مجهولة: " + s.k);
  const r = (s.rel || []).map((k2) => {
    if (!keyToIdx.has(k2)) throw new Error("rel مجهول: " + k2 + " في " + s.k);
    return keyToIdx.get(k2);
  });
  return { i: keyToIdx.get(s.k), t: s.t, r };
});

const json = JSON.stringify({ groups: GROUPS, nodes, xlinks, journey }).replace(/<\//g, "<\\/");
const template = readFileSync(join(here, "llm-network-template.html"), "utf8");
if (!template.includes("/*__DATA__*/null")) throw new Error("placeholder not found");
const body = template.replace("/*__DATA__*/null", json);

/* رابط العودة: رابط الويب للنسخة المنشورة، وملف محلي لنسخة سطح المكتب */
const AI_MAP_ONLINE = "https://claude.ai/code/artifact/27d20e2b-0a65-4db4-9493-dceb2d42ee68";
const bodyOnline = body.split("__AI_MAP_URL__").join(AI_MAP_ONLINE);
const bodyLocal = body.split("__AI_MAP_URL__").join("ai-how-ai-works.html");
writeFileSync(join(here, "llm-how-llms-work.html"), bodyOnline, "utf8");

const standalone = '<!doctype html>\n<html lang="ar">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n' + bodyLocal + "\n</body>\n</html>\n";
writeFileSync(join(here, "llm-how-llms-work-standalone.html"), standalone, "utf8");

console.log(`nodes=${nodes.length} xlinks=${xlinks.length} journey=${journey.length} size=${Math.round(body.length / 1024)}KB — OK`);
