// اختبار صحة رياضيات مختبر الاخلاق (العدالة والتحيز) — مستخرجة من الاطلس المبني نفسه
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);

const html = readFileSync(new URL("../pages/ai-how-ai-works.html", import.meta.url), "utf8");
const start = html.indexOf("/* ===== ETHICS LAB MATH:");
const end = html.indexOf("/*__LAB_DOM__*/", start);
if (start < 0 || end < 0) throw new Error("ETHICS LAB MATH markers not found");
const code = html.slice(start, end) +
  "\nmodule.exports = { efMulberry32, efGauss, efClamp01, efGenGroup, efConfusion, efMetrics, efNormCdf, efPop, efLogRegFit, efLogRegPredict, efGenPop, efFeatures, efSelectionRates, efDI };\n";
writeFileSync(new URL("./ethics-lab-extracted.cjs", import.meta.url), code);
const M = require2("./ethics-lab-extracted.cjs");

let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? "PASS" : "FAIL") + " | " + name + (detail ? " | " + detail : ""));
  if (!ok) failures++;
};

/* ==================================================================
   التبويب 1 — استحالة العدالة (شولديتشوفا / كلاينبرغ)
   ================================================================== */
const MU1 = 0.65, MU0 = 0.35, SD = 0.15, N = 4000, SEED = 12345, PA = 0.60, PB = 0.30;
const rng = M.efMulberry32(SEED);
const A = M.efGenGroup(rng, N, PA, MU1, MU0, SD);
const B = M.efGenGroup(rng, N, PB, MU1, MU0, SD);
const grid = []; for (let i = 1; i < 100; i++) grid.push(i / 100);

/* A1 — متطابقة شولديتشوفا FPR = p/(1-p) * (1-PPV)/PPV * (1-FNR) على اعداد صحيحة تجريبية الى 1e-12 */
{
  let maxErr = 0, tested = 0;
  for (const g of [A, B]) for (const tau of grid) {
    const m = M.efMetrics(M.efConfusion(g, tau));
    if (!(m.ppv > 0) || !(m.base < 1) || !isFinite(m.fpr) || !isFinite(m.fnr)) continue;
    const rhs = (m.base / (1 - m.base)) * ((1 - m.ppv) / m.ppv) * (1 - m.fnr);
    maxErr = Math.max(maxErr, Math.abs(m.fpr - rhs)); tested++;
  }
  check("A1 Chouldechova identity (empirical, <1e-12)", maxErr < 1e-12 && tested > 100, "maxErr=" + maxErr.toExponential(2) + " tested=" + tested);
}

/* A2 — الشرط المسبق: معدلات الاساس تختلف بـ >= 0.10 */
{
  const bA = M.efMetrics(M.efConfusion(A, 0.5)).base, bB = M.efMetrics(M.efConfusion(B, 0.5)).base;
  check("A2 unequal base rates (>=0.10)", Math.abs(bA - bB) >= 0.10, "baseA=" + bA.toFixed(3) + " baseB=" + bB.toFixed(3));
}

/* A3 — تكافو الاحتمالات يتحقق لكن تكافو التنبؤ يفشل: عند عتبة موحدة، PPV gap > 0.08 (سكاني مغلق) */
{
  const pa = M.efPop(PA, 0.5, MU1, MU0, SD), pb = M.efPop(PB, 0.5, MU1, MU0, SD);
  const eoGap = Math.max(Math.abs(pa.tpr - pb.tpr), Math.abs(pa.fpr - pb.fpr));
  const ppvGap = Math.abs(pa.ppv - pb.ppv);
  check("A3 equalized-odds holds but PPV gap>0.08", eoGap < 1e-9 && ppvGap > 0.08, "eoGap=" + eoGap.toExponential(2) + " ppvGap=" + ppvGap.toFixed(3));
}

/* A4 — تكافو التنبؤ يفرض فشل تكافو الاحتمالات: عتبة أ=0.5 مرجعية، نطابق PPV لـ ب، فيتباعد معدل الخطا > 0.08 */
{
  const paRef = M.efPop(PA, 0.5, MU1, MU0, SD);
  let best = null;
  for (const tb of grid) {
    const pb = M.efPop(PB, tb, MU1, MU0, SD);
    if (!(pb.selRate > 0.05)) continue;
    const d = Math.abs(paRef.ppv - pb.ppv);
    if (!best || d < best.d) best = { tb, d, pb };
  }
  const eoGap = best ? Math.max(Math.abs(paRef.fpr - best.pb.fpr), Math.abs(paRef.fnr - best.pb.fnr)) : NaN;
  check("A4 predictive-parity forces equalized-odds gap>0.08", !!best && best.d < 0.01 && eoGap > 0.08, best ? "tauB=" + best.tb + " dPPV=" + best.d.toFixed(4) + " eoGap=" + eoGap.toFixed(3) : "none");
}

