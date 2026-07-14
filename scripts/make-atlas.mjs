// يدمج الخريطتين في ملف واحد بعالمين: الخريطة الام (#) وخريطة النماذج اللغوية (#llm)
// المصادر: قالب المحرك في src/templates + المختبرات المدمجة في src/labs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TEMPLATE_DIR = join(ROOT, "src", "templates");
const LAB_DIR = join(ROOT, "src", "labs");
const ACADEMIC_DATA_DIR = join(ROOT, "data", "academic");
let t = readFileSync(join(TEMPLATE_DIR, "ai-network-template.html"), "utf8");
const llmLabHtml = readFileSync(join(LAB_DIR, "llm-lab.html"), "utf8");
let llmLabJs = readFileSync(join(LAB_DIR, "llm-lab.js"), "utf8");
const mlLabHtml = readFileSync(join(LAB_DIR, "ml-lab.html"), "utf8");
let mlLabJs = readFileSync(join(LAB_DIR, "ml-lab.js"), "utf8");
const dataLabHtml = readFileSync(join(LAB_DIR, "data-lab.html"), "utf8");
let dataLabJs = readFileSync(join(LAB_DIR, "data-lab.js"), "utf8");
const ethicsLabHtml = readFileSync(join(LAB_DIR, "ethics-lab.html"), "utf8");
let ethicsLabJs = readFileSync(join(LAB_DIR, "ethics-lab.js"), "utf8");
const classicLabHtml = readFileSync(join(LAB_DIR, "classic-lab.html"), "utf8");
let classicLabJs = readFileSync(join(LAB_DIR, "classic-lab.js"), "utf8");
const rlLabHtml = readFileSync(join(LAB_DIR, "rl-lab.html"), "utf8");
let rlLabJs = readFileSync(join(LAB_DIR, "rl-lab.js"), "utf8");
const probLabHtml = readFileSync(join(LAB_DIR, "prob-lab.html"), "utf8");
let probLabJs = readFileSync(join(LAB_DIR, "prob-lab.js"), "utf8");
const appsLabHtml = readFileSync(join(LAB_DIR, "apps-lab.html"), "utf8");
let appsLabJs = readFileSync(join(LAB_DIR, "apps-lab.js"), "utf8");
const academicVerification = JSON.parse(readFileSync(join(ACADEMIC_DATA_DIR, "academic-source-verification.json"), "utf8"));

if (academicVerification.total !== 389 || academicVerification.results?.length !== 389 || academicVerification.archived?.length !== 2) {
  throw new Error("academic-source-verification.json: expected 389 live records and 2 provenance-only archives");
}
const evidencePriority = [
  "original-url",
  "manual-primary-or-institutional-evidence",
  "publisher-or-catalog-web-result",
  "crossref-doi",
  "crossref",
  "semantic-scholar"
];
function acceptedEvidenceUrl(audit) {
  const accepted = (audit?.evidence || []).filter((evidence) => evidence.ok);
  for (const source of evidencePriority) {
    const evidence = accepted.find((candidate) => candidate.source === source);
    const url = evidence?.url || evidence?.match?.url;
    if (url) return url;
  }
  const fallback = accepted.find((evidence) => evidence.url || evidence.match?.url);
  return fallback?.url || fallback?.match?.url || "";
}
const academicCatalog = academicVerification.results.map(({ audit, ...record }) => ({
  ...record,
  url: record.url || acceptedEvidenceUrl(audit)
}));
if (new Set(academicCatalog.map((record) => record.id)).size !== academicCatalog.length) {
  throw new Error("academic-source-verification.json: source IDs must be unique");
}
if (academicCatalog.some((record) => !record.a || !record.t || !record.v || !record.k || !record.id || !Array.isArray(record.u) || !record.u.length)) {
  throw new Error("academic-source-verification.json: a canonical source record is incomplete");
}
if (academicCatalog.some((record) => record.url && !record.url.startsWith("https://"))) {
  throw new Error("academic-source-verification.json: source URLs must use HTTPS");
}
if (academicCatalog.some((record) => !record.url)) {
  throw new Error("academic-source-verification.json: every live source needs an accepted evidence URL");
}
function inlineJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function replaceOnce(hay, from, to, name) {
  const i = hay.indexOf(from);
  if (i < 0) throw new Error("marker not found: " + name);
  if (hay.indexOf(from, i + from.length) >= 0) throw new Error("marker not unique: " + name);
  return hay.slice(0, i) + to + hay.slice(i + from.length);
}

