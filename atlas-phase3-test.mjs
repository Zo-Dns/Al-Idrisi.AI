import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

const build = readFileSync("atlas-build.mjs", "utf8");
const template = readFileSync("atlas-template.html", "utf8");
const finalAtlas = readFileSync("ai-how-ai-works.html", "utf8");

let failures = 0;
function check(condition, label, detail = "") {
  const mark = condition ? "PASS" : "FAIL";
  console.log(`${mark} | ${label}${detail ? ` | ${detail}` : ""}`);
  if (!condition) failures++;
}

function expression(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`تعذر استخراج ${label}`);
  return Function(`return (${match[1]})`)();
}

const worlds = ["AI", "LLM", "DL", "ML", "DATA", "ETHICS", "APPS", "CLASSIC", "RL", "PROB", "HISTORY"];
const approved = expression(build, /const XLINK_TYPES = new Set\((\[[^;]+\])\);/, "أنواع العلاقات");
const phrases = expression(template, /const XL_PHRASE = (\{[\s\S]*?\n\});/, "عبارات العلاقات");
const used = new Set();
let linkCount = 0;
let duplicateCount = 0;

for (const world of worlds) {
  const links = expression(build, new RegExp(`const XLINKS_${world} = (\\[[\\s\\S]*?\\n\\]);`), `روابط ${world}`);
  const seen = new Set();
  for (const [a, b, type] of links) {
    used.add(type);
    linkCount++;
    const key = `${a}\u0000${b}\u0000${type}`;
    if (seen.has(key)) duplicateCount++;
    seen.add(key);
  }
}

const unapproved = [...used].filter((type) => !approved.includes(type));
const invisible = [...used].filter((type) => !phrases[type]);
check(unapproved.length === 0, "كل أنواع العلاقات المستخدمة معتمدة", unapproved.join(", "));
check(invisible.length === 0, "كل أنواع العلاقات المستخدمة لها صياغة مرئية", invisible.join(", "));
check(duplicateCount === 0, "لا توجد علاقات ثلاثية مكررة", `links=${linkCount}`);
check(["mitigates", "tests", "supports"].every((type) => phrases[type]), "علاقات التخفيف والاختبار والدعم ظاهرة");

