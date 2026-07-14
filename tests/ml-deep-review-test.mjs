import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { GROUPS, NODES, JOURNEY } from "../src/content/ml-content.mjs";

const template = fs.readFileSync(new URL("../src/templates/atlas-template.html", import.meta.url), "utf8");
assert.equal(GROUPS.length, 8);
assert.equal(NODES.length, 75);
assert.equal(JOURNEY.length, 15);
const keys = new Set(NODES.map((node) => node.k));
assert.equal(keys.size, 75);
assert.equal(
  NODES.find((node) => node.k === "ethics")?.rn,
  "سياق معياري يوضح حدود الاستخدام والمسؤولية والانصاف والخصوصية",
  "يجب أن تبقى علاقة الحدود والأخلاق واضحة للقارئ"
);
assert.equal(
  NODES.find((node) => node.k === "landscape")?.rn,
  "سياق تاريخي ومقارن لمجال تعلم الآلة",
  "يجب أن تبقى علاقة محطات المجال واضحة للقارئ"
);
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
assert.deepEqual([...Array(8)].map((_, group) => NODES.filter((node) => node.g === group).length), [9, 10, 12, 13, 8, 9, 5, 8]);

const corpus = NODES.map((node) => node.d).concat(JOURNEY.map((step) => step.t)).join("\n");
for (const phrase of [
  "جودة الميزات غالبا اهم من الخوارزمية نفسها",
  "مرحلتان في كل انواع التعلم",
  "شفافة وقابلة للتفسير تماما",
  "اختبار (يفتح مرة واحدة اخيرا) لقياس الاداء الحقيقي",
  "كل مرة طية للاختبار",
  "يحتاج التعميم بيانات تنمو اسيا",
  "تصفر ميزات فتنتقيها",
  "المعيار الفعلي للتعليم والبحث والصناعة",
  "تعريف مجاورة",
  "التنبؤ المراقب من بيانات رصدية يقدر علاقات احصائية",
  "ليس المجال عاجزا عن الاسباب تعريفيا",
  "تحت ميزانية وتعريف مجاورة",
]) assert.ok(!corpus.includes(phrase), `بقي ادعاء مطلق: ${phrase}`);

const srcMatch = template.match(/const SRC_ML = (\{[\s\S]*?\n\});\nconst SRC_DATA/);
assert.ok(srcMatch, "تعذر استخراج لوحة مصادر تعلم الآلة");
const src = vm.runInNewContext(`(${srcMatch[1]})`);
const items = src.topics.flatMap((topic) => topic.items);
assert.equal(items.length, 7, "يجب حفظ مواد لوحة تعلم الآلة السبعة");
for (const url of [
  "https://www.youtube.com/watch?v=9gGnTQTYNaE",
  "https://www.youtube.com/watch?v=Gv9_4yMHFhI",
  "https://www.deeplearningbook.org/contents/ml.html",
  "https://www.incompleteideas.net/book/bookdraft2018mar21.pdf",
  "https://cs229.stanford.edu/",
  "https://scikit-learn.org/stable/model_selection.html",
  "https://www.youtube.com/watch?v=UzxYlbK2c7E",
]) assert.ok(items.some((item) => item.url === url || item.link === url), `مصدر اصلي مفقود: ${url}`);

const additions = vm.runInNewContext(`(${template.match(/const ACADEMIC_SOURCE_ADDITIONS = (\{[\s\S]*?\n\});/)[1]})`);
assert.equal(additions["تعلم الآلة"].length, 12);
assert.equal(Object.values(additions).flat().length, 123);

for (const name of ["ai-how-ai-works.html"]) {
  const output = fs.readFileSync(new URL(`../pages/${name}`, import.meta.url), "utf8");
  assert.ok(output.includes("قد يتعلم النموذج ان شيئين يحدثان معا"), `${name}: شرح السببية المبسط مفقود`);
  assert.ok(output.includes("تقلل الخصوصية التفاضلية الخطر بضوضاء محسوبة"), `${name}: شرح الخصوصية المبسط مفقود`);
  assert.ok(output.includes("Bias in Error Estimation When Using Cross-Validation"), `${name}: مراجع ML الجديدة مفقودة`);
  assert.ok(output.includes("const SRC_ML ="), `${name}: لوحة مصادر ML مفقودة`);
}

console.log("ML deep review: 75 nodes, 8 groups, 15 journey steps, sources and academic additions verified.");