/* 1) CSS: طبقة الغوص + زر العودة */
t = replaceOnce(t, "  /* ============ المختبر الحي ============ */",
`  #warp {
    position: fixed; inset: 0; z-index: 60;
    background: #05080f;
    opacity: 0; pointer-events: none;
    transition: opacity 0.55s ease;
  }
  #warp.on { opacity: 1; pointer-events: auto; }
  #worldBack {
    margin-top: 10px; width: 100%;
    background: rgba(79, 200, 248, 0.12);
    border: 1px solid rgba(79, 200, 248, 0.45);
    color: #9fdcff;
    font-family: "Cairo Atlas Directory", "Cairo", "Segoe UI", Tahoma, sans-serif; font-size: 13.5px; font-weight: 600;
    border-radius: 10px; padding: 8px 12px; cursor: pointer;
  }
  #worldBack:hover { background: rgba(79, 200, 248, 0.22); }

  /* ============ المختبر الحي ============ */`, "css-insert");

/* 2) طبقة الغوص في الـDOM */
t = replaceOnce(t, '<canvas id="stage"></canvas>',
  '<canvas id="stage" role="img" aria-label="خريطة مفاهيم تفاعلية للذكاء الاصطناعي؛ استخدم لوحة المجموعات والبحث لاستكشاف محتواها."></canvas>\n\n<div id="warp" class="on"></div>', "warp-div");

/* 3) زر العودة داخل لوحة العنوان */
t = replaceOnce(t,
  '<div class="sub">كيف يعمل الذكاء الاصطناعي — شبكة تفاعلية من البيانات الى الجواب؛ اسحب، قرب، وانقر اي مفهوم لشرحه</div>',
  '<div class="sub">كيف يعمل الذكاء الاصطناعي — شبكة تفاعلية من البيانات الى الجواب؛ اسحب، قرب، وانقر اي مفهوم لشرحه</div>\n  <button id="worldBack" type="button" style="display:none">◂ عودة الى خريطة الذكاء الاصطناعي الام</button>',
  "back-button");

