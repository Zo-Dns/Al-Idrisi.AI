// اختبار صحة مقاييس جودة البيانات وعملياتها — مستخرجة من الاطلس المبني نفسه
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);

const html = readFileSync(new URL("../pages/ai-how-ai-works.html", import.meta.url), "utf8");
const start = html.indexOf("/* ===== DATA LAB MATH:");
const end = html.indexOf("/*__LAB_DOM__*/", start);
if (start < 0 || end < 0) throw new Error("DATA LAB MATH markers not found");
const code = html.slice(start, end) +
  "\nmodule.exports = { dataOriginal, dataCompleteness, dataUniqueness, dataConsistency, dataValidity, dataQualityScore, dataImpute, dataDedupe, dataStandardize, dataHandleOutliers, DATA_VALID_CITIES };\n";
writeFileSync(new URL("./data-lab-extracted.cjs", import.meta.url), code);
const M = require2("./data-lab-extracted.cjs");

let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? "PASS" : "FAIL") + " | " + name + (detail ? " | " + detail : ""));
  if (!ok) failures++;
};
const pct = (v) => Math.round(v * 100) + "%";

/* 1) الجدول الاصلي فوضوي فعلا: كل بُعد جودة دون 100% */
const orig = M.dataOriginal();
check("original-incomplete", M.dataCompleteness(orig) < 1, "comp=" + pct(M.dataCompleteness(orig)));
check("original-has-duplicates", M.dataUniqueness(orig) < 1, "uniq=" + pct(M.dataUniqueness(orig)));
check("original-inconsistent-cities", M.dataConsistency(orig) < 1, "cons=" + pct(M.dataConsistency(orig)));
check("original-has-outlier", M.dataValidity(orig) < 1, "valid=" + pct(M.dataValidity(orig)));

/* 2) كل عملية ترفع بُعدها الى 100% بالضبط */
check("impute→completeness=100%", M.dataCompleteness(M.dataImpute(orig)) === 1, pct(M.dataCompleteness(M.dataImpute(orig))));
check("dedupe→uniqueness=100%", M.dataUniqueness(M.dataDedupe(orig)) === 1, pct(M.dataUniqueness(M.dataDedupe(orig))));
check("standardize→consistency=100%", M.dataConsistency(M.dataStandardize(orig)) === 1, pct(M.dataConsistency(M.dataStandardize(orig))));
check("outliers→validity=100%", M.dataValidity(M.dataHandleOutliers(orig)) === 1, pct(M.dataValidity(M.dataHandleOutliers(orig))));

/* 3) تطبيق الكل بالترتيب → درجة كلية 100% */
let r = M.dataImpute(orig); r = M.dataDedupe(r); r = M.dataStandardize(r); r = M.dataHandleOutliers(r);
check("clean-all→score=100%", M.dataQualityScore(r) === 1, "score=" + pct(M.dataQualityScore(r)));

/* 4) لا شيء ناقص او شاذ او خارج المدن المعتمدة بعد التنظيف الكامل */
const noMissing = r.every((row) => Object.values(row).every((v) => v !== null && v !== undefined && v !== ""));
const validCities = r.every((row) => M.DATA_VALID_CITIES.includes(row.city));
const validAges = r.every((row) => row.age >= 0 && row.age <= 120);
check("clean-all→no-missing", noMissing);
check("clean-all→canonical-cities", validCities, "cities=" + [...new Set(r.map(x => x.city))].join(","));
check("clean-all→valid-ages", validAges, "maxAge=" + Math.max(...r.map(x => x.age)));

/* 5) العمليات لا تعدل المدخل الاصلي (نقاء دالي) */
const snap = JSON.stringify(orig);
M.dataImpute(orig); M.dataDedupe(orig); M.dataStandardize(orig); M.dataHandleOutliers(orig);
check("operations-are-pure", JSON.stringify(orig) === snap);

/* 6) التعويض لا يدخل شواذا جديدة: الوسيط المستخدم يستبعد القيمة الشاذة 200 (يبقى الشاذ لعملية الشواذ) */
const imp = M.dataImpute(orig);
const outOfRange = (rows) => rows.filter((x) => x.age != null && (x.age < 0 || x.age > 120)).length;
check("impute-adds-no-outliers", outOfRange(imp) === outOfRange(orig), "orig=" + outOfRange(orig) + " imp=" + outOfRange(imp));
const filledAges = imp.filter((x, i) => orig[i].age == null).map((x) => x.age);
check("imputed-cells-in-range", filledAges.every((a) => a >= 0 && a <= 120), "filled=[" + filledAges.join(",") + "]");

if (failures) { console.log("\n" + failures + " FAILURES"); process.exit(1); }
console.log("\nALL DATA LAB TESTS PASSED");
