import { existsSync, readFileSync } from "node:fs";

let failures = 0;
function check(condition, label, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"} | ${label}${detail ? ` | ${detail}` : ""}`);
  if (!condition) failures++;
}

function extractCatalog(source) {
  const match = source.match(/const LAB_DIRECTORY = (\{[\s\S]*?\n\});\nconst LAB_DIRECTORY_WORLD_NAMES/);
  if (!match) throw new Error("تعذر استخراج فهرس المختبرات");
  return Function(`return (${match[1]})`)();
}

const source = readFileSync("src/templates/ai-network-template.html", "utf8");
const generated = readFileSync("src/templates/atlas-template.html", "utf8");
const finalAtlas = readFileSync("pages/ai-how-ai-works.html", "utf8");
const buildScript = readFileSync("scripts/make-atlas.mjs", "utf8");
const catalog = extractCatalog(source);

const expectedCounts = { dl: 7, llm: 3, ml: 3, data: 1, ethics: 2, apps: 1, classic: 1, rl: 1, prob: 1 };
check(JSON.stringify(Object.keys(catalog).sort()) === JSON.stringify(Object.keys(expectedCounts).sort()), "الفهرس محصور في عوالم الغوص التي تملك تجارب");

for (const [world, expected] of Object.entries(expectedCounts)) {
  const entries = catalog[world] || [];
  check(entries.length === expected, `عدد تجارب ${world} صحيح`, `${entries.length}/${expected}`);
  check(entries.every((entry) => entry.title && entry.objective && entry.limit && entry.check && Array.isArray(entry.concepts) && entry.concepts.length), `بطاقات ${world} تصرح بالهدف والحد والتحقق والمفاهيم`);
  check(entries.every((entry) => entry.kind === "embedded" || entry.kind === "3d"), `أنواع تجارب ${world} مقيدة`);

  const modes = entries.filter((entry) => entry.kind === "embedded").map((entry) => entry.mode);
  const urls = entries.filter((entry) => entry.kind === "3d").map((entry) => entry.url);
  check(new Set(modes).size === modes.length && modes.every(Number.isInteger), `لا تكرار في التجارب المدمجة لعالم ${world}`);
  check(new Set(urls).size === urls.length, `لا تكرار في المختبرات المستقلة لعالم ${world}`);
  for (const url of urls) {
    const localPath = url.replace(/^\//, "");
    check(existsSync(localPath), `مسار المختبر المستقل موجود`, `${world}: ${localPath}`);
  }
}

check(!catalog.ai && !catalog.history, "لا زر فهرس في الخريطة الأم أو عالم التاريخ السردي");
check(source.includes('if (WORLD !== "ai" && currentLabDirectory.length)'), "الزر لا يظهر إلا بعد الغوص وفي عالم ذي تجارب");
check(source.includes('entries.filter((entry) => entry.kind === "embedded")') && source.includes('entries.filter((entry) => entry.kind === "3d")'), "الفهرس يفصل التجارب المدمجة عن مختبرات 3D");
check(source.includes("يعرض كل تجربة مرة واحدة حتى لو ارتبطت بعدة عقد"), "الواجهة تشرح إزالة التكرار ونطاق الفهرس");
check(source.includes('openLab(entry.mode)') && source.includes('rel = "noopener noreferrer"'), "الفتح المباشر آمن للتجارب المدمجة والمستقلة");
check(source.includes('class="labsDirectoryMark"') && source.includes('class="axis"') && source.includes('class="curve"') && source.includes('class="point"'), "العلامة رسم علمي أصلي بمحاور ومنحنى ونقاط قياس");
check(!source.slice(source.indexOf("<button class=\"hud\" id=\"labsDirectoryBtn\""), source.indexOf("<div id=\"labsDirectoryOverlay\"")).includes("🧪"), "زر الفهرس لا يستخدم رمز أنبوب الاختبار المكرر");
check(source.includes('aria-controls="labsDirectoryPanel"') && source.includes('aria-expanded="false"') && source.includes('setAttribute("aria-expanded", "true")'), "حالة لوحة الفهرس موصوفة لقارئات الشاشة");
const cairoPayloads = [...source.matchAll(/font-family: "Cairo Atlas Button";[\s\S]*?base64,([A-Za-z0-9+/=]+)\) format\("woff2"\)/g)].map((match) => match[1]);
check(cairoPayloads.length === 2 && cairoPayloads.every((payload) => Buffer.from(payload, "base64").subarray(0, 4).toString("ascii") === "wOF2"), "خط Cairo العربي واللاتيني مضمن بصيغة WOFF2 صحيحة");
const cairoDirectoryPayloads = [...source.matchAll(/font-family: "Cairo Atlas Directory";[\s\S]*?base64,([A-Za-z0-9+/=]+)\) format\("woff2"\)/g)].map((match) => match[1]);
check(cairoDirectoryPayloads.length === 2 && cairoDirectoryPayloads.every((payload) => Buffer.from(payload, "base64").subarray(0, 4).toString("ascii") === "wOF2"), "خط Cairo المتغير العربي واللاتيني مضمن للفهرس كله");
check((source.match(/font-weight: 200 1000;/g) || []).length === 2, "Cairo المتغير يحفظ الأوزان من النص العادي إلى العنوان الثقيل");
check(source.includes('font: 800 16px/1.45 "Cairo Atlas Button", "Cairo"'), "زرا فتح التجربة والمختبر يستخدمان Cairo حصرا داخل الفهرس");
check(source.includes('#labsDirectoryPanel {') && source.includes('font-family: "Cairo Atlas Directory", "Cairo"') && !source.includes('.labDirectorySectionTitle { margin: 0 0 8px; color: #a9dcd4; font-size: 12px; font-family: var(--mono)'), "العناوين والشارات والأوصاف والمفاهيم ترث Cairo داخل الفهرس");
check(/#sourcesBtn \{[\s\S]*?font-family: "Cairo Atlas Directory", "Cairo"/.test(source), "زر مصادر موثوقة يستخدم Cairo");
check(/#worldBack \{[\s\S]*?font-family: "Cairo Atlas Directory", "Cairo"/.test(buildScript), "زر العودة إلى الخريطة الأم يستخدم Cairo في المصرّف");
check(!source.includes("fonts.googleapis.com") && !source.includes("fonts.gstatic.com"), "الخط لا يعتمد على اتصال خارجي");

const activeWorlds = [...buildScript.matchAll(/WORLD === "([a-z]+)" \? "labWorld-/g)].map((match) => match[1]);
for (const world of Object.keys(expectedCounts)) check(activeWorlds.includes(world) || world === "dl", `عالم ${world} يملك مختبرا مدمجا في المصرّف`);

for (const [label, text] of [["القالب المولد", generated], ["ملف الأطلس النهائي", finalAtlas]]) {
  const builtCatalog = extractCatalog(text);
  check(JSON.stringify(builtCatalog) === JSON.stringify(catalog), `${label} يحمل الفهرس نفسه بلا فقد`);
  check(text.includes("labsDirectoryPanel") && text.includes("مختبرات هذا العالم"), `${label} يحمل واجهة الفهرس`);
}

if (failures) {
  console.error(`\n${failures} LAB DIRECTORY TEST(S) FAILED`);
  process.exit(1);
}
console.log("\nALL LAB DIRECTORY TESTS PASSED");