/* 4) تشغيل العالمين: يستبدل سطر RAW */
t = replaceOnce(t, "const RAW = /*__DATA__*/null;",
`/* ============ عالمان في ملف واحد: الخريطة الام (#) وخريطة النماذج اللغوية (#llm) ============ */
const RAW_AI = /*__DATA_AI__*/null;
const RAW_LLM = /*__DATA_LLM__*/null;
const RAW_DL = /*__DATA_DL__*/null;
const RAW_ML = /*__DATA_ML__*/null;
const RAW_DATA = /*__DATA_DATA__*/null;
const RAW_ETHICS = /*__DATA_ETHICS__*/null;
const RAW_APPS = /*__DATA_APPS__*/null;
const RAW_CLASSIC = /*__DATA_CLASSIC__*/null;
const RAW_RL = /*__DATA_RL__*/null;
const RAW_PROB = /*__DATA_PROB__*/null;
const RAW_HISTORY = /*__DATA_HISTORY__*/null;
const RAW_BY_WORLD = { ai: RAW_AI, llm: RAW_LLM, dl: RAW_DL, ml: RAW_ML, data: RAW_DATA, ethics: RAW_ETHICS, apps: RAW_APPS, classic: RAW_CLASSIC, rl: RAW_RL, prob: RAW_PROB, history: RAW_HISTORY };
const WORLD = ["llm", "dl", "ml", "data", "ethics", "apps", "classic", "rl", "prob", "history"].includes((location.hash || "").slice(1)) ? location.hash.slice(1) : "ai";
const RAW = RAW_BY_WORLD[WORLD];
document.documentElement.classList.toggle("deep-world", WORLD !== "ai");
/* واجهة المختبرات المشتركة — يملؤها مختبر العالم النشط فقط */
let labOpen = false;
let LAB_MAP = {};
let LAB_BTN_TEXT = [];
let openLab = function () {};
let closeLab = function () {};
/* مختبر كل عالم: ai/dl → مختبر الشبكة العصبية · llm → مختبرا اللغة · ml → مختبر التصنيف */
const ACTIVE_LAB = WORLD === "llm" ? "labWorld-llm" : (WORLD === "ml" ? "labWorld-ml" : (WORLD === "data" ? "labWorld-data" : (WORLD === "ethics" ? "labWorld-ethics" : (WORLD === "apps" ? "labWorld-apps" : (WORLD === "classic" ? "labWorld-classic" : (WORLD === "rl" ? "labWorld-rl" : (WORLD === "prob" ? "labWorld-prob" : ((WORLD === "ai" || WORLD === "dl") ? "labWorld-ai" : "none"))))))));
for (const id of ["labWorld-ai", "labWorld-llm", "labWorld-ml", "labWorld-data", "labWorld-ethics", "labWorld-apps", "labWorld-classic", "labWorld-rl", "labWorld-prob"]) {
  if (id !== ACTIVE_LAB) { const el = document.getElementById(id); if (el) el.remove(); }
}
/* الغوص بين العالمين: تقريب داخل العقدة + تعتيم ثم تبديل العالم في نفس النافذة */
function enterWorld(hash, focusNode) {
  document.getElementById("warp").classList.add("on");
  if (focusNode) camTarget = { scale: 6, tx: W / 2 - focusNode.x * 6, ty: H / 2 - focusNode.y * 6 };
  setTimeout(() => { location.hash = hash; location.reload(); }, 620);
}
if (WORLD === "llm") {
  document.title = "كيف تعمل النماذج اللغوية الكبيرة — Al-Idrisi.AI";
  document.querySelector("#titlebox h1").textContent = "كيف تعمل النماذج اللغوية الكبيرة";
  document.querySelector("#titlebox .sub").textContent = "فرع متعمق انبثق من عقدة النماذج اللغوية في الخريطة الام — يفتح الصندوق الاسود لنماذج مثل ChatGPT وClaude";
  document.getElementById("journeyBtn").textContent = "🪐 ابدأ رحلة النموذج اللغوي: من بنائه وتدريبه الى جوابه";
}
if (WORLD === "dl") {
  document.title = "كيف يعمل التعلم العميق — Al-Idrisi.AI";
  document.querySelector("#titlebox h1").textContent = "كيف يعمل التعلم العميق";
  document.querySelector("#titlebox .sub").textContent = "فرع متعمق انبثق من عقدة التعلم العميق في الخريطة الام — من العصبون الى الشبكة الالتفافية";
  document.getElementById("journeyBtn").textContent = "🪐 ابدأ رحلة التعلم العميق: من العصبون الى النماذج التوليدية";
}
if (WORLD === "ml") {
  document.title = "كيف يعمل تعلم الآلة — Al-Idrisi.AI";
  document.querySelector("#titlebox h1").textContent = "كيف يعمل تعلم الآلة";
  document.querySelector("#titlebox .sub").textContent = "الاب الذي تفرع منه التعلم العميق والنماذج اللغوية — الخوارزميات الكلاسيكية والتقييم والمقايضات";
  document.getElementById("journeyBtn").textContent = "🪐 ابدأ رحلة النموذج: من مشكلة الى اداة موثوقة";
}
if (WORLD === "data") {
  document.title = "البيانات: وقود الذكاء الاصطناعي — Al-Idrisi.AI";
  document.querySelector("#titlebox h1").textContent = "البيانات: وقود الذكاء الاصطناعي";
  document.querySelector("#titlebox .sub").textContent = "المادة الخام التي يتعلم منها كل نظام — من فوضى العالم الى وقود جاهز للتدريب";
  document.getElementById("journeyBtn").textContent = "🪐 ابدأ رحلة البيانات: من العالم الى النموذج";
}
if (WORLD === "ethics") {
  document.title = "الاخلاق والامان في الذكاء الاصطناعي — Al-Idrisi.AI";
  document.querySelector("#titlebox h1").textContent = "الاخلاق والامان في الذكاء الاصطناعي";
  document.querySelector("#titlebox .sub").textContent = "فرع متعمق انبثق من عقدة الاخلاق والامان في الخريطة الام — من التحيز والخصوصية الى المواءمة والحوكمة ومخاطر الحدود";
  document.getElementById("journeyBtn").textContent = "🪐 ابدأ رحلة المسؤولية: من الحوكمة الى المراجعة المستمرة";
}
if (WORLD === "apps") {
  document.title = "تطبيقات الذكاء الاصطناعي — Al-Idrisi.AI";
  document.querySelector("#titlebox h1").textContent = "تطبيقات الذكاء الاصطناعي";
  document.querySelector("#titlebox .sub").textContent = "فرع متعمق انبثق من عقدة التطبيقات في الخريطة الام — اين يستخدم الذكاء الاصطناعي في العالم الحقيقي";
  document.getElementById("journeyBtn").textContent = "🪐 ابدأ جولة التطبيقات: اين يستخدم الذكاء الاصطناعي";
}
if (WORLD === "classic") {
  document.title = "الذكاء الاصطناعي الكلاسيكي: البحث والمنطق — Al-Idrisi.AI";
  document.querySelector("#titlebox h1").textContent = "الذكاء الاصطناعي الكلاسيكي: البحث والمنطق";
  document.querySelector("#titlebox .sub").textContent = "فرع متعمق انبثق من عقدة الذكاء الرمزي في الخريطة الام — البحث والمنطق والتخطيط قبل موجة التعلم، والجسر العصبي-الرمزي الى اليوم";
  document.getElementById("journeyBtn").textContent = "🪐 ابدأ جولة الذكاء الرمزي: من البحث الى الجسر العصبي-الرمزي";
}
if (WORLD === "rl") {
  document.title = "التعلم المعزز: التعلم بالتجربة والمكافأة — Al-Idrisi.AI";
  document.querySelector("#titlebox h1").textContent = "التعلم المعزز: التعلم بالتجربة والمكافأة";
  document.querySelector("#titlebox .sub").textContent = "فرع متعمق انبثق من عقدة التعلم المعزز في الخريطة الام — من الوكيل والمكافأة ومعادلات بلمان الى Q-Learning والتعلم المعزز العميق وAlphaGo";
  document.getElementById("journeyBtn").textContent = "🪐 ابدأ رحلة الوكيل: من المكافأة وQ-Learning الى دمج التعلم والبحث في AlphaGo";
}
if (WORLD === "prob") {
  document.title = "الذكاء الاحتمالي: الاستدلال تحت اللايقين — Al-Idrisi.AI";
  document.querySelector("#titlebox h1").textContent = "الذكاء الاحتمالي: الاستدلال تحت اللايقين";
  document.querySelector("#titlebox .sub").textContent = "فرع متعمق انبثق من عقدة الذكاء الاحتمالي في الخريطة الام — من قاعدة بايز والشبكات البايزية الى الاستدلال والنماذج الزمنية والقرار";
  document.getElementById("journeyBtn").textContent = "🪐 ابدأ رحلة الاستدلال: من قاعدة بايز الى الشبكات البايزية الى القرار";
}
if (WORLD === "history") {
  document.title = "تاريخ الذكاء الاصطناعي — Al-Idrisi.AI";
  document.querySelector("#titlebox h1").textContent = "تاريخ الذكاء الاصطناعي";
  document.querySelector("#titlebox .sub").textContent = "فرع متعمق انبثق من عقدة محطات تاريخية في الخريطة الام — القصة الكاملة من الجذور المنطقية قبل 1950 الى الذكاء التوليدي ونوبل 2024";
  document.getElementById("journeyBtn").textContent = "🪐 ابدأ رحلة التاريخ: من آلة تورينغ الى نوبل 2024";
}
if (WORLD !== "ai") document.getElementById("worldBack").style.display = "block";
document.getElementById("worldBack").addEventListener("click", () => enterWorld("", null));
/* دخول ناعم من التعتيم */
setTimeout(() => document.getElementById("warp").classList.remove("on"), 80);`, "raw-bootstrap");

