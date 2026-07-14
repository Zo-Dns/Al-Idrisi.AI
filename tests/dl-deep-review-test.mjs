import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { GROUPS, NODES, JOURNEY } from "../src/content/dl-content.mjs";

const templatePath = new URL("../src/templates/atlas-template.html", import.meta.url);
const template = fs.readFileSync(templatePath, "utf8");

assert.equal(GROUPS.length, 11, "يجب أن يضم عالم التعلم العميق 11 مجموعة");
assert.equal(NODES.length, 87, "يجب أن يضم عالم التعلم العميق 87 عقدة");
assert.equal(JOURNEY.length, 27, "يجب أن تضم رحلة التعلم العميق 27 خطوة");

const keys = new Set(NODES.map((node) => node.k));
assert.equal(keys.size, NODES.length, "مفاتيح العقد يجب أن تكون فريدة");
for (const node of NODES) {
  assert.ok(typeof node.d === "string" && node.d.trim(), `وصف مفقود: ${node.k}`);
  assert.ok(node.g === -1 || (node.g >= 0 && node.g < GROUPS.length), `مجموعة غير صالحة: ${node.k}`);
  if (node.p !== null) assert.ok(keys.has(node.p), `أب مفقود للعقدة ${node.k}: ${node.p}`);
}
for (const step of JOURNEY) {
  assert.ok(keys.has(step.k), `عقدة رحلة مفقودة: ${step.k}`);
  assert.ok(typeof step.t === "string" && step.t.trim(), `نص رحلة مفقود: ${step.k}`);
  for (const rel of step.rel || []) assert.ok(keys.has(rel), `علاقة رحلة مفقودة ${step.k} -> ${rel}`);
}

const groupCounts = NODES.filter((node) => node.g >= 0).reduce((counts, node) => {
  counts[node.g] = (counts[node.g] || 0) + 1;
  return counts;
}, {});
assert.deepEqual(Object.values(groupCounts), [7, 9, 16, 8, 7, 6, 6, 9, 7, 5, 6]);

const corpus = NODES.map((node) => node.d).concat(JOURNEY.map((step) => step.t)).join("\n");
for (const phrase of [
  "اهم معامل ضبط في التدريب",
  "قليل الحساسية للضبط",
  "كل حسابات الشبكة عمليات على الموترات",
  "تعالج التسلسل كله بالتوازي",
  "فيصير مولدا حقيقيا",
  "الاختبار (يفتح مرة واحدة في النهاية) لقياس الاداء الحقيقي",
  "كله مبني على معماريات التعلم العميق",
  "صار مكونا في كل مكان تقريبا",
  "مصفوفات يعقوبية عبر طبقات",
  "النتائج وجودية",
  "مقربا للبعدي",
  "التحول التغايري الداخلي المقترح اصلا",
]) assert.ok(!corpus.includes(phrase), `بقي ادعاء مطلق ممنوع: ${phrase}`);

const srcMatch = template.match(/const SRC_DL = (\{[\s\S]*?\n\});\nconst SRC_LLM/);
assert.ok(srcMatch, "تعذر قراءة مصادر التعلم العميق");
const srcDl = vm.runInNewContext(`(${srcMatch[1]})`);
const sourceItems = srcDl.topics.flatMap((topic) => topic.items);
assert.equal(sourceItems.length, 16, "مصادر التعلم العميق: 7 أصلية + 9 إضافات أكاديمية");
for (const url of [
  "https://www.youtube.com/watch?v=aircAruvnKk",
  "https://www.youtube.com/watch?v=IHZwWFHWa-w",
  "https://introtodeeplearning.com/",
  "https://arxiv.org/abs/1706.03762",
  "https://papers.neurips.cc/paper/5423-generative-adversarial-nets",
  "https://proceedings.neurips.cc/paper/2020/hash/4c5bcfec8584af0d967f1ab10179ca4b-Abstract.html",
  "https://www.youtube.com/watch?v=VsnQf7exv5I",
]) assert.ok(sourceItems.some((item) => item.url === url || item.link === url), `مصدر أصلي مفقود: ${url}`);

const additionsMatch = template.match(/const ACADEMIC_SOURCE_ADDITIONS = (\{[\s\S]*?\n\});/);
assert.ok(additionsMatch, "إضافات المكتبة الأكاديمية مفقودة من القالب المصدر");
const additions = vm.runInNewContext(`(${additionsMatch[1]})`);
assert.equal(additions["التعلم العميق"].length, 12, "يجب إضافة 12 مرجعا أكاديميا لعالم التعلم العميق");
assert.equal(Object.values(additions).flat().length, 123, "يجب حفظ إضافات المراحل السابقة مع إضافات ML الجديدة");

for (const outputName of ["ai-how-ai-works.html"]) {
  const outputPath = new URL(`../pages/${outputName}`, import.meta.url);
  const output = fs.readFileSync(outputPath, "utf8");
  assert.ok(output.includes("كثرة الطبقات لا تضمن نتيجة افضل"), `${outputName}: شرح التعلم العميق الواضح مفقود`);
  assert.ok(output.includes("Approximation by Superpositions of a Sigmoidal Function"), `${outputName}: المصدر الأكاديمي الجديد مفقود`);
  assert.ok(output.includes("const ACADEMIC_SOURCE_ADDITIONS ="), `${outputName}: إضافات المكتبة مفقودة`);
}

console.log("DL deep review: 87 nodes, 11 groups, 27 journey steps, source preservation and additions verified.");