/* A5 — الاستحالة الشاملة عبر النقاط غير التافهة: لا زوج عتبتين (معدلا اختيار في [0.15,0.85]) يحقق
   التكافو الديموغرافي وتكافو الاحتمالات وتكافو التنبؤ معا ضمن eps=0.02 */
{
  const eps = 0.02; let allThree = null, minCombined = Infinity;
  for (const ta of grid) for (const tb of grid) {
    const pa = M.efPop(PA, ta, MU1, MU0, SD), pb = M.efPop(PB, tb, MU1, MU0, SD);
    if (pa.selRate < 0.15 || pa.selRate > 0.85 || pb.selRate < 0.15 || pb.selRate > 0.85) continue;
    const dDP = Math.abs(pa.selRate - pb.selRate);
    const dEO = Math.max(Math.abs(pa.tpr - pb.tpr), Math.abs(pa.fpr - pb.fpr));
    const dPP = Math.abs(pa.ppv - pb.ppv);
    minCombined = Math.min(minCombined, Math.max(dDP, dEO, dPP));
    if (dDP < eps && dEO < eps && dPP < eps) { allThree = { ta, tb }; break; }
  }
  check("A5 no non-trivial pair satisfies all three", allThree === null, allThree ? "counterexample " + JSON.stringify(allThree) : "confirmed; best max-gap=" + minCombined.toFixed(3));
}

/* A6 — انحلال: معدلات اساس متساوية => مجموعتان مستقلتان بنفس معدل الاساس تحققان الثلاثة تجريبيا
   عند عتبة موحدة ضمن O(1/sqrt(N)). اختبار حقيقي بعينتين مختلفتين، لا مقارنة قيمة بنفسها. */
{
  const gA = M.efGenGroup(M.efMulberry32(4242), N, PA, MU1, MU0, SD);
  const gB = M.efGenGroup(M.efMulberry32(9317), N, PA, MU1, MU0, SD);
  const ma = M.efMetrics(M.efConfusion(gA, 0.5)), mb = M.efMetrics(M.efConfusion(gB, 0.5));
  const tol = 4 / Math.sqrt(N);
  const dDP = Math.abs(ma.selRate - mb.selRate), dEO = Math.max(Math.abs(ma.tpr - mb.tpr), Math.abs(ma.fpr - mb.fpr)), dPP = Math.abs(ma.ppv - mb.ppv);
  check("A6 equal base rates => all three co-hold (two independent samples)", dDP < tol && dEO < tol && dPP < tol,
    "dDP=" + dDP.toFixed(4) + " dEO=" + dEO.toFixed(4) + " dPP=" + dPP.toFixed(4) + " tol=" + tol.toFixed(4));
}

/* A7 — انحلال: مصنف مثالي (درجات مفصولة) => FPR=FNR=0، PPV=NPV=1 للمجموعتين رغم اختلاف معدل الاساس */
{
  const r2 = M.efMulberry32(SEED + 1);
  const Ap = M.efGenGroup(r2, N, PA, 0.92, 0.08, 0.05), Bp = M.efGenGroup(r2, N, PB, 0.92, 0.08, 0.05);
  const ma = M.efMetrics(M.efConfusion(Ap, 0.5)), mb = M.efMetrics(M.efConfusion(Bp, 0.5));
  const perfect = (m) => m.fpr === 0 && m.fnr === 0 && Math.abs(m.ppv - 1) < 1e-9 && Math.abs(m.npv - 1) < 1e-9;
  check("A7 perfect classifier => all criteria co-hold", perfect(ma) && perfect(mb), "A ppv=" + ma.ppv.toFixed(3) + " B ppv=" + mb.ppv.toFixed(3));
}

/* A8 — التجريبي (النقاط الحقيقية) يقارب السكاني ضمن O(1/sqrt(N)) */
{
  const ea = M.efMetrics(M.efConfusion(A, 0.5)), eb = M.efMetrics(M.efConfusion(B, 0.5));
  const pa = M.efPop(PA, 0.5, MU1, MU0, SD), pb = M.efPop(PB, 0.5, MU1, MU0, SD);
  const dev = Math.max(Math.abs(ea.ppv - pa.ppv), Math.abs(eb.ppv - pb.ppv), Math.abs(ea.tpr - pa.tpr), Math.abs(eb.fpr - pb.fpr));
  check("A8 empirical ~ analytic (O(1/sqrtN))", dev < 4 / Math.sqrt(N), "maxDev=" + dev.toFixed(4));
}