/* 5) ازرار الغوص بدل فتح صفحة خارجية */
t = replaceOnce(t,
`const DEEP_LINKS = {
  llm:         { label: "🧭 افتح الخريطة المتخصصة: النماذج اللغوية من الداخل", url: "__LLM_MAP_URL__" },
  transformer: { label: "🧭 تعمق في المحول: خريطة النماذج اللغوية", url: "__LLM_MAP_URL__" },
  attention:   { label: "🧭 تعمق في الانتباه: خريطة النماذج اللغوية", url: "__LLM_MAP_URL__" },
};`,
`const DEEP_LINKS = WORLD === "ai" ? {
  ml:          { label: "🧭 غص داخل هذه العقدة: تعلم الآلة من الداخل", world: "#ml" },
  data:        { label: "🧭 غص داخل هذه العقدة: البيانات من الداخل", world: "#data" },
  llm:         { label: "🧭 غص داخل هذه العقدة: النماذج اللغوية من الداخل", world: "#llm" },
  transformer: { label: "🧭 تعمق في المحول: خريطة النماذج اللغوية", world: "#llm" },
  attention:   { label: "🧭 تعمق في الانتباه: خريطة النماذج اللغوية", world: "#llm" },
  dl:          { label: "🧭 غص داخل هذه العقدة: التعلم العميق من الداخل", world: "#dl" },
  nn:          { label: "🧭 تعمق في الشبكات العصبية: خريطة التعلم العميق", world: "#dl" },
  cnn:         { label: "🧭 تعمق في الشبكات الالتفافية: خريطة التعلم العميق", world: "#dl" },
  ethics:      { label: "🧭 غص داخل هذه العقدة: الاخلاق والامان من الداخل", world: "#ethics" },
  apps:        { label: "🧭 غص داخل هذه العقدة: تطبيقات الذكاء الاصطناعي", world: "#apps" },
  classic:     { label: "🧭 غص داخل هذه العقدة: الذكاء الرمزي الكلاسيكي", world: "#classic" },
  rl:          { label: "🧭 غص داخل هذه العقدة: التعلم المعزز من الداخل", world: "#rl" },
  reward:      { label: "🧭 تعمق في المكافأة: عالم التعلم المعزز", world: "#rl" },
  alphago:     { label: "🧭 تعمق في AlphaGo: عالم التعلم المعزز", world: "#rl" },
  rlhf:        { label: "🧭 تعمق في محرك المواءمة: عالم التعلم المعزز", world: "#rl" },
  prob:        { label: "🧭 غص داخل هذه العقدة: الذكاء الاحتمالي من الداخل", world: "#prob" },
  "bayes-net": { label: "🧭 تعمق في الشبكات البايزية: عالم الذكاء الاحتمالي", world: "#prob" },
  bayes:       { label: "🧭 تعمق في الاستدلال البايزي: عالم الذكاء الاحتمالي", world: "#prob" },
  history:     { label: "🧭 غص داخل هذه العقدة: تاريخ الذكاء الاصطناعي كاملا", world: "#history" },
} : WORLD === "dl" ? {
  transformer: { label: "🧭 تعمق في المحول: خريطة النماذج اللغوية", world: "#llm" },
} : WORLD === "ml" ? {
  "dl-bridge": { label: "🧭 غص الى التعلم العميق: الفرع الذي يؤتمت هندسة الميزات", world: "#dl" },
} : {};`, "deep-links");
t = replaceOnce(t,
  'mapBtn.onclick = () => window.open(deep.url, "_blank");',
  "mapBtn.onclick = () => enterWorld(deep.world, n);", "map-btn-action");

