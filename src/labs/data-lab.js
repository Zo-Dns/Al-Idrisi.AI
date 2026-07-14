/* ==================== مختبر تنظيف البيانات — مقاييس جودة حقيقية وعمليات حقيقية ==================== */
/* ===== DATA LAB MATH: رياضيات صرفة بلا DOM (تختبر آليا قبل النشر) ===== */
const DATA_FIELDS = ["name", "city", "age", "income", "label"];
const DATA_VALID_CITIES = ["بغداد", "البصرة", "اربيل", "الموصل"];
const DATA_CITY_CANON = { "Baghdad": "بغداد", "baghdad": "بغداد", "بغداد ": "بغداد", "بصرة": "البصرة", "basra": "البصرة", "Erbil": "اربيل", "اربيل ": "اربيل" };
const DATA_AGE_MAX = 120;

/* الجدول الفوضوي الاصلي: قيم ناقصة (null)، شاذة (عمر 200)، مكررة، مدن غير متسقة */
function dataOriginal() {
  return [
    { name: "علي", city: "بغداد", age: 34, income: 800, label: "مقبول" },
    { name: "سارة", city: "Baghdad", age: 28, income: 950, label: "مقبول" },
    { name: "حسن", city: "البصرة", age: null, income: 600, label: "مرفوض" },
    { name: "نور", city: "بصرة", age: 45, income: null, label: "مقبول" },
    { name: "علي", city: "بغداد", age: 34, income: 800, label: "مقبول" },
    { name: "مريم", city: "اربيل", age: 200, income: 1200, label: "مقبول" },
    { name: "احمد", city: "الموصل", age: 52, income: 700, label: "مرفوض" },
    { name: "ليلى", city: "بغداد ", age: 31, income: null, label: "مقبول" },
    { name: "يوسف", city: "البصرة", age: 39, income: 880, label: "مرفوض" },
    { name: "زينب", city: "Erbil", age: null, income: 1050, label: "مقبول" },
    { name: "حسن", city: "البصرة", age: null, income: 600, label: "مرفوض" },
    { name: "كريم", city: "الموصل", age: 47, income: 760, label: "مقبول" },
  ];
}

const dataIsEmpty = (v) => v === null || v === undefined || v === "";
function dataRowKey(r) { return DATA_FIELDS.map((f) => String(r[f])).join("|"); }

/* الابعاد: كل واحد نسبة بين 0 و1 محسوبة من حالة الجدول */
function dataCompleteness(rows) {
  let total = 0, filled = 0;
  for (const r of rows) for (const f of DATA_FIELDS) { total++; if (!dataIsEmpty(r[f])) filled++; }
  return total ? filled / total : 1;
}
function dataUniqueness(rows) {
  if (!rows.length) return 1;
  const seen = new Set(rows.map(dataRowKey));
  return seen.size / rows.length;
}
function dataConsistency(rows) {
  let total = 0, ok = 0;
  for (const r of rows) { if (dataIsEmpty(r.city)) continue; total++; if (DATA_VALID_CITIES.includes(r.city)) ok++; }
  return total ? ok / total : 1;
}
function dataValidity(rows) {
  let total = 0, ok = 0;
  for (const r of rows) { if (dataIsEmpty(r.age)) continue; total++; if (r.age >= 0 && r.age <= DATA_AGE_MAX) ok++; }
  return total ? ok / total : 1;
}
function dataQualityScore(rows) {
  return (dataCompleteness(rows) + dataUniqueness(rows) + dataConsistency(rows) + dataValidity(rows)) / 4;
}

/* احصاءات مساعدة للتعويض (على القيم الصحيحة فقط) */
function dataMedianAge(rows) {
  const vals = rows.map((r) => r.age).filter((a) => !dataIsEmpty(a) && a >= 0 && a <= DATA_AGE_MAX).sort((x, y) => x - y);
  if (!vals.length) return 0;
  const m = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[m] : Math.round((vals[m - 1] + vals[m]) / 2);
}
function dataMedianIncome(rows) {
  const vals = rows.map((r) => r.income).filter((v) => !dataIsEmpty(v)).sort((x, y) => x - y);
  if (!vals.length) return 0;
  const m = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[m] : Math.round((vals[m - 1] + vals[m]) / 2);
}

/* العمليات: كل واحدة تعيد صفوفا جديدة (لا تعدل المدخل) */
function dataImpute(rows) {
  const medAge = dataMedianAge(rows), medInc = dataMedianIncome(rows);
  return rows.map((r) => ({ ...r,
    age: dataIsEmpty(r.age) ? medAge : r.age,
    income: dataIsEmpty(r.income) ? medInc : r.income,
    city: dataIsEmpty(r.city) ? DATA_VALID_CITIES[0] : r.city,
    name: dataIsEmpty(r.name) ? "غير معروف" : r.name,
    label: dataIsEmpty(r.label) ? "مقبول" : r.label,
  }));
}
function dataDedupe(rows) {
  const seen = new Set(), out = [];
  for (const r of rows) { const k = dataRowKey(r); if (!seen.has(k)) { seen.add(k); out.push(r); } }
  return out;
}
function dataStandardize(rows) {
  return rows.map((r) => {
    let c = r.city;
    if (!dataIsEmpty(c)) { c = c.trim(); if (DATA_CITY_CANON[r.city]) c = DATA_CITY_CANON[r.city]; else if (DATA_CITY_CANON[c]) c = DATA_CITY_CANON[c]; }
    return { ...r, city: c };
  });
}
function dataHandleOutliers(rows) {
  const med = dataMedianAge(rows);
  return rows.map((r) => ({ ...r, age: (!dataIsEmpty(r.age) && (r.age < 0 || r.age > DATA_AGE_MAX)) ? med : r.age }));
}
/*__LAB_DOM__*/

