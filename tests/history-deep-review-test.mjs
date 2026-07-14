import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { GROUPS, NODES, JOURNEY } from "../src/content/history-content.mjs";

const template = fs.readFileSync(new URL("../src/templates/atlas-template.html", import.meta.url), "utf8");
const build = fs.readFileSync(new URL("../scripts/atlas-build.mjs", import.meta.url), "utf8");
assert.equal(GROUPS.length, 9);
assert.equal(NODES.length, 80);
assert.equal(JOURNEY.length, 17);

const keys = new Set(NODES.map((node) => node.k));
assert.equal(keys.size, NODES.length, "يجب ان يكون مفتاح كل عقدة فريدا");
assert.deepEqual([...Array(9)].map((_, group) => NODES.filter((node) => node.g === group).length), [9, 8, 9, 6, 8, 8, 11, 9, 11]);
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
  "قصة سبعة عقود",
  "كتبت آدا لوفليس اول خوارزمية",
  "يعد اول برنامج ذكاء اصطناعي",
  "اول نظام خبير على الاطلاق",
  "اطفا الكتاب حماسة ابحاث الشبكات",
  "الشرارة المباشرة للشتاء الثاني",
  "سحقت منافسيها",
  "شرط خفي لكل ما تلاه",
  "حتى فاق البشر في كثير منها",
  "صارت اساس كل النماذج اللغوية الكبيرة",
  "برهن على قوانين التوسع",
  "حل نظام DeepMind مشكلة طي البروتين",
  "بلغت مئة مليون مستخدم",
  "اعتراف علمي على اعلى مستوى بنضج المجال",
]) assert.ok(!corpus.includes(phrase), `بقي ادعاء مطلق او مضلل: ${phrase}`);

for (const phrase of [
  "تقسيمه الى عصور وسنوات اداة شرح",
  "يناقشون معنى هذه الاسبقية",
  "فرضية تجريبية مستخلصة من برنامج بحث",
  "المؤرخين يناقشون حجم اثره",
  "لا شرارة وحيدة في سنة واحدة",
  "لا برهانا عاما على نجاح اللعب الذاتي",
  "لا لكل نموذج لغوي او توليدي",
  "لا تحل ديناميكا الطي",
  "لم تسم الجوائز «جوائز ذكاء اصطناعي»",
]) assert.ok(corpus.includes(phrase), `تصحيح تاريخي مفقود: ${phrase}`);

const linksMatch = build.match(/const XLINKS_HISTORY = (\[[\s\S]*?\n\]);/);
assert.ok(linksMatch, "تعذر استخراج علاقات عالم التاريخ");
const links = vm.runInNewContext(`(${linksMatch[1]})`);
assert.equal(links.length, 14);
assert.ok(links.some(([a, b, type]) => a === "perceptron" && b === "backprop-1986" && type === "hist"));
assert.ok(links.some(([a, b, type]) => a === "eliza" && b === "chatgpt" && type === "peer"));
assert.ok(!links.some(([a, b]) => a === "perceptrons-book" && b === "backprop-1986"));

const srcMatch = template.match(/const SRC_HISTORY = (\{[\s\S]*?\n\});\nconst SOURCES_BY_GROUP/);
assert.ok(srcMatch, "تعذر استخراج لوحة مصادر تاريخ الذكاء الاصطناعي");
const src = vm.runInNewContext(`(${srcMatch[1]})`);
const items = src.topics.flatMap((topic) => topic.items);
assert.equal(items.length, 21, "يجب حفظ المواد الاصلية السبع مع الاضافات الاربع عشرة");
for (const url of [
  "http://ai.stanford.edu/~nilsson/QAI/qai.pdf",
  "http://www-formal.stanford.edu/jmc/history/dartmouth/dartmouth.html",
  "https://academic.oup.com/mind/article/LIX/236/433/986238",
  "https://www.nature.com/articles/323533a0",
  "https://arxiv.org/abs/1706.03762",
  "https://aima.cs.berkeley.edu/",
  "https://plato.stanford.edu/entries/artificial-intelligence/",
]) assert.ok(items.some((item) => item.link === url), `مصدر اصلي مفقود: ${url}`);

const additions = vm.runInNewContext(`(${template.match(/const ACADEMIC_SOURCE_ADDITIONS = (\{[\s\S]*?\n\});/)[1]})`);
assert.equal(additions["تاريخ الذكاء الاصطناعي"].length, 10);
assert.equal(Object.values(additions).flat().length, 123);

for (const name of ["ai-how-ai-works.html"]) {
  const output = fs.readFileSync(new URL(`../pages/${name}`, import.meta.url), "utf8");
  assert.ok(output.includes("تقسيمه الى عصور وسنوات اداة شرح"), `${name}: حد السرد التاريخي مفقود`);
  assert.ok(output.includes("لم تسم الجوائز «جوائز ذكاء اصطناعي»"), `${name}: تصحيح نوبل مفقود`);
  assert.ok(output.includes("Ada Lovelace and the Analytical Engine"), `${name}: مراجع العالم الجديدة مفقودة`);
  assert.ok(output.includes("const SRC_HISTORY ="), `${name}: لوحة مصادر العالم مفقودة`);
}

console.log("AI history deep review: 80 nodes, 9 groups, 17 journey steps, 14 cross-links, sources and academic additions verified.");