/* 6) تغليف مختبر الشبكة العصبية في حاوية عالم + اضافة مختبري LLM */
const labStart = t.indexOf('<div id="lab"');
const scriptStart = t.indexOf("<script>", labStart);
if (labStart < 0 || scriptStart < 0) throw new Error("lab HTML block not found");
const nnLabHtml = t.slice(labStart, scriptStart);
t = t.slice(0, labStart) +
  '<div id="labWorld-ai">\n' + nnLabHtml.trim() + "\n</div>\n\n" +
  '<div id="labWorld-llm">\n' + llmLabHtml.trim() + "\n</div>\n\n" +
  '<div id="labWorld-ml">\n' + mlLabHtml.trim() + "\n</div>\n\n" +
  '<div id="labWorld-data">\n' + dataLabHtml.trim() + "\n</div>\n\n" +
  '<div id="labWorld-ethics">\n' + ethicsLabHtml.trim() + "\n</div>\n\n" +
  '<div id="labWorld-apps">\n' + appsLabHtml.trim() + "\n</div>\n\n" +
  '<div id="labWorld-classic">\n' + classicLabHtml.trim() + "\n</div>\n\n" +
  '<div id="labWorld-rl">\n' + rlLabHtml.trim() + "\n</div>\n\n" +
  '<div id="labWorld-prob">\n' + probLabHtml.trim() + "\n</div>\n\n" +
  t.slice(scriptStart);