const LAB_MAP = {
  cleaning: 0, quality: 0, completeness: 0, duplicates: 0, consistency: 0,
  outliers: 0, imputation: 0, "accuracy-dq": 0, preprocessing: 0, noise: 0, root: 0,
};
const LAB_BTN_TEXT = ["🔬 نظف جدولا فوضويا حقيقيا"];
let labOpen = false;
const labEl = document.getElementById("lab");
document.getElementById("labParams").textContent = "4 ابعاد جودة قياسية · عمليات تنظيف حقيقية";

let dataRows = dataOriginal();

function dataCellClass(r, f, allRows, idx, dupSet) {
  if (dataIsEmpty(r[f])) return "cell-missing";
  if (f === "age" && (r.age < 0 || r.age > DATA_AGE_MAX)) return "cell-outlier";
  if (f === "city" && !DATA_VALID_CITIES.includes(r.city)) return "cell-inconsistent";
  return "";
}
function dataRender() {
  const HEAD = { name: "الاسم", city: "المدينة", age: "العمر", income: "الدخل", label: "القرار" };
  const HEAD_EN = { name: "name", city: "city", age: "age", income: "income", label: "label" };
  /* تحديد الصفوف المكررة (كل ظهور بعد الاول) */
  const seen = new Set(), dupRow = [];
  dataRows.forEach((r) => { const k = dataRowKey(r); dupRow.push(seen.has(k)); seen.add(k); });
  let html = '<table class="dataTbl"><thead><tr>';
  for (const f of DATA_FIELDS) html += "<th>" + HEAD[f] + '<div class="en">' + HEAD_EN[f] + "</div></th>";
  html += "</tr></thead><tbody>";
  dataRows.forEach((r, i) => {
    html += '<tr class="' + (dupRow[i] ? "row-dup" : "") + '">';
    for (const f of DATA_FIELDS) {
      const cls = dataCellClass(r, f);
      const val = dataIsEmpty(r[f]) ? "—" : r[f];
      html += '<td class="' + cls + '">' + escapeHtml(String(val)) + "</td>";
    }
    html += "</tr>";
  });
  html += "</tbody></table>";
  document.getElementById("dataTableWrap").innerHTML = html;
  dataUpdateMetrics();
}
function dataSetBar(id, v) {
  const pct = Math.round(v * 100);
  const fill = document.getElementById("mfill-" + id);
  fill.style.width = pct + "%";
  fill.style.background = v >= 0.999 ? "#7ce38b" : (v >= 0.7 ? "#ffb259" : "#f87171");
  document.getElementById("mval-" + id).textContent = pct + "%";
}
function dataUpdateMetrics() {
  const comp = dataCompleteness(dataRows), uniq = dataUniqueness(dataRows), cons = dataConsistency(dataRows), val = dataValidity(dataRows);
  dataSetBar("comp", comp); dataSetBar("uniq", uniq); dataSetBar("cons", cons); dataSetBar("acc", val);
  const score = Math.round((comp + uniq + cons + val) / 4 * 100);
  const el = document.getElementById("dataScore");
  el.textContent = score;
  el.style.color = score >= 100 ? "#7ce38b" : (score >= 70 ? "#ffb259" : "#f87171");
  document.getElementById("dataScoreNote").textContent = score >= 100
    ? "بيانات نظيفة جاهزة للتدريب ✓"
    : "بيانات فوضوية — نظفها لترفع الدرجة";
}
function dataApply(fn, msg) {
  dataRows = fn(dataRows);
  document.getElementById("dataOpNote").textContent = msg;
  dataRender();
}
document.getElementById("opImpute").addEventListener("click", () => dataApply(dataImpute, "عوضنا القيم الناقصة بالوسيط (للاعمار والدخل) والاكثر شيوعا — فارتفع الاكتمال."));
document.getElementById("opDedupe").addEventListener("click", () => dataApply(dataDedupe, "حذفنا الصفوف المكررة (ابقينا نسخة واحدة) — فارتفع التفرد."));
document.getElementById("opStd").addEventListener("click", () => dataApply(dataStandardize, "وحدنا اسماء المدن الى صيغة معتمدة (Baghdad وبصرة و«بغداد » كلها صارت واحدة) — فارتفع الاتساق."));
document.getElementById("opOutlier").addEventListener("click", () => dataApply(dataHandleOutliers, "عالجنا الاعمار الشاذة (200 خارج النطاق المنطقي) باستبدالها بالوسيط — فارتفعت الصحة."));
document.getElementById("opAll").addEventListener("click", () => {
  dataRows = dataHandleOutliers(dataStandardize(dataDedupe(dataImpute(dataRows))));
  document.getElementById("dataOpNote").textContent = "طبقنا كل العمليات بالترتيب — الجدول الان نظيف بدرجة جودة 100%.";
  dataRender();
});
document.getElementById("opReset").addEventListener("click", () => dataApply(dataOriginal, "اعدنا الجدول الى فوضاه الاصلية لتجرب من جديد."));

function openLab(mode) {
  closeCard();
  labOpen = true;
  labEl.classList.add("open");
  dataRender();
}
function closeLab() {
  labOpen = false;
  labEl.classList.remove("open");
}
document.getElementById("labClose").addEventListener("click", closeLab);

dataRender();
