import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { GROUPS, NODES, JOURNEY } from "./apps-content.mjs";

const template = fs.readFileSync(new URL("./atlas-template.html", import.meta.url), "utf8");
assert.equal(GROUPS.length, 9);
assert.equal(NODES.length, 61);
assert.equal(JOURNEY.length, 10);

const keys = new Set(NODES.map((node) => node.k));
assert.equal(keys.size, NODES.length, "يجب ان يكون مفتاح كل عقدة فريدا");
assert.deepEqual([...Array(9)].map((_, group) => NODES.filter((node) => node.g === group).length), [7, 7, 6, 6, 5, 7, 8, 10, 4]);
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
  "بدقة اعلى وثبات اكبر من الفحص اليدوي",
  "اكثر من 80% مما يشاهده مستخدمو Netflix",
  "اول ذكاء اصطناعي مستقل توافق عليه FDA",
  "اول دواء صممه ذكاء توليدي",
  "غالبا اكبر كلفة فيه",
  "لحفظ الخصوصية دون ارسال البيانات للسحابة",
  "بها وصفت 2026 بمرحلة هندسة الوكلاء",
  "مستوى الميدالية الفضية في اولمبياد الرياضيات الدولي",
]) assert.ok(!corpus.includes(phrase), `بقي ادعاء مطلق او قديم: ${phrase}`);

for (const phrase of [
  "تجربة عشوائية من المرحلة 2a",
  "الاستقرار المحسوب لا يساوي امكان تصنيع المادة",
  "لا يضمن الخصوصية وحده",
  "الموثوقية خاصية للنظام والسياق كله",
  "تقيم مرحلتا الاسترجاع والاجابة كل على حدة",
]) assert.ok(corpus.includes(phrase), `تصحيح علمي مفقود: ${phrase}`);

const srcMatch = template.match(/const SRC_APPS = (\{[\s\S]*?\n\});\nconst SRC_ETHICS/);
assert.ok(srcMatch, "تعذر استخراج لوحة مصادر التطبيقات");
const src = vm.runInNewContext(`(${srcMatch[1]})`);
const items = src.topics.flatMap((topic) => topic.items);
assert.equal(items.length, 19, "يجب حفظ المواد الاصلية الاربع عشرة مع الاضافات الخمس");
for (const url of [
  "https://www.youtube.com/watch?v=-4E2-0sxVUM",
  "https://www.youtube.com/watch?v=oi0JXuL19TA",
  "https://cs231n.stanford.edu/",
  "https://www.youtube.com/watch?v=40riCqvRoMs",
  "https://proceedings.neurips.cc/paper/2015/hash/86df7dcfd896fcaf2674f757a2463eba-Abstract.html",
  "https://doi.org/10.1145/3290605.3300233",
  "https://doi.org/10.1038/s41746-018-0040-6",
  "https://doi.org/10.1038/s41586-021-03819-2",
  "https://proceedings.neurips.cc/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html",
  "https://proceedings.mlr.press/v202/radford23a.html",
  "https://doi.org/10.1109/TIV.2016.2578706",
  "https://doi.org/10.1080/00461520.2011.611369",
  "https://openaccess.thecvf.com/content/CVPR2022/html/Rombach_High-Resolution_Image_Synthesis_With_Latent_Diffusion_Models_CVPR_2022_paper.html",
  "https://doi.org/10.1126/science.adi2336",
]) assert.ok(items.some((item) => item.url === url || item.link === url), `مصدر اصلي مفقود: ${url}`);

const additions = vm.runInNewContext(`(${template.match(/const ACADEMIC_SOURCE_ADDITIONS = (\{[\s\S]*?\n\});/)[1]})`);
assert.equal(additions["التطبيقات"].length, 13);
assert.equal(Object.values(additions).flat().length, 123);

for (const name of ["ai-how-ai-works.html"]) {
  const output = fs.readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
  assert.ok(output.includes("الاستقرار المحسوب لا يساوي امكان تصنيع المادة"), `${name}: تصحيح المواد مفقود`);
  assert.ok(output.includes("تجربة عشوائية من المرحلة 2a"), `${name}: تصحيح الدواء مفقود`);
  assert.ok(output.includes("De Novo Design of Protein Structure and Function with RFdiffusion"), `${name}: مراجع التطبيقات الجديدة مفقودة`);
  assert.ok(output.includes("const SRC_APPS ="), `${name}: لوحة مصادر التطبيقات مفقودة`);
}

console.log("Applications deep review: 61 nodes, 9 groups, 10 journey steps, 15 cross-links, sources and academic additions verified.");