/* 7) تغليف كود المختبرين كل في عالمه + تحويل التصريحات المشتركة الى اسنادات */
function shareInterface(js, name) {
  js = replaceOnce(js, "const LAB_MAP = ", "LAB_MAP = ", name + ":LAB_MAP");
  js = replaceOnce(js, "const LAB_BTN_TEXT = [", "LAB_BTN_TEXT = [", name + ":LAB_BTN_TEXT");
  js = replaceOnce(js, "let labOpen = false;", "/* labOpen مشترك اعلاه */", name + ":labOpen");
  js = replaceOnce(js, "function openLab(mode) {", "openLab = function (mode) {", name + ":openLab");
  js = replaceOnce(js, "function closeLab() {", "closeLab = function () {", name + ":closeLab");
  return js;
}
const jsMarker = "/* ==================== المختبر الحي";
const jsStart = t.indexOf(jsMarker);
const jsEnd = t.lastIndexOf("</script>");
if (jsStart < 0 || jsEnd < 0 || jsEnd < jsStart) throw new Error("lab JS block not found");
let nnJs = t.slice(jsStart, jsEnd);
nnJs = shareInterface(nnJs, "nn");
/* تمييز ترويسة رياضيات كل مختبر (لاستخراج الاختبارات الآلية) */
llmLabJs = replaceOnce(llmLabJs, "/* ===== LAB MATH:", "/* ===== LLM LAB MATH:", "llm:math-marker");
llmLabJs = shareInterface(llmLabJs.trim(), "llm");
mlLabJs = shareInterface(mlLabJs.trim(), "ml"); /* مختبر تعلم الآلة يحمل ترويسة ML LAB MATH اصلا */
dataLabJs = shareInterface(dataLabJs.trim(), "data"); /* مختبر البيانات يحمل ترويسة DATA LAB MATH اصلا */
ethicsLabJs = shareInterface(ethicsLabJs.trim(), "ethics"); /* مختبر الاخلاق يحمل ترويسة ETHICS LAB MATH اصلا */
appsLabJs = shareInterface(appsLabJs.trim(), "apps"); /* مختبر التطبيقات يحمل ترويسة APPS LAB MATH اصلا */
classicLabJs = shareInterface(classicLabJs.trim(), "classic"); /* مختبر الذكاء الكلاسيكي يحمل ترويسة CLASSIC LAB MATH اصلا */
rlLabJs = shareInterface(rlLabJs.trim(), "rl"); /* مختبر التعلم المعزز يحمل ترويسة RL LAB MATH اصلا */
probLabJs = shareInterface(probLabJs.trim(), "prob"); /* مختبر الذكاء الاحتمالي يحمل ترويسة PROB LAB MATH اصلا */
t = t.slice(0, jsStart) +
  'if (WORLD === "ai" || WORLD === "dl") {\n' + nnJs.trim() + "\n}\n\n" +
  'if (WORLD === "llm") {\n' + llmLabJs + "\n}\n\n" +
  'if (WORLD === "ml") {\n' + mlLabJs + "\n}\n\n" +
  'if (WORLD === "data") {\n' + dataLabJs + "\n}\n\n" +
  'if (WORLD === "ethics") {\n' + ethicsLabJs + "\n}\n\n" +
  'if (WORLD === "apps") {\n' + appsLabJs + "\n}\n\n" +
  'if (WORLD === "classic") {\n' + classicLabJs + "\n}\n\n" +
  'if (WORLD === "rl") {\n' + rlLabJs + "\n}\n\n" +
  'if (WORLD === "prob") {\n' + probLabJs + "\n}\n" +
  t.slice(jsEnd);

