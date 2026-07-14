import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JOURNEY, JOURNEY_SOURCES, NODES } from "./ai-content.mjs";

const EXPECTED_SEQUENCE = [
  "root", "classic", "ml", "data", "prob", "nn", "dl",
  "transformer", "llm", "genai", "agents", "apps", "history", "ethics"
];
const EXPECTED_MAIN_GROUPS = [
  "ml", "data", "nn", "dl", "llm", "agents",
  "apps", "history", "ethics", "genai", "classic", "prob"
];
const ALLOWED_SOURCE_KINDS = new Set(["book", "paper", "primary", "official"]);
const REVIEWED_BUTTON = "🪐 ابدأ الجولة الكبرى: من أسس الذكاء الاصطناعي إلى تطبيقاته ومسؤوليته";

const nodeByKey = new Map(NODES.map((node) => [node.k, node]));
assert.equal(nodeByKey.size, NODES.length, "مفاتيح الخريطة الأم يجب أن تكون فريدة");
assert.deepEqual(JOURNEY.map((step) => step.k), EXPECTED_SEQUENCE, "تسلسل الجولة الكبرى تغير دون مراجعة");
assert.equal(new Set(JOURNEY.map((step) => step.k)).size, JOURNEY.length, "خطوات الجولة الكبرى مكررة");

const coveredMainGroups = JOURNEY
  .map((step) => step.k)
  .filter((key) => EXPECTED_MAIN_GROUPS.includes(key))
  .sort();
assert.deepEqual(coveredMainGroups, [...EXPECTED_MAIN_GROUPS].sort(), "الجولة لا تغطي كل المجموعات الرئيسية الاثنتي عشرة");
assert.equal(nodeByKey.get("transformer")?.p, "dl", "المحول يجب أن يبقى جسرا تقنيا داخل التعلم العميق");

for (const step of JOURNEY) {
  assert.ok(nodeByKey.has(step.k), `عقدة خطوة مجهولة: ${step.k}`);
  assert.ok(typeof step.t === "string" && step.t.trim().length >= 80, `نص ناقص أو غير تعليمي: ${step.k}`);
  assert.ok(Array.isArray(step.rel) && step.rel.length >= 3, `روابط مفاهيمية ناقصة: ${step.k}`);
  assert.ok(step.rel.every((key) => nodeByKey.has(key)), `رابط إلى عقدة مجهولة: ${step.k}`);
  assert.ok(Array.isArray(step.src) && step.src.length >= 2, `تحتاج الخطوة مصدرين مستقلين على الأقل: ${step.k}`);
  assert.equal(new Set(step.src).size, step.src.length, `مصدر مكرر داخل الخطوة: ${step.k}`);
  for (const sourceKey of step.src) assert.ok(JOURNEY_SOURCES[sourceKey], `مصدر مجهول ${sourceKey} في ${step.k}`);
}

const template = readFileSync(new URL("./atlas-template.html", import.meta.url), "utf8");
const usedSources = new Set(JOURNEY.flatMap((step) => step.src));
for (const [key, source] of Object.entries(JOURNEY_SOURCES)) {
  assert.ok(usedSources.has(key), `مصدر غير مستخدم في توثيق الجولة: ${key}`);
  assert.ok(source.author && Number.isInteger(source.year) && source.title, `بيانات ببليوغرافية ناقصة: ${key}`);
  assert.ok(ALLOWED_SOURCE_KINDS.has(source.kind), `نوع مصدر غير أكاديمي أو أولي: ${key}`);
  assert.match(source.url, /^https:\/\//, `رابط المصدر غير آمن أو غير ثابت: ${key}`);
  assert.ok(template.includes(source.title), `مصدر الجولة غير موجود في المكتبة الأكاديمية الحية وإضافاتها: ${source.title}`);
}

const journeyCorpus = JOURNEY.map((step) => step.t).join("\n");
for (const dubbedName of [
  "الفاغو", "ألفاغو", "ديب بلو", "شات جي بي تي", "أليكس نت", "اليكس نت"
]) assert.ok(!journeyCorpus.includes(dubbedName), `اسم رسمي مدبلج في الجولة: ${dubbedName}`);
for (const officialName of ["AlexNet", "Deep Blue", "AlphaGo", "ChatGPT"])
  assert.ok(journeyCorpus.includes(officialName), `الاسم الرسمي مفقود من الجولة: ${officialName}`);

assert.ok(JOURNEY.find((step) => step.k === "transformer").t.includes("التوليد ذاتي الانحدار فيبقى متسلسلا"), "قيد التوازي في المحول مفقود");
assert.ok(JOURNEY.find((step) => step.k === "llm").t.includes("لا تضمنان صحة المعلومة"), "قيد الطلاقة والصحة في LLM مفقود");
assert.ok(JOURNEY.find((step) => step.k === "agents").t.startsWith("الوكيل نظام يدرك معلومات عن بيئته"), "تعريف الوكيل المباشر مفقود");
assert.ok(JOURNEY.find((step) => step.k === "history").t.includes("ليست تاريخا خطيا"), "قيد السرد التاريخي مفقود");
assert.ok(JOURNEY.find((step) => step.k === "ethics").t.includes("طوال دورة حياتها"), "منظور دورة الحياة للمخاطر مفقود");

for (const file of ["atlas-template.html", "ai-network-template.html"]) {
  const content = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
  assert.ok(content.includes(REVIEWED_BUTTON), `${file}: عنوان الجولة الكبرى المصحح مفقود`);
  assert.ok(!content.includes("عوالم الذكاء الاصطناعي من التعلم الى المسؤولية"), `${file}: العنوان القديم عاد`);
}
for (const file of ["ai-how-ai-works.html"]) {
  const content = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
  assert.ok(content.includes(REVIEWED_BUTTON), `${file}: عنوان الجولة الكبرى المصحح مفقود`);
  assert.ok(!content.includes("عوالم الذكاء الاصطناعي من التعلم الى المسؤولية"), `${file}: العنوان القديم عاد`);
  for (const step of JOURNEY) assert.ok(content.includes(step.t), `${file}: نص خطوة غير مشحون: ${step.k}`);
}

const readme = readFileSync(new URL("./README.md", import.meta.url), "utf8");
assert.ok(readme.includes("جولة كبرى من 14 خطوة"), "README لا يوثق العدد الحالي للجولة بصياغة موجزة");
assert.ok(!readme.includes("جولة كبرى من 12 خطوة"), "README ما زال يوثق العدد القديم للجولة");

console.log(`AI mother journey review: ${JOURNEY.length} steps, ${EXPECTED_MAIN_GROUPS.length} main groups, ${usedSources.size} documented academic/primary sources verified.`);
