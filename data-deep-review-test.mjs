import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { GROUPS, NODES, JOURNEY } from "./data-content.mjs";

const template = fs.readFileSync(new URL("./atlas-template.html", import.meta.url), "utf8");
assert.equal(GROUPS.length, 9);
assert.equal(NODES.length, 71);
assert.equal(JOURNEY.length, 16);
const keys = new Set(NODES.map((node) => node.k));
assert.equal(keys.size, 71);
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
assert.deepEqual([...Array(9)].map((_, group) => NODES.filter((node) => node.g === group).length), [8, 8, 8, 11, 7, 7, 5, 7, 9]);

const corpus = NODES.map((node) => node.d).concat(JOURNEY.map((step) => step.t)).join("\n");
for (const phrase of [
  "المادة الخام التي يتعلم منها كل نظام",
  "لا خوارزمية تعوض بيانات",
  "تشكل الغالبية العظمى من بيانات العالم",
  "يتفوق التعلم العميق في التعامل معها بعد ان عجز",
  "اداء النموذج الحقيقي",
  "ضمان رياضي بعدم كشف اي فرد",
  "الجمع الفيدرالي (اللامركزي)",
  "لا يجمع البيانات الخام في مكان واحد قط",
  "تنسخ بلا كلفة",
]) assert.ok(!corpus.includes(phrase), `بقي ادعاء مطلق: ${phrase}`);

const srcMatch = template.match(/const SRC_DATA = (\{[\s\S]*?\n\});\nconst SRC_DL/);
assert.ok(srcMatch, "تعذر استخراج لوحة مصادر البيانات");
const src = vm.runInNewContext(`(${srcMatch[1]})`);
const items = src.topics.flatMap((topic) => topic.items);
assert.equal(items.length, 7, "يجب حفظ مواد لوحة البيانات السبعة");
for (const url of [
  "https://www.youtube.com/watch?v=Hq9qNpVdhQE",
  "https://www.youtube.com/watch?v=gV0_raKR2UQ",
  "https://arxiv.org/abs/1803.09010",
  "https://dcai.csail.mit.edu/2024/dataset-creation-curation/",
  "https://dcai.csail.mit.edu/",
  "https://scikit-learn.org/stable/common_pitfalls.html",
  "https://www.youtube.com/watch?v=06-AZXmwHjo",
]) assert.ok(items.some((item) => item.url === url || item.link === url), `مصدر اصلي مفقود: ${url}`);

const additions = vm.runInNewContext(`(${template.match(/const ACADEMIC_SOURCE_ADDITIONS = (\{[\s\S]*?\n\});/)[1]})`);
assert.equal(additions["البيانات"].length, 12);
assert.equal(Object.values(additions).flat().length, 123);

for (const name of ["ai-how-ai-works.html"]) {
  const output = fs.readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
  assert.ok(output.includes("لا يوفر الخصوصية وحده"), `${name}: محتوى البيانات المصحح مفقود`);
  assert.ok(output.includes("Robust De-anonymization of Large Sparse Datasets"), `${name}: مراجع البيانات الجديدة مفقودة`);
  assert.ok(output.includes("const SRC_DATA ="), `${name}: لوحة مصادر البيانات مفقودة`);
}

console.log("Data deep review: 71 nodes, 9 groups, 16 journey steps, sources and academic additions verified.");
