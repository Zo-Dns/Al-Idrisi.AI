import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { GROUPS, NODES, JOURNEY } from "./llm-content.mjs";

const template = fs.readFileSync(new URL("./atlas-template.html", import.meta.url), "utf8");
assert.equal(GROUPS.length, 10);
assert.equal(NODES.length, 82);
assert.equal(JOURNEY.length, 23);
const keys = new Set(NODES.map((node) => node.k));
assert.equal(keys.size, 82, "مفاتيح عقد LLM يجب ان تكون فريدة");
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
const counts = [...Array(GROUPS.length)].map((_, group) => NODES.filter((node) => node.g === group).length);
assert.deepEqual(counts, [6, 6, 12, 8, 14, 5, 9, 9, 8, 4]);

const corpus = NODES.map((node) => node.d).concat(JOURNEY.map((step) => step.t)).join("\n");
for (const phrase of [
  "تقوم عليها كل النماذج اللغوية الحديثة",
  "التوازي الكامل",
  "اهم سلاح عملي ضد الهلوسة",
  "المعيار الفعلي في تدريب النماذج اللغوية",
  "كلما «فكر» اطول ارتفعت دقته",
  "خسارة جودة ضئيلة",
  "هي الذاكرة المضغوطة لكل ما تعلمه النموذج",
  "سببها الجوهري في صميم التصميم",
  "قد تحسن elicitation",
  "اسقاطات متعلمة تنتج مصفوفات الاستعلام",
  "هدف تفضيل مقيد مرجعيا كخسارة تصنيف",
  "مقربا للبعدي",
]) assert.ok(!corpus.includes(phrase), `بقي ادعاء مطلق: ${phrase}`);

const srcMatch = template.match(/const SRC_LLM = (\{[\s\S]*?\n\});\nconst SRC_AGENTS/);
assert.ok(srcMatch, "تعذر استخراج لوحة مصادر LLM");
const src = vm.runInNewContext(`(${srcMatch[1]})`);
const items = src.topics.flatMap((topic) => topic.items);
assert.equal(items.length, 13, "يجب حفظ مواد لوحة LLM الثلاث عشرة");
for (const url of [
  "https://www.youtube.com/watch?v=wjZofJX0v4M",
  "https://www.youtube.com/watch?v=KJtZARuO3JY",
  "https://www.youtube.com/watch?v=zxQyTK8quyY",
  "https://web.stanford.edu/class/cs224n/",
  "https://www.youtube.com/watch?v=zjkBMFhNj_g",
]) assert.ok(items.some((item) => item.url === url || item.link === url), `مصدر اصلي مفقود: ${url}`);

const additionsMatch = template.match(/const ACADEMIC_SOURCE_ADDITIONS = (\{[\s\S]*?\n\});/);
assert.ok(additionsMatch);
const additions = vm.runInNewContext(`(${additionsMatch[1]})`);
assert.equal(additions["النماذج اللغوية الكبيرة"].length, 18, "تغطية LLM الاكاديمية: 6 سابقة + 12 جديدة");
assert.equal(Object.values(additions).flat().length, 123, "يجب حفظ كل اضافات المراحل السابقة والجديدة");

for (const name of ["ai-how-ai-works.html"]) {
  const output = fs.readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
  assert.ok(output.includes("احتمال الرمز لا يساوي احتمال ان تكون الجملة كلها صحيحة"), `${name}: شرح احتمالات LLM الواضح مفقود`);
  assert.ok(output.includes("Extracting Training Data from Large Language Models"), `${name}: مراجع LLM الجديدة مفقودة`);
  assert.ok(output.includes("const SRC_LLM ="), `${name}: لوحة مصادر LLM مفقودة`);
}

console.log("LLM deep review: 82 nodes, 10 groups, 23 journey steps, sources and academic additions verified.");