const baseMatch = template.match(/\/\*ACADEMIC_SOURCES_START\*\/([\s\S]*?)\/\*ACADEMIC_SOURCES_END\*\//);
if (!baseMatch) throw new Error("علامتا مكتبة المصادر مفقودتان");
const library = JSON.parse(baseMatch[1]);
const additions = expression(template, /const ACADEMIC_SOURCE_ADDITIONS = (\{[\s\S]*?\n\});/, "إضافات المصادر");
for (const [label, items] of Object.entries(additions)) {
  const section = library.sections.find((candidate) => candidate.label === label);
  if (!section) throw new Error(`قسم مصادر مفقود: ${label}`);
  const titles = new Set(section.items.map((item) => item.t));
  for (const item of items) if (!titles.has(item.t)) section.items.push(item);
}
const normalizeMatch = template.match(/\/\*ACADEMIC_LIBRARY_NORMALIZE_START\*\/([\s\S]*?)\/\*ACADEMIC_LIBRARY_NORMALIZE_END\*\//);
if (!normalizeMatch) throw new Error("حارس تنقية مكتبة المصادر مفقود");
const libraryContext = { ACADEMIC_SOURCES: library };
vm.runInNewContext(normalizeMatch[1], libraryContext);
const references = libraryContext.ACADEMIC_SOURCES.catalog;
const validTypes = new Set(["book", "paper", "primary", "official", "scholarly", "report", "research", "preprint"]);
const invalidReferences = references.filter((item) => !item.a || !item.t || !item.v || !Number.isInteger(item.y) || !validTypes.has(item.k));
check(references.length === 389, "عدد سجلات المكتبة الأكاديمية الفريدة مطابق", `records=${references.length}`);
check(new Set(references.map((item) => item.id)).size === 389, "معرفات المصادر الأكاديمية فريدة وثابتة");
check(libraryContext.ACADEMIC_SOURCES.archived.length === 2, "أرشيف أثر المصادر المستبعدة محفوظ", `archived=${libraryContext.ACADEMIC_SOURCES.archived.length}`);
check(invalidReferences.length === 0, "بيانات المراجع الأساسية مكتملة");

const sourceNames = ["SRC_LLM", "SRC_AGENTS", "SRC_GENAI", "SRC_APPS", "SRC_ETHICS", "SRC_CLASSIC", "SRC_RL", "SRC_PROB", "SRC_HISTORY"];
const expectedItems = { SRC_LLM: 13, SRC_AGENTS: 6, SRC_GENAI: 8, SRC_APPS: 19, SRC_ETHICS: 14, SRC_CLASSIC: 18, SRC_RL: 12, SRC_PROB: 20, SRC_HISTORY: 21 };
function sourceBlock(source, name) {
  const start = source.indexOf(`const ${name} =`);
  if (start < 0) return null;
  const candidates = sourceNames
    .map((nextName) => source.indexOf(`const ${nextName} =`, start + 10))
    .filter((index) => index > start);
  const groupIndex = source.indexOf("const SOURCES_BY_GROUP", start + 10);
  if (groupIndex > start) candidates.push(groupIndex);
  const end = Math.min(...candidates);
  return source.slice(start, end);
}
function urls(block) {
  return [...new Set([...block.matchAll(/https?:\/\/[^"'\s}]+/g)].map((match) => match[0]))].sort();
}
for (const name of sourceNames) {
  const blocks = [template, finalAtlas].map((source) => sourceBlock(source, name));
  const itemCounts = blocks.map((block) => (block.match(/\{ type:/g) || []).length);
  const urlSets = blocks.map((block) => JSON.stringify(urls(block)));
  check(blocks.every(Boolean), `${name} موجود في القالب وملف الأطلس النهائي`);
  check(itemCounts.every((count) => count === expectedItems[name]), `${name} يحفظ عدد المواد`, itemCounts.join("/"));
  check(urlSets[0] === urlSets[1], `${name} يحفظ الروابط بين القالب وملف الأطلس النهائي`);
}

const forbiddenClaims = [
  "وكل قدراته تختصر في مهمة وحيدة",
  "عام 2017 اطاح بالتكرار",
  "اول قانون شامل مخصص للذكاء الاصطناعي",
  "مخطط سببي وجداول شرطية محلية",
  "PPO (شولمان 2017) الذي صار الخوارزمية الافتراضية"
];
const contentFiles = ["ai", "llm", "dl", "ml", "data", "ethics", "apps", "classic", "rl", "prob", "history"]
  .map((name) => readFileSync(`${name}-content.mjs`, "utf8"))
  .join("\n");
const remainingClaims = forbiddenClaims.filter((claim) => contentFiles.includes(claim));
check(remainingClaims.length === 0, "الادعاءات المطلقة المصححة لم تعد إلى المحتوى", remainingClaims.join(" | "));
const legacyContextPhrase = "وجه سياقي";
const legacyContextLocations = [
  ["مصادر العوالم", contentFiles],
  ["قالب الأطلس", template],
  ["قالب الشبكة الأقدم", readFileSync("ai-network-template.html", "utf8")],
  ["ملف الأطلس النهائي", finalAtlas]
].filter(([, source]) => source.includes(legacyContextPhrase)).map(([label]) => label);
check(legacyContextLocations.length === 0, "لا تعود عبارة العلاقة المجردة «وجه سياقي»", legacyContextLocations.join("، "));
check(finalAtlas.startsWith('<!doctype html>\n<html lang="ar" dir="rtl">') && finalAtlas.includes('<head>\n<meta charset="utf-8">') && finalAtlas.includes('<meta name="description"') && finalAtlas.includes('<title>Al-Idrisi.AI — كيف يعمل الذكاء الاصطناعي</title>\n</head>\n<body>\n<style>'), "ملف الأطلس النهائي وثيقة HTML معيارية كاملة بترميز UTF-8 ووصف وعنوان داخل head");
check(!existsSync("ai-how-ai-works-standalone.html"), "لا توجد نسخة أطلس مكررة باسم standalone");
check(finalAtlas.includes("مدعوم جزئيا بـ"), "صياغة علاقة الدعم مشحونة في ملف الأطلس النهائي");
check(finalAtlas.includes("324 مدخلا") === false, "عدد المكتبة يحسب من البيانات لا من نص واجهة ثابت");

if (failures) {
  console.error(`\n${failures} PHASE-3 INTEGRITY TEST(S) FAILED`);
  process.exit(1);
}
console.log("\nALL PHASE-3 INTEGRITY TESTS PASSED");