/* المثال المرجعي: t=0.80,f=0.30 => PPV 0.800 مقابل 0.533 (نظير XOR-عند-50%) */
{
  const ppv = (p, t, f) => (p * t) / (p * t + (1 - p) * f);
  check("worked instance PPV 0.800 vs 0.533 (gap 0.267)", Math.abs(ppv(0.6, 0.8, 0.3) - 0.8) < 1e-9 && Math.abs(ppv(0.3, 0.8, 0.3) - 0.5333333) < 1e-6, "gap=" + (ppv(0.6, 0.8, 0.3) - ppv(0.3, 0.8, 0.3)).toFixed(4));
}

/* ==================================================================
   التبويب 2 — التمييز بالوكالة
   ================================================================== */
const N2 = 2000, K = 5, EPS = 0.18, Bb = 0.2, ITERS = 400, LR = 1.0, SEED2 = 20260708;
const rng2 = M.efMulberry32(SEED2);
const pop = M.efGenPop(rng2, N2, K, EPS, Bb);
const y = pop.map(r => r.yTilde);
const rate = (a, key) => { let n = 0, s = 0; for (const r of pop) if (r.a === a) { n++; s += r[key]; } return s / n; };

check("T0a equal deserved rate (Y* ⟂ A)", Math.abs(rate(0, "yStar") - rate(1, "yStar")) < 0.03, "A0=" + rate(0, "yStar").toFixed(3) + " A1=" + rate(1, "yStar").toFixed(3));
check("T0b labels biased (Ytilde lower for A=1)", rate(0, "yTilde") - rate(1, "yTilde") > 0.1, "A0=" + rate(0, "yTilde").toFixed(3) + " A1=" + rate(1, "yTilde").toFixed(3));

const wWith = M.efLogRegFit(pop.map(r => M.efFeatures(r, "withA")), y, ITERS, LR);
const srWith = M.efSelectionRates(pop, wWith, "withA"); const diWith = M.efDI(srWith.s0, srWith.s1);
check("T1 with sensitive attribute: DI<0.8 (bias reproduced)", diWith < 0.8, "DI=" + diWith.toFixed(3));

const wBlind = M.efLogRegFit(pop.map(r => M.efFeatures(r, "blind")), y, ITERS, LR);
const srBlind = M.efSelectionRates(pop, wBlind, "blind"); const diBlind = M.efDI(srBlind.s0, srBlind.s1);
check("T2 blindness (delete A, keep proxies): DI still<0.85", diBlind < 0.85, "DI=" + diBlind.toFixed(3));
check("T2b blindness retains most disparity (gap_b>=0.6*gap_a)", (1 - diBlind) >= 0.6 * (1 - diWith), "gap_a=" + (1 - diWith).toFixed(3) + " gap_b=" + (1 - diBlind).toFixed(3));

const wMerit = M.efLogRegFit(pop.map(r => M.efFeatures(r, "meritOnly")), y, ITERS, LR);
const srMerit = M.efSelectionRates(pop, wMerit, "meritOnly"); const diMerit = M.efDI(srMerit.s0, srMerit.s1);
check("T3 merit-only: DI -> ~1 (disparity gone)", diMerit > 0.9, "DI=" + diMerit.toFixed(3));

{
  const aTarget = pop.map(r => r.a);
  const wAux = M.efLogRegFit(pop.map(r => M.efFeatures(r, "blind")), aTarget, ITERS, LR);
  let ok = 0; for (const r of pop) if ((M.efLogRegPredict(wAux, M.efFeatures(r, "blind")) >= 0.5 ? 1 : 0) === r.a) ok++;
  const wAux2 = M.efLogRegFit(pop.map(r => M.efFeatures(r, "meritOnly")), aTarget, ITERS, LR);
  let ok2 = 0; for (const r of pop) if ((M.efLogRegPredict(wAux2, M.efFeatures(r, "meritOnly")) >= 0.5 ? 1 : 0) === r.a) ok2++;
  check("T4 proxies reconstruct A (acc{M,P}>=0.85)", ok / pop.length >= 0.85, "acc=" + (ok / pop.length).toFixed(3));
  check("T4b merit alone does NOT reconstruct A (~0.5)", Math.abs(ok2 / pop.length - 0.5) < 0.06, "acc=" + (ok2 / pop.length).toFixed(3));
}

if (failures) { console.log("\n" + failures + " FAILURES"); process.exit(1); }
console.log("\nALL ETHICS LAB TESTS PASSED");
