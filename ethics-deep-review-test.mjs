import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { GROUPS, NODES, JOURNEY } from "./ethics-content.mjs";

const template = fs.readFileSync(new URL("./atlas-template.html", import.meta.url), "utf8");
assert.equal(GROUPS.length, 8);
assert.equal(NODES.length, 57);
assert.equal(JOURNEY.length, 16);
const keys = new Set(NODES.map((node) => node.k));
assert.equal(keys.size, 57);
for (const node of NODES) {
  assert.ok(typeof node.d === "string" && node.d.trim(), `وصف مفقود: ${node.k}`);
  assert.ok(node.g === -1 || (node.g >= 0 && node.g < GROUPS.length), `مجموعة غير صالحة: ${node.k}`);
  if (node.p !== null) assert.ok(keys.has(node.p), `اب مفقود: ${node.k} -> ${node.p}`);
}
for (const step of JOURNEY) {
  assert.ok(keys.has(step.k), `عقدة رحلة مفقودة: ${step.k}`);
  assert.ok(typeof step.t === "string" && step.t.trim(), `نص رحلة مفقود: ${step.k}`);
  for (const rel of step.rel || []) assert.ok(keys.has(rel), `علاقة رحلة مفقودة: ${step.k} -> ${rel}`);
}
assert.deepEqual([...Array(8)].map((_, group) => NODES.filter((node) => node.g === group).length), [7, 6, 7, 7, 7, 8, 6, 8]);

const corpus = NODES.map((node) => node.d).concat(JOURNEY.map((step) => step.t)).join("\n");
for (const phrase of [
  "خاضعا لقصد البشر",
  "اثبت كلاينبرغ وزملاؤه",
  "اثبت انسين وزملاؤه",
  "تبقى بياناتك على جهازك",
  "تمنح المادة 22 حماية من القرارات الالية بالكامل",
  "هو الخطر الاول في قائمة اواسب",
  "لفهم كيف يفكر",
  "يضمن معيار C2PA",
  "اول معيار دولي لنظم ادارة الذكاء الاصطناعي",
  "اول معيار حكومي دولي للذكاء الاصطناعي",
]) assert.ok(!corpus.includes(phrase), `بقي ادعاء مطلق او مضلل: ${phrase}`);

const srcMatch = template.match(/const SRC_ETHICS = (\{[\s\S]*?\n\});\nconst SRC_CLASSIC/);
assert.ok(srcMatch, "تعذر استخراج لوحة مصادر الاخلاق والامان");
const src = vm.runInNewContext(`(${srcMatch[1]})`);
const items = src.topics.flatMap((topic) => topic.items);
assert.equal(items.length, 14, "يجب حفظ مواد لوحة الاخلاق والامان الاربع عشرة");
for (const url of [
  "https://www.youtube.com/watch?v=IB1OvoCNnWY",
  "https://www.youtube.com/watch?v=rAEqP9VEhe8",
  "https://fairmlbook.org/",
  "https://www.youtube.com/watch?v=EBK-a94IFHY",
  "https://doi.org/10.1145/2090236.2090255",
  "https://proceedings.neurips.cc/paper_files/paper/2016/hash/6a9659feb1216f14f7384ba499518b38-Abstract.html",
  "https://doi.org/10.1089/big.2016.0047",
  "https://proceedings.mlr.press/v81/buolamwini18a.html",
  "https://doi.org/10.1109/SP.2017.41",
  "https://doi.org/10.1145/2810103.2813677",
  "https://arxiv.org/abs/1312.6199",
  "https://doi.org/10.6028/NIST.AI.100-1",
  "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
  "https://arxiv.org/abs/1606.06565",
]) assert.ok(items.some((item) => item.url === url || item.link === url), `مصدر اصلي مفقود: ${url}`);

const additions = vm.runInNewContext(`(${template.match(/const ACADEMIC_SOURCE_ADDITIONS = (\{[\s\S]*?\n\});/)[1]})`);
assert.equal(additions["الاخلاق والامان"].length, 15);
assert.equal(Object.values(additions).flat().length, 123);

for (const name of ["ai-how-ai-works.html"]) {
  const output = fs.readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
  assert.ok(output.includes("ليست حظرا عاما لكل قرار آلي"), `${name}: تصحيح GDPR مفقود`);
  assert.ok(output.includes("صدر التقرير السنوي الاول في يناير 2025 والثاني في فبراير 2026"), `${name}: تحديث التقرير الدولي مفقود`);
  assert.ok(output.includes("Closing the AI Accountability Gap"), `${name}: مراجع الاخلاق الجديدة مفقودة`);
  assert.ok(output.includes("const SRC_ETHICS ="), `${name}: لوحة مصادر الاخلاق مفقودة`);
}

console.log("Ethics deep review: 57 nodes, 8 groups, 16 journey steps, sources and academic additions verified.");
