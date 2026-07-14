// اختبار صحة رياضيات المختبر المستخرجة من الصفحة المبنية نفسها (نفس الكود الذي سيشغله المتصفح)
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);

const html = readFileSync(new URL("../pages/ai-how-ai-works.html", import.meta.url), "utf8");
const start = html.indexOf("/* ===== LAB MATH");
const end = html.indexOf("/*__LAB_DOM__*/");
if (start < 0 || end < 0) throw new Error("LAB MATH markers not found");
const code = html.slice(start, end) +
  "\nmodule.exports = { mulberry32, labLabel, labGenData, labNewNet, labForward, labTrainEpoch, labAccuracy, LAB_SIZES };\n";
writeFileSync(new URL("./lab-math-extracted.cjs", import.meta.url), code);
const M = require2("./lab-math-extracted.cjs");

const clone = (o) => JSON.parse(JSON.stringify(o));
let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? "PASS" : "FAIL") + " | " + name + (detail ? " | " + detail : ""));
  if (!ok) failures++;
};

/* 1) توزيع الاصناف: القرارات الاربعة كلها ممثلة */
const rng = M.mulberry32(42);
const { X, Y } = M.labGenData(rng, 500);
const counts = [0, 0, 0, 0];
Y.forEach((y) => counts[y]++);
check("class-distribution", counts.every((c) => c >= 30), "counts=" + counts.join(","));

/* 2) فحص التدرج عدديا: نستخرج تدرج الانتشار الخلفي من labTrainEpoch نفسه ونقارنه بالفرق المحدود */
const X20 = X.slice(0, 20), Y20 = Y.slice(0, 20);
const meanLoss = (net) => {
  let s = 0;
  for (let i = 0; i < X20.length; i++) {
    const p = M.labForward(net, X20[i]).a[M.LAB_SIZES.length - 1];
    s += -Math.log(p[Y20[i]] + 1e-9);
  }
  return s / X20.length;
};
const netA = M.labNewNet(M.mulberry32(7));
const netB = clone(netA);
M.labTrainEpoch(netB, X20, Y20, 1.0, M.mulberry32(1)); // دفعة واحدة (20<32): w -= 1.0 * g_mean
let maxRel = 0, checked = 0;
const eps = 1e-4;
const sampler = M.mulberry32(99);
for (let l = 0; l < netA.W.length; l++) {
  for (let t = 0; t < 5; t++) {
    const j = Math.floor(sampler() * netA.W[l].length);
    const i = Math.floor(sampler() * netA.W[l][j].length);
    const gBack = netA.W[l][j][i] - netB.W[l][j][i]; // = lr * g_mean = g_mean
    const save = netA.W[l][j][i];
    netA.W[l][j][i] = save + eps;
    const lp = meanLoss(netA);
    netA.W[l][j][i] = save - eps;
    const lm = meanLoss(netA);
    netA.W[l][j][i] = save;
    const gNum = (lp - lm) / (2 * eps);
    const rel = Math.abs(gBack - gNum) / Math.max(1e-7, Math.abs(gBack) + Math.abs(gNum));
    if (rel > maxRel) maxRel = rel;
    checked++;
  }
}
check("gradient-check (backprop vs numeric)", maxRel < 1e-3, "sampled=" + checked + " maxRelErr=" + maxRel.toExponential(2));

/* 3) التعلم الفعلي: الخسارة تهبط والدقة تتجاوز 85% خلال 240 دورة */
const net = M.labNewNet(M.mulberry32(42));
const trainX = X.slice(0, 400), trainY = Y.slice(0, 400);
const testX = X.slice(400), testY = Y.slice(400);
const accBefore = M.labAccuracy(net, testX, testY);
const trng = M.mulberry32(5);
let firstLoss = null, lastLoss = null, epochs = 0, acc = 0;
for (let e = 0; e < 240; e++) {
  const loss = M.labTrainEpoch(net, trainX, trainY, 0.25, trng);
  if (firstLoss === null) firstLoss = loss;
  lastLoss = loss;
  epochs++;
  acc = M.labAccuracy(net, testX, testY);
  if (acc >= 0.93) break;
}
check("learning-happens", lastLoss < firstLoss * 0.5, "loss " + firstLoss.toFixed(3) + " -> " + lastLoss.toFixed(3));
check("test-accuracy>=85%", acc >= 0.85, "accBefore=" + Math.round(accBefore * 100) + "% accAfter=" + Math.round(acc * 100) + "% epochs=" + epochs);

/* 4) السلوك التفاعلي: تحريك المنزلقات يغير القرار تغييرا صحيحا
      (نفس المسار الذي يسلكه المنزلق في الواجهة: inVals → labForward → argmax) */
const argmax = (p) => p.reduce((m, v, i, a) => (v > a[m] ? i : m), 0);
const predict = (x) => argmax(M.labForward(net, x).a[M.LAB_SIZES.length - 1]);
//               [جوع, عطش, قرب طعام, قرب ماء, خطر, طاقة, نهار]
const scenarios = [
  { x: [0.2, 0.2, 0.5, 0.5, 0.95, 0.7, 0.7], want: 2, name: "خطر مرتفع → يختبئ (Hide)" },
  { x: [0.95, 0.1, 0.9, 0.3, 0.0, 0.8, 0.8], want: 0, name: "جوع مرتفع وطعام قريب → يبحث عن طعام (Seek food)" },
  { x: [0.1, 0.95, 0.3, 0.9, 0.0, 0.8, 0.8], want: 1, name: "عطش مرتفع وماء قريب → يشرب (Drink)" },
  { x: [0.1, 0.1, 0.3, 0.3, 0.0, 0.05, 0.05], want: 3, name: "طاقة منخفضة وليل → ينام (Sleep)" },
];
for (const sc of scenarios) {
  const ruleSays = M.labLabel(sc.x);
  const netSays = predict(sc.x);
  check("behavior: " + sc.name, ruleSays === sc.want && netSays === sc.want,
    "rule=" + ruleSays + " net=" + netSays + " want=" + sc.want);
}
/* والاهم: القرار يتبدل عند تبديل مدخل واحد فقط (الخطر) */
const calm = [0.95, 0.1, 0.9, 0.3, 0.0, 0.8, 0.8];
const scared = calm.slice(); scared[4] = 0.95;
check("behavior: رفع الخطر وحده يقلب القرار من الطعام الى الاختباء",
  predict(calm) === 0 && predict(scared) === 2,
  "calm=" + predict(calm) + " scared=" + predict(scared));

/* 5) softmax سليمة: الاحتمالات موجبة ومجموعها 1 */
const p = M.labForward(net, X[0]).a[M.LAB_SIZES.length - 1];
const sum = p.reduce((s, v) => s + v, 0);
check("softmax-valid", Math.abs(sum - 1) < 1e-9 && p.every((v) => v > 0), "sum=" + sum.toFixed(12));

if (failures) { console.log("\n" + failures + " FAILURES"); process.exit(1); }
console.log("\nALL LAB MATH TESTS PASSED");
