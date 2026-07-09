// يصنع llm-network-template.html من قالب خريطة الذكاء الاصطناعي:
// نفس المحرك (فيزياء + رحلة + بطاقات) مع عنوان جديد ومختبرات جديدة.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
let t = readFileSync(join(here, "ai-network-template.html"), "utf8");
const labHtml = readFileSync(join(here, "llm-lab.html"), "utf8");
const labJs = readFileSync(join(here, "llm-lab.js"), "utf8");

function replaceOnce(hay, from, to, name) {
  if (!hay.includes(from)) throw new Error("marker not found: " + name);
  return hay.replace(from, to);
}

/* 1) العنوان والترويسة */
t = replaceOnce(t, "<title>كيف يعمل الذكاء الاصطناعي</title>", "<title>كيف تعمل النماذج اللغوية الكبيرة</title>", "title");
t = replaceOnce(t, "<h1>كيف يعمل الذكاء الاصطناعي</h1>", "<h1>كيف تعمل النماذج اللغوية الكبيرة</h1>", "h1");
t = replaceOnce(t,
  '<div class="sub">شبكة تفاعلية من البيانات الى الجواب — اسحب، قرب، وانقر اي مفهوم لشرحه</div>',
  '<div class="sub">خريطة تفتح الصندوق الاسود لنماذج مثل ChatGPT وClaude — اسحب، قرب، وانقر اي مفهوم لشرحه</div>',
  "subtitle");
t = replaceOnce(t,
  "✨ ابدأ الرحلة الكاملة: من البيانات الى الجواب",
  "✨ ابدأ رحلة الرمز: من موجهك الى الجواب عبر المحول",
  "journey-button");
/* رابط العودة الى الخريطة الام */
t = replaceOnce(t,
  '<div class="sub">خريطة تفتح الصندوق الاسود لنماذج مثل ChatGPT وClaude — اسحب، قرب، وانقر اي مفهوم لشرحه</div>',
  '<div class="sub">خريطة تفتح الصندوق الاسود لنماذج مثل ChatGPT وClaude — اسحب، قرب، وانقر اي مفهوم لشرحه</div>\n  <a href="__AI_MAP_URL__" style="display:block; margin-top:8px; font-size:12.5px; color:#8fb8e8; text-decoration:none;">◂ هذه الخريطة تتوسع في فرع من خريطة الذكاء الاصطناعي الشاملة — افتح الخريطة الام</a>',
  "back-link");

/* 2) استبدال واجهة المختبر: من <div id="lab" الى ما قبل <script> */
const labStart = t.indexOf('<div id="lab"');
const scriptStart = t.indexOf("<script>", labStart);
if (labStart < 0 || scriptStart < 0) throw new Error("lab HTML block not found");
t = t.slice(0, labStart) + labHtml.trim() + "\n\n" + t.slice(scriptStart);

/* 3) استبدال كود المختبر: من علامة المختبر الى نهاية السكربت */
const jsMarker = "/* ==================== المختبر الحي";
const jsStart = t.indexOf(jsMarker);
const jsEnd = t.lastIndexOf("</script>");
if (jsStart < 0 || jsEnd < 0 || jsEnd < jsStart) throw new Error("lab JS block not found");
t = t.slice(0, jsStart) + labJs.trim() + "\n" + t.slice(jsEnd);

/* تحقق نهائي */
for (const must of ["LAB MATH", "__LAB_DOM__", "lmNextDist", "bpeTrain", "labTab1", "genDist", "tokInput"]) {
  if (!t.includes(must)) throw new Error("post-check failed: " + must);
}
if (t.includes("neuCanvas") || t.includes("labTrainEpoch")) throw new Error("old NN lab leaked into new template");

writeFileSync(join(here, "llm-network-template.html"), t, "utf8");
console.log("llm-network-template.html written (" + Math.round(t.length / 1024) + " KB)");