/* اشحن نتيجة التدقيق المرجعي الموثقة في القالب المولد؛ لا تعتمد النسخة النهائية على ملف خارجي وقت العرض. */
t = replaceOnce(t, "/*__ACADEMIC_CATALOG__*/[]", inlineJson(academicCatalog), "academic-catalog");
t = replaceOnce(t, "/*__ACADEMIC_ARCHIVED__*/[]", inlineJson(academicVerification.archived), "academic-archive");

/* تحقق نهائي */
for (const must of ["labWorld-ai", "labWorld-llm", "labWorld-ml", "labWorld-data", "labWorld-ethics", "labWorld-apps", "labWorld-classic", "labWorld-rl", "labWorld-prob", "enterWorld",
  "__DATA_AI__", "__DATA_LLM__", "__DATA_DL__", "__DATA_ML__", "__DATA_DATA__", "__DATA_ETHICS__", "__DATA_APPS__", "__DATA_CLASSIC__", "__DATA_RL__", "__DATA_PROB__", "__DATA_HISTORY__",
  "/* ===== LAB MATH:", "/* ===== LLM LAB MATH:", "/* ===== ML LAB MATH:", "/* ===== DATA LAB MATH:", "/* ===== ETHICS LAB MATH:", "/* ===== APPS LAB MATH:", "/* ===== CLASSIC LAB MATH:", "/* ===== RL LAB MATH:", "/* ===== PROB LAB MATH:",
  "mlTreeBuild", "mlKNN", "dataQualityScore", "dataDedupe", "efConfusion", "efLogRegFit", "appDomainAnalysis", "appFindBestThreshold", "csSearch", "rlQLearn", "pbEnumerate", "worldBack", "#warp", "lab3dBtn", "LAB3D_LINKS"]) {
  if (!t.includes(must)) throw new Error("post-check failed: " + must);
}
if (t.includes("window.open(deep.url")) throw new Error("old map-open leaked");
if (t.includes("__LLM_MAP_URL__")) throw new Error("old URL placeholder leaked");
const domMarks = t.split("/*__LAB_DOM__*/").length - 1;
if (domMarks !== 9) throw new Error("expected 9 LAB_DOM markers, got " + domMarks);
/* حارس تشكيل شامل: يفحص القالب المدموج كله (محرك + مختبرات)، لان حارس atlas-build يفحص ملفات المحتوى فقط لا المختبرات */
const harakatHits = (t.match(/[ً-ْٰ]/g) || []).length;
if (harakatHits) throw new Error("تشكيل تسرب الى القالب: " + harakatHits + " حركة — الاغلب في ملف مختبر (المحتوى محروس، المختبرات لا). جرّدها: node -e \"...replace(/[ً-ْٰ]/g,'')...\"");

writeFileSync(join(TEMPLATE_DIR, "atlas-template.html"), t, "utf8");
console.log("src/templates/atlas-template.html written (" + Math.round(t.length / 1024) + " KB)");
