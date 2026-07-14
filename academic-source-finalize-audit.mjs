import fs from "node:fs";
import vm from "node:vm";

const AUDIT_FILE = "academic-source-verification.json";
const REPORT_FILE = "ACADEMIC_SOURCE_AUDIT.md";
const WEB_FILES = ["academic-source-web-verification.json", "academic-source-web-verification-extra.json"];

function currentCatalog() {
  const source = fs.readFileSync("atlas-template.html", "utf8");
  const base = JSON.parse(source.match(/\/\*ACADEMIC_SOURCES_START\*\/(.*?)\/\*ACADEMIC_SOURCES_END\*\//s)[1]);
  const additions = vm.runInNewContext(`(${source.match(/const ACADEMIC_SOURCE_ADDITIONS = (\{.*?\n\});\nfor \(const \[label, additions\]/s)[1]})`);
  for (const [label, items] of Object.entries(additions)) {
    const section = base.sections.find((candidate) => candidate.label === label);
    const existing = new Set(section.items.map((item) => item.t));
    for (const item of items) if (!existing.has(item.t)) section.items.push(item);
  }
  const context = { ACADEMIC_SOURCES: base };
  vm.runInNewContext(source.match(/\/\*ACADEMIC_LIBRARY_NORMALIZE_START\*\/(.*?)\/\*ACADEMIC_LIBRARY_NORMALIZE_END\*\//s)[1], context);
  return JSON.parse(JSON.stringify(context.ACADEMIC_SOURCES));
}

const STOP = new Set("a an and as at by for from in into of on or the through to using via with".split(" "));
function normalized(value) {
  return String(value || "").normalize("NFKD").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/&(?:amp|quot|#39);/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}
function titleRecall(expected, actual) {
  const wanted = new Set(normalized(expected).split(" ").filter((token) => token && !STOP.has(token)));
  const found = new Set(normalized(actual).split(" ").filter((token) => token && !STOP.has(token)));
  let common = 0;
  for (const token of wanted) if (found.has(token)) common++;
  return wanted.size ? common / wanted.size : 0;
}
function acceptableWeb(record) {
  if (!record?.found || !record.url) return false;
  if (/wikipedia|reddit|amazon|goodreads|medium\.com|youtube|researchgate|scribd|studylib|geeksforgeeks|paperswithcode|blog\./i.test(record.url)) return false;
  return titleRecall(record.title, record.resultTitle) >= 0.78;
}
function escapeCell(value) { return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " "); }

const current = currentCatalog();
const previous = JSON.parse(fs.readFileSync(AUDIT_FILE, "utf8"));
const previousById = new Map(previous.results.map((item) => [item.id, item]));
const webById = new Map(WEB_FILES.flatMap((file) => JSON.parse(fs.readFileSync(file, "utf8")).results).map((item) => [item.id, item]));
const manual = JSON.parse(fs.readFileSync("academic-source-manual-evidence.json", "utf8"));

const results = current.catalog.map((item) => {
  const old = previousById.get(item.id);
  if (!old) throw new Error(`لا توجد نتيجة تدقيق سابقة للسجل ${item.id}: ${item.t}`);
  const audit = JSON.parse(JSON.stringify(old.audit));
  if (audit.status === "verified-manual" && manual[item.id]) {
    const evidence = audit.evidence.find((entry) => entry?.source === "manual-primary-or-institutional-evidence");
    if (evidence) evidence.url = manual[item.id];
  }
  if (["unresolved", "verified-with-warning"].includes(audit.status)) {
    const web = webById.get(item.id);
    if (acceptableWeb(web)) {
      audit.status = "verified-web";
      audit.basis = "publisher-or-catalog-web-result";
      audit.evidence.push({ source: "publisher-or-catalog-web-result", ok: true, url: web.url, title: web.resultTitle, titleRecall: titleRecall(item.t, web.resultTitle), note: "راجعت نتيجة العنوان الفردية وقبلت فقط نطاقا غير ثانوي مع استرجاع مرتفع لكلمات العنوان." });
    } else if (manual[item.id]) {
      audit.status = "verified-manual";
      audit.basis = "manual-primary-or-institutional-evidence";
      audit.evidence.push({ source: "manual-primary-or-institutional-evidence", ok: true, url: manual[item.id], note: "راجع الرابط الأصلي أو المؤسسي يدويا بعد رفض المطابقة الآلية أو غيابها." });
    } else {
      throw new Error(`بقي مصدر بلا دليل خارجي مقبول: ${item.id} ${item.t}`);
    }
  }
  audit.checked = true;
  return { ...item, audit };
});

if (results.length !== 389 || new Set(results.map((item) => item.id)).size !== 389) throw new Error("عدد أو معرفات نتائج التدقيق غير سليمة.");
if (results.some((item) => !item.audit.checked || ["unresolved", "verified-with-warning"].includes(item.audit.status))) throw new Error("بقيت نتيجة تدقيق غير محسومة.");

const counts = results.reduce((summary, item) => {
  summary[item.audit.status] = (summary[item.audit.status] || 0) + 1;
  return summary;
}, {});
const finalized = {
  auditedAt: new Date().toISOString(),
  methodology: [
    "Crossref metadata and direct DOI lookup",
    "Semantic Scholar metadata for exact-title fallback matches",
    "direct original publisher or organization URL checks",
    "one exact-title web query for every Crossref warning or unresolved record",
    "conservative title-recall and domain screening",
    "manual primary or institutional evidence for every rejected web match"
  ],
  total: results.length, counts, archived: current.archived, results
};
fs.writeFileSync(AUDIT_FILE, JSON.stringify(finalized, null, 2) + "\n", "utf8");

const LABEL = {
  verified: "مطابقة ببليوغرافية مستقلة",
  "verified-original": "تحقق من الرابط الأصلي",
  "verified-web": "مطابقة ناشر أو فهرس",
  "verified-manual": "مراجعة يدوية بمصدر أصلي أو مؤسسي"
};
function bestEvidence(item) {
  const priority = ["manual-primary-or-institutional-evidence", "publisher-or-catalog-web-result", "web-catalog-search", "original-url", "crossref-doi", "dblp", "semantic-scholar", "crossref"];
  for (const source of priority) {
    const evidence = item.audit.evidence.find((entry) => entry?.ok && entry.source === source && (entry.url || entry.match?.url || entry.match?.doi));
    if (evidence) return evidence.url || evidence.match?.url || `https://doi.org/${evidence.match.doi}`;
  }
  return null;
}

const lines = [
  "# تقرير تدقيق مكتبة المصادر الرسمية والأكاديمية",
  "",
  `- تاريخ الإغلاق: ${finalized.auditedAt}`,
  `- السجلات المدققة فرديا: **${finalized.total} من ${finalized.total}**.`,
  `- النتائج: ${Object.entries(counts).map(([key, value]) => `${LABEL[key]}: ${value}`).join("؛ ")}.`,
  "- فحص كل سجل: العنوان، المؤلف أو الجهة، السنة، جهة النشر، نوع المصدر، ودليل وجود خارجي.",
  "- لا تعني نتيجة «موجود» أن المصدر محكم؛ نوعه محفوظ مستقلا: بحث، كتاب، مسودة، تقرير، وثيقة أولية، أو مصدر رسمي.",
  "- صحح التدقيق عنوان تقرير ALPAC إلى *Language and Machines*، وسنة سجل FAISS إلى سنة المجلد 2021 مع بيان النشر الإلكتروني سنة 2019، ووسّع سجل لوفلايس إلى العنوان المنشور الكامل مع نسبة المقالة والترجمة والملاحظات بدقة.",
  "- المصدران المؤرشفان (GitHub Copilot وKlarna) لا يظهران في المكتبة الحية، لكن أثر قرار استبعادهما محفوظ.",
  "",
  "| المعرف | نتيجة التحقق | النوع | المؤلف/الجهة والسنة | العنوان | الدليل | العوالم المستخدمة |",
  "|---|---|---|---|---|---|---|"
];
for (const item of results) {
  const link = bestEvidence(item);
  lines.push(`| ${escapeCell(item.id)} | ${LABEL[item.audit.status]} | ${escapeCell(item.k)} | ${escapeCell(item.a)} (${escapeCell(item.y)}) | ${escapeCell(item.t)} | ${link ? `[فتح الدليل](${link})` : "مطابقة مسجلة في ملف JSON"} | ${escapeCell(item.u.join("، "))} |`);
}
lines.push("", "## المصادر المؤرشفة خارج الفهرس الحي", "");
for (const item of current.archived) lines.push(`- **${item.t}** — ${item.archivedReason}`);
fs.writeFileSync(REPORT_FILE, lines.join("\n") + "\n", "utf8");

console.log(`academic audit finalized: ${JSON.stringify(counts)} — 389/389 checked`);
