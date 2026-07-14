import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { GROUPS, NODES, JOURNEY } from "../src/content/rl-content.mjs";

const template = fs.readFileSync(new URL("../src/templates/atlas-template.html", import.meta.url), "utf8");
const build = fs.readFileSync(new URL("../scripts/atlas-build.mjs", import.meta.url), "utf8");
const formalNamingCorpus = [
  "../src/content/ai-content.mjs", "../src/content/rl-content.mjs", "../src/content/history-content.mjs", "../src/content/dl-content.mjs", "../src/content/classic-content.mjs",
  "../scripts/make-atlas.mjs", "../src/templates/atlas-template.html", "../src/templates/ai-network-template.html",
  "../src/labs/rl-lab.html", "../src/labs/rl-lab.js", "../README.md", "../docs/academic/ACADEMIC_REVIEW_CHECKLIST.md"
].map((name) => fs.readFileSync(new URL(name, import.meta.url), "utf8")).join("\n");
for (const dubbedName of ["الفاغو", "ألفاغو", "ألفا غو", "الفا غو"])
  assert.ok(!formalNamingCorpus.includes(dubbedName), `يجب إبقاء الاسم AlphaGo بالإنجليزية: ${dubbedName}`);
assert.ok(!formalNamingCorpus.includes("تعلم Q"), "يجب إبقاء اسم الخوارزمية Q-Learning بالإنجليزية");
for (const dubbedName of [
  "الفازيرو", "ألفازيرو", "تي دي-غامون", "ديب بلو", "شات جي بي تي",
  "أليكس نت", "اليكس نت", "وورد2فيك", "2020 جي بي تي", "2023 جي بي تي",
  "ألفافولد 2", "الفافولد 2", "2018 بيرت", "2011 واتسون", "ايمج نت"
]) assert.ok(!formalNamingCorpus.includes(dubbedName), `اسم رسمي مدبلج يجب إبقاؤه بالإنجليزية: ${dubbedName}`);
assert.ok(formalNamingCorpus.includes("AlphaGo Zero"), "الاسم الأصلي AlphaGo Zero مفقود");
assert.ok(formalNamingCorpus.includes("Double Q-Learning"), "الاسم الأصلي Double Q-Learning مفقود");
assert.equal(GROUPS.length, 10);
assert.equal(NODES.length, 71);
assert.equal(JOURNEY.length, 12);

const keys = new Set(NODES.map((node) => node.k));
assert.equal(keys.size, NODES.length, "يجب ان يكون مفتاح كل عقدة فريدا");
assert.deepEqual([...Array(10)].map((_, group) => NODES.filter((node) => node.g === group).length), [11, 8, 3, 10, 4, 8, 9, 9, 6, 2]);
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
  "هدفه الوحيد تعظيم المكافأة المتراكمة",
  "كل هدف يمكن صوغه",
  "افضل من V عمليا",
  "تحل البرمجة الديناميكية عملية ماركوف حلا دقيقا",
  "تتقارب الى السياسة المثلى في خطوات قليلة",
  "يزيل الانحياز",
  "الثانية اقوى",
  "كل اثنين آمنان",
  "فتمنع التذبذب والتباعد",
  "فيضمن تحسنا مطردا",
  "صار الخوارزمية الافتراضية",
  "عصب التحكم الروبوتي",
  "بلغ مستوى خارقا من صفر بيانات بشرية",
]) assert.ok(!corpus.includes(phrase), `بقي ادعاء مطلق او مضلل: ${phrase}`);

for (const phrase of [
  "زيارة كل زوج حالة-فعل مرارا",
  "لا ان كل جمع لعنصرين آمن دائما",
  "لا ضمانا بأن كل تحديث تنفيذي يحسن العائد",
  "وليست الافتراضية لكل تعلم معزز",
  "بمزيج من التعلم الموجه على مباريات خبراء",
  "لا يضمن مواءمة شاملة",
]) assert.ok(corpus.includes(phrase), `تصحيح علمي مفقود: ${phrase}`);

const linksMatch = build.match(/const XLINKS_RL = (\[[\s\S]*?\n\]);/);
assert.ok(linksMatch, "تعذر استخراج علاقات عالم التعلم المعزز");
const links = vm.runInNewContext(`(${linksMatch[1]})`);
assert.equal(links.length, 14);
assert.ok(links.some(([a, b, type]) => a === "ucb" && b === "exploration-exploitation" && type === "method"));
assert.ok(links.some(([a, b, type]) => a === "deadly-triad" && b === "dqn" && type === "affects"));

const srcMatch = template.match(/const SRC_RL = (\{[\s\S]*?\n\});\nconst SRC_PROB/);
assert.ok(srcMatch, "تعذر استخراج لوحة مصادر التعلم المعزز");
const src = vm.runInNewContext(`(${srcMatch[1]})`);
const items = src.topics.flatMap((topic) => topic.items);
assert.equal(items.length, 12);
for (const url of [
  "http://incompleteideas.net/book/RLbook2020.pdf",
  "https://doi.org/10.1007/BF00115009",
  "https://doi.org/10.1007/BF00992698",
  "https://ai.stanford.edu/~ang/papers/shaping-icml99.pdf",
  "https://doi.org/10.1023/A:1013689704352",
  "https://doi.org/10.1038/nature14236",
  "https://proceedings.mlr.press/v37/schulman15.html",
  "https://arxiv.org/abs/1707.06347",
  "https://doi.org/10.1038/nature16961",
  "https://doi.org/10.1038/nature24270",
  "https://doi.org/10.1126/science.aar6404",
  "https://doi.org/10.1038/s41586-020-03051-4",
]) assert.ok(items.some((item) => item.link === url), `مصدر أكاديمي مفقود: ${url}`);

const additions = vm.runInNewContext(`(${template.match(/const ACADEMIC_SOURCE_ADDITIONS = (\{[\s\S]*?\n\});/)[1]})`);
assert.equal(additions["التعلم المعزز"].length, 6);
assert.equal(Object.values(additions).flat().length, 123);

for (const name of ["ai-how-ai-works.html"]) {
  const output = fs.readFileSync(new URL(`../pages/${name}`, import.meta.url), "utf8");
  assert.ok(output.includes("زيارة كل زوج حالة-فعل مرارا"), `${name}: شروط تقارب Q-Learning مفقودة`);
  assert.ok(output.includes("لا ضمانا بأن كل تحديث تنفيذي يحسن العائد"), `${name}: حد TRPO مفقود`);
  assert.ok(output.includes("Mastering the Game of Go without Human Knowledge"), `${name}: مراجع العالم الجديدة مفقودة`);
  assert.ok(output.includes("const SRC_RL ="), `${name}: لوحة مصادر العالم مفقودة`);
}

console.log("Reinforcement learning deep review: 71 nodes, 10 groups, 12 journey steps, 14 cross-links, sources and academic additions verified.");
