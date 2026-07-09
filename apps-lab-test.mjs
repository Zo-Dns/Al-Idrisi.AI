import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const html = readFileSync(new URL("./ai-how-ai-works.html", import.meta.url), "utf8");
const start = html.indexOf("/* ===== APPS LAB MATH:");
const end = html.indexOf("/*__LAB_DOM__*/", start);
if (start < 0 || end < 0) throw new Error("APPS LAB MATH markers not found");
const code = html.slice(start, end) +
  "\nmodule.exports = { APP_DOMAINS, appClamp01, appLogit, appSigmoid, appTheoryThreshold, appBetaShape, appMakeBins, appBaseRate, appConfusion, appMetrics, appEvaluate, appFindBestThreshold, appDomainAnalysis };\n";
writeFileSync(new URL("./apps-lab-extracted.cjs", import.meta.url), code);
const require2 = createRequire(import.meta.url);
const M = require2("./apps-lab-extracted.cjs");

let failures = 0;
function check(name, ok, detail = "") {
  console.log((ok ? "PASS" : "FAIL") + " | " + name + (detail ? " | " + detail : ""));
  if (!ok) failures++;
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/* عينة يدوية صغيرة: قاعدة score >= threshold */
{
  const bins = [
    { score: 0.9, pos: 8, neg: 2, total: 10 },
    { score: 0.6, pos: 3, neg: 7, total: 10 },
    { score: 0.2, pos: 1, neg: 9, total: 10 },
  ];
  const cm = M.appConfusion(bins, 0.6);
  check("manual confusion matrix with score>=threshold",
    near(cm.TP, 11) && near(cm.FP, 9) && near(cm.FN, 1) && near(cm.TN, 9) && near(cm.N, 30),
    `TP=${cm.TP} FP=${cm.FP} FN=${cm.FN} TN=${cm.TN}`);
  const met = M.appMetrics(cm, 2, 5);
  check("manual metrics and expected cost",
    near(met.recall, 11 / 12) && near(met.precision, 11 / 20) && near(met.specificity, 9 / 18) &&
    near(met.costPerCase, (9 * 2 + 1 * 5) / 30),
    `recall=${met.recall.toFixed(4)} ppv=${met.precision.toFixed(4)} cost=${met.costPerCase.toFixed(4)}`);
}

/* كلفة العينة تساوي الصيغة السكانية باستعمال معدل اساس العينة */
{
  const bins = M.appMakeBins(M.APP_DOMAINS.medical, 0);
  const ev = M.appEvaluate(bins, 0.12, M.APP_DOMAINS.medical.costFP, M.APP_DOMAINS.medical.costFN);
  const pi = M.appBaseRate(bins);
  const sampleCost = ev.metrics.costPerCase;
  const popCost = M.APP_DOMAINS.medical.costFP * (1 - pi) * ev.metrics.fpr +
    M.APP_DOMAINS.medical.costFN * pi * ev.metrics.fnr;
  check("cost formula equals weighted FPR/FNR form", near(sampleCost, popCost, 1e-12),
    `sample=${sampleCost.toFixed(8)} weighted=${popCost.toFixed(8)}`);
}

/* عند درجات معايرة، عتبة Bayes النظرية قريبة من عتبة اقل كلفة على شبكة 0.01 */
{
  for (const [key, d] of Object.entries(M.APP_DOMAINS)) {
    const a = M.appDomainAnalysis(key, 0.5, 0);
    check("calibrated Bayes threshold near empirical optimum: " + key,
      Math.abs(a.costBest.threshold - a.theory) <= 0.01,
      `theory=${a.theory.toFixed(4)} best=${a.costBest.threshold.toFixed(2)}`);
  }
}

/* عند تكاليف متناظرة، اعلى دقة = اقل كلفة؛ وعند تكاليف غير متناظرة غالبا تختلف */
{
  const d = { ...M.APP_DOMAINS.moderation, costFP: 1, costFN: 1 };
  const bins = M.appMakeBins(d, 0);
  const cb = M.appFindBestThreshold(bins, 1, 1, "cost");
  const ab = M.appFindBestThreshold(bins, 1, 1, "accuracy");
  check("symmetric costs make cost optimum equal accuracy optimum", near(cb.threshold, ab.threshold),
    `cost=${cb.threshold} acc=${ab.threshold}`);

  const med = M.appDomainAnalysis("medical", 0.5, 0);
  check("asymmetric domain differs from accuracy optimum", Math.abs(med.costBest.threshold - med.accBest.threshold) >= 0.2,
    `cost=${med.costBest.threshold.toFixed(2)} acc=${med.accBest.threshold.toFixed(2)}`);
}

/* انحراف المعايرة يجعل العتبة القديمة غير مثلى */
{
  const base = M.appDomainAnalysis("fraud", 0.5, 0);
  const shifted = M.appDomainAnalysis("fraud", base.costBest.threshold, 0.6);
  const oldCost = shifted.current.metrics.costPerCase;
  const newCost = shifted.costBest.ev.metrics.costPerCase;
  check("production drift makes old calibrated threshold suboptimal", oldCost > newCost + 0.01,
    `old=${oldCost.toFixed(4)} new=${newCost.toFixed(4)} oldT=${base.costBest.threshold.toFixed(2)} newT=${shifted.costBest.threshold.toFixed(2)}`);
}

/* الدرجات المعايرة: متوسط P(Y=1) داخل كل bins يساوي متوسط score موزونا عندما لا يوجد drift */
{
  const bins = M.appMakeBins(M.APP_DOMAINS.recommend, 0);
  let pos = 0, scoreMass = 0, total = 0;
  for (const b of bins) { pos += b.pos; scoreMass += b.score * b.total; total += b.total; }
  check("calibration identity at drift=0", near(pos / total, scoreMass / total, 1e-12),
    `base=${(pos / total).toFixed(6)} avgScore=${(scoreMass / total).toFixed(6)}`);
}

if (failures) { console.log("\n" + failures + " FAILURES"); process.exit(1); }
console.log("\nALL APPS LAB TESTS PASSED");
