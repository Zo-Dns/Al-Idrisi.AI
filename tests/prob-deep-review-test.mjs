import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { GROUPS, NODES, JOURNEY } from "../src/content/prob-content.mjs";

const template = fs.readFileSync(new URL("../src/templates/atlas-template.html", import.meta.url), "utf8");
const build = fs.readFileSync(new URL("../scripts/atlas-build.mjs", import.meta.url), "utf8");
assert.equal(GROUPS.length, 9);
assert.equal(NODES.length, 67);
assert.equal(JOURNEY.length, 11);

const keys = new Set(NODES.map((node) => node.k));
assert.equal(keys.size, NODES.length, "يجب ان يكون مفتاح كل عقدة فريدا");
assert.deepEqual([...Array(9)].map((_, group) => NODES.filter((node) => node.g === group).length), [11, 7, 5, 6, 8, 7, 6, 10, 6]);
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

const corpus = NODES.map((node) => node.d).concat(JOURNEY.map((step) => step.t)).join("\n");
for (const phrase of [
  "يحوي كل ما يمكن معرفته احتماليا",
  "لكنه نادر تماما في الواقع",
  "لتكسر الانفجار الاسي",
  "اكفا خوارزمية استدلال دقيق عامة",
  "دقيق تماما على الرسوم الشجرية وحدها",
  "يستعمل كل العينات فيكون اكفا من الرفض",
  "حتى التقارب",
  "ويقاوم فرط التخصيص",
  "تحسب الفعل الامثل آليا",
  "شريط ثقة يتسع بعيدا عن البيانات",
  "قاد اپولو الى القمر",
  "وهو في كل GPS وروبوت وطائرة",
]) assert.ok(!corpus.includes(phrase), `بقي ادعاء مطلق او مضلل: ${phrase}`);

for (const phrase of [
  "كون الاحتمال لا يتجاوز 1 فهو نتيجة",
  "الشرط على المصب او احد ابنائه قد يفتح المسار",
  "اكبر عامل وسيط تحدده بنية الرسم وترتيب الحذف",
  "قد يتقارب الى تقريب مفيد او يتذبذب",
  "والعينات مترابطة وليست سحبات مستقلة",
  "لا تنقص الارجحية المرصودة عند تنفيذ الخطوتين بدقة",
  "يصبح فضاء الاعتقاد مستمرا",
  "لا تنجح لكل رسم واستعلام",
]) assert.ok(corpus.includes(phrase), `تصحيح علمي مفقود: ${phrase}`);

const linksMatch = build.match(/const XLINKS_PROB = (\[[\s\S]*?\n\]);/);
assert.ok(linksMatch, "تعذر استخراج علاقات عالم الذكاء الاحتمالي");
const links = vm.runInNewContext(`(${linksMatch[1]})`);
assert.equal(links.length, 18);
assert.ok(links.some(([a, b, type]) => a === "d-separation" && b === "conditional-independence" && type === "method"));

const srcMatch = template.match(/const SRC_PROB = (\{[\s\S]*?\n\});\n\/\* عالم التاريخ/);
assert.ok(srcMatch, "تعذر استخراج لوحة مصادر الذكاء الاحتمالي");
const src = vm.runInNewContext(`(${srcMatch[1]})`);
const items = src.topics.flatMap((topic) => topic.items);
assert.equal(items.length, 20, "يجب حفظ المواد الاصلية الاحدى عشرة مع الاضافات التسع");
for (const url of [
  "https://www.youtube.com/watch?v=HZGCoVF3YvM",
  "https://www.youtube.com/watch?v=IFeCIbljreY",
  "https://cs228.stanford.edu/",
  "https://www.youtube.com/watch?v=iNm4nFBFmvo",
  "https://mitpress.mit.edu/9780262013192/probabilistic-graphical-models/",
  "https://doi.org/10.1098/rstl.1763.0053",
  "https://doi.org/10.1115/1.3662552",
  "https://doi.org/10.1093/biomet/57.1.97",
  "https://doi.org/10.1109/5.18626",
  "https://proceedings.mlr.press/r0/pearl95a.html",
  "https://www.cambridge.org/core/books/causality/B0046844FAE10CBF274D4ACBDAEB5F5B",
]) assert.ok(items.some((item) => item.url === url || item.link === url), `مصدر اصلي مفقود: ${url}`);

const additions = vm.runInNewContext(`(${template.match(/const ACADEMIC_SOURCE_ADDITIONS = (\{[\s\S]*?\n\});/)[1]})`);
assert.equal(additions["الذكاء الاحتمالي"].length, 13);
assert.equal(Object.values(additions).flat().length, 123);

for (const name of ["ai-how-ai-works.html"]) {
  const output = fs.readFileSync(new URL(`../pages/${name}`, import.meta.url), "utf8");
  assert.ok(output.includes("الشرط على المصب او احد ابنائه قد يفتح المسار"), `${name}: تصحيح d-separation مفقود`);
  assert.ok(output.includes("لا تنجح لكل رسم واستعلام"), `${name}: حدود do-calculus مفقودة`);
  assert.ok(output.includes("Variational Inference: A Review for Statisticians"), `${name}: مراجع العالم الجديدة مفقودة`);
  assert.ok(output.includes("const SRC_PROB ="), `${name}: لوحة مصادر العالم مفقودة`);
}

console.log("Probabilistic AI deep review: 67 nodes, 9 groups, 11 journey steps, 18 cross-links, sources and academic additions verified.");
