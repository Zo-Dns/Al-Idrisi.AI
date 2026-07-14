import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { GROUPS, NODES, JOURNEY } from "../src/content/classic-content.mjs";

const template = fs.readFileSync(new URL("../src/templates/atlas-template.html", import.meta.url), "utf8");
assert.equal(GROUPS.length, 9);
assert.equal(NODES.length, 79);
assert.equal(JOURNEY.length, 13);

const keys = new Set(NODES.map((node) => node.k));
assert.equal(keys.size, NODES.length, "يجب ان يكون مفتاح كل عقدة فريدا");
assert.deepEqual([...Array(9)].map((_, group) => NODES.filter((node) => node.g === group).length), [17, 6, 9, 7, 10, 9, 6, 7, 7]);
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
  "مع استرشاد متسق هي الاكفا",
  "فيلعب الحاسوب الطاولة (باكغامون) امثليا",
  "قاعدة استنتاج وحيدة كاملة لمنطق الرتبة الاولى",
  "يحل مسالة الوزيرات لملايين الوزراء",
  "اول تطبيق واسع مربح للذكاء الاصطناعي",
  "اول نظام خبير",
  "قوة احدهما ضعف الآخر",
  "يعد «الموجة الثالثة» للذكاء الاصطناعي",
  "العلة العميقة خلف شتاءي الذكاء",
]) assert.ok(!corpus.includes(phrase), `بقي ادعاء مطلق او مضلل: ${phrase}`);

for (const phrase of [
  "اكتمال BFS يحتاج تفرعا محدودا",
  "اتساقا او اعادة فتح صحيحة للعقد",
  "ليس اجراء قرار ينتهي لكل صيغة",
  "الفشل في العثور على نموذج لا يثبت",
  "فرضية تجريبية لا مبرهنة منطقية",
  "عدة عوامل تقنية وسوقية لا عن XCON وحده",
]) assert.ok(corpus.includes(phrase), `تصحيح علمي مفقود: ${phrase}`);

const srcMatch = template.match(/const SRC_CLASSIC = (\{[\s\S]*?\n\});\nconst SRC_RL/);
assert.ok(srcMatch, "تعذر استخراج لوحة مصادر الذكاء الرمزي الكلاسيكي");
const src = vm.runInNewContext(`(${srcMatch[1]})`);
const items = src.topics.flatMap((topic) => topic.items);
assert.equal(items.length, 18, "يجب حفظ المواد الاصلية الاحدى عشرة مع الاضافات السبع");
for (const url of [
  "https://www.youtube.com/watch?v=ySN5Wnu88nE",
  "https://www.youtube.com/watch?v=WHCo4m2VOws",
  "https://aima.cs.berkeley.edu/",
  "https://www.youtube.com/watch?v=leXa7EKUPFk",
  "https://doi.org/10.1109/TSSC.1968.300136",
  "https://doi.org/10.1080/14786445008521796",
  "https://doi.org/10.1016/0004-3702(71)90010-5",
  "https://doi.org/10.1145/321250.321253",
  "https://doi.org/10.1016/0004-3702(82)90021-2",
  "https://cdn.aaai.org/AAAI/1994/AAAI94-021.pdf",
  "https://doi.org/10.1002/aaai.12036",
]) assert.ok(items.some((item) => item.url === url || item.link === url), `مصدر اصلي مفقود: ${url}`);

const additions = vm.runInNewContext(`(${template.match(/const ACADEMIC_SOURCE_ADDITIONS = (\{[\s\S]*?\n\});/)[1]})`);
assert.equal(additions["الذكاء الرمزي الكلاسيكي"].length, 10);
assert.equal(Object.values(additions).flat().length, 123);

for (const name of ["ai-how-ai-works.html"]) {
  const output = fs.readFileSync(new URL(`../pages/${name}`, import.meta.url), "utf8");
  assert.ok(output.includes("ليس اجراء قرار ينتهي لكل صيغة"), `${name}: تصحيح الحسم مفقود`);
  assert.ok(output.includes("فرضية تجريبية لا مبرهنة منطقية"), `${name}: تصحيح فرضية الرموز مفقود`);
  assert.ok(output.includes("Generalized Best-First Search Strategies and the Optimality of A*"), `${name}: مراجع العالم الجديدة مفقودة`);
  assert.ok(output.includes("const SRC_CLASSIC ="), `${name}: لوحة مصادر العالم مفقودة`);
}

console.log("Classical symbolic AI deep review: 79 nodes, 9 groups, 13 journey steps, 19 cross-links, sources and academic additions verified.");
