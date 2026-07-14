/* ==================== مختبر الاخلاق — العدالة الحقيقية حية ==================== */
/* مختبران في تبويبين: (1) نظرية استحالة العدالة عبر مصفوفة الالتباس ومتطابقة شولديتشوفا
   (2) التمييز بالوكالة: لماذا لا يكفي حذف الخاصية الحساسة. كل رياضياته تختبر اليا. */
/* ===== ETHICS LAB MATH: رياضيات صرفة بلا DOM (تختبر آليا قبل النشر) ===== */

/* ---------- مولد عشوائي بذرة ثابتة (نتائج متطابقة في المتصفح وفي اختبار Node) ---------- */
function efMulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
/* توزيع طبيعي معياري عبر Box-Muller */
function efGauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function efClamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

/* ===== التبويب 1: استحالة العدالة =====
   فئة: n فردا، التصنيف الحقيقي Y~Bernoulli(p)؛ الدرجة S من توزيعين مشروطين بالفئة الحقيقية
   وهما مشتركان بين المجموعتين (فقط معدل الاساس p يختلف) — هذا يعزل اثر معدل الاساس وحده:
   S|Y=1 ~ clamp(N(mu1,sd))، S|Y=0 ~ clamp(N(mu0,sd)) */
function efGenGroup(rng, n, p, mu1, mu0, sd) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const y = rng() < p ? 1 : 0;
    const s = efClamp01((y ? mu1 : mu0) + efGauss(rng) * sd);
    arr.push({ y, s });
  }
  return arr;
}
/* مصفوفة الالتباس عند عتبة tau: التوقع الموجب Yhat=1 اذا كانت الدرجة >= tau */
function efConfusion(group, tau) {
  let TP = 0, FP = 0, TN = 0, FN = 0;
  for (const o of group) {
    const yhat = o.s >= tau ? 1 : 0;
    if (o.y === 1) { if (yhat === 1) TP++; else FN++; }
    else { if (yhat === 1) FP++; else TN++; }
  }
  return { TP, FP, TN, FN };
}
/* المقاييس السبعة من مصفوفة الالتباس (تجريبية، محسوبة من الافراد المعروضين فعلا) */
function efMetrics(cm) {
  const { TP, FP, TN, FN } = cm;
  const n = TP + FP + TN + FN, pos = TP + FN, neg = FP + TN, sel = TP + FP, pn = TN + FN;
  return {
    n, pos, neg, sel,
    base: n ? pos / n : NaN,       // معدل الاساس P(Y=1)
    selRate: n ? sel / n : NaN,    // معدل الاختيار P(Yhat=1) — التكافو الديموغرافي
    tpr: pos ? TP / pos : NaN,     // معدل الايجاب الصحيح — تكافو الفرص
    fpr: neg ? FP / neg : NaN,     // معدل الايجاب الكاذب
    fnr: pos ? FN / pos : NaN,     // معدل السلب الكاذب
    ppv: sel ? TP / sel : NaN,     // القيمة التنبئية الموجبة (الدقة) — تكافو التنبؤ
    npv: pn ? TN / pn : NaN,       // القيمة التنبئية السالبة
  };
}
/* دالة التوزيع التراكمي الطبيعي عبر تقريب erf (A&S 7.1.26، خطا < 1.5e-7) — للمقاييس السكانية المغلقة */
function efNormCdf(z) {
  const s = z < 0 ? -1 : 1; z = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return 0.5 * (1 + s * y);
}
/* المقاييس السكانية المغلقة عند عتبة tau (بلا اعتيان). لعتبة في (0,1) لا يؤثر القص على العبور:
   P(S>=tau | Y=c) = 1 - Phi((tau-mu_c)/sd) */
function efPop(p, tau, mu1, mu0, sd) {
  const t = 1 - efNormCdf((tau - mu1) / sd);
  const f = 1 - efNormCdf((tau - mu0) / sd);
  const ppvDen = p * t + (1 - p) * f;
  const npvDen = (1 - p) * (1 - f) + p * (1 - t);
  return {
    base: p, selRate: p * t + (1 - p) * f, tpr: t, fpr: f, fnr: 1 - t,
    ppv: ppvDen > 0 ? (p * t) / ppvDen : NaN,
    npv: npvDen > 0 ? ((1 - p) * (1 - f)) / npvDen : NaN,
  };
}

/* ===== التبويب 2: التمييز بالوكالة =====
   انحدار لوجستي من الصفر (الحد الثابت ميزة صريحة). ظاهرة التمييز بالوكالة مستقلة عن نوع النموذج،
   ونبرهنها هنا باصغر مصنف خطي — فحتى النموذج الابسط يعيد انتاج التحيز. */
function efLogRegFit(X, y, iters, lr) {
  const d = X[0].length, n = X.length;
  const w = new Array(d).fill(0);
  for (let t = 0; t < iters; t++) {
    const g = new Array(d).fill(0);
    for (let i = 0; i < n; i++) {
      let z = 0; for (let j = 0; j < d; j++) z += w[j] * X[i][j];
      const s = 1 / (1 + Math.exp(-z)), e = s - y[i];
      for (let j = 0; j < d; j++) g[j] += e * X[i][j];
    }
    for (let j = 0; j < d; j++) w[j] -= lr * g[j] / n;
  }
  return w;
}
function efLogRegPredict(w, x) { let z = 0; for (let j = 0; j < x.length; j++) z += w[j] * x[j]; return 1 / (1 + Math.exp(-z)); }
/* سكان من مجموعتين حسب الخاصية الحساسة A في {0,1}، N لكل مجموعة.
   الجدارة M ~ U(0,1) مستقلة عن A (متساويتان في الجدارة بالبناء). k وكلاء كل منها نسخة مشوشة من A.
   التصنيف الملحوظ (المتحيز): موجب اذا M > 0.5 + b*A (المجموعة A=1 تحاسب بمعيار اعلى). */
function efGenPop(rng, N, k, eps, b) {
  const rows = [];
  for (let a = 0; a <= 1; a++) {
    for (let i = 0; i < N; i++) {
      const M = rng();
      const P = [];
      for (let j = 0; j < k; j++) P.push(rng() < eps ? 1 - a : a);
      rows.push({ a, M, P, yStar: M > 0.5 ? 1 : 0, yTilde: M > 0.5 + b * a ? 1 : 0 });
    }
  }
  return rows;
}
/* بناء متجه الميزات حسب النمط: withA (كل الميزات) · blind (بحذف A مع ابقاء الوكلاء) · meritOnly (الجدارة فقط) */
function efFeatures(row, mode) {
  const f = [1, row.M * 2 - 1];
  if (mode === "withA") f.push(row.a * 2 - 1);
  if (mode === "withA" || mode === "blind") for (const p of row.P) f.push(p * 2 - 1);
  return f;
}
function efSelectionRates(rows, w, mode) {
  let n0 = 0, s0 = 0, n1 = 0, s1 = 0;
  for (const r of rows) {
    const yhat = efLogRegPredict(w, efFeatures(r, mode)) >= 0.5 ? 1 : 0;
    if (r.a === 0) { n0++; s0 += yhat; } else { n1++; s1 += yhat; }
  }
  return { s0: n0 ? s0 / n0 : 0, s1: n1 ? s1 / n1 : 0 };
}
function efDI(s0, s1) { const hi = Math.max(s0, s1), lo = Math.min(s0, s1); return hi > 0 ? lo / hi : 1; }
/*__LAB_DOM__*/

const LAB_MAP = {
  "fairness-bias": 0, "fairness-metrics": 0, "fairness-impossibility": 0,
  "algorithmic-auditing": 0, "sources-of-bias": 1, "bias-mitigation": 1,
};
const LAB_BTN_TEXT = [
  "🔬 جرب مقايضات العدالة حية: نظرية الاستحالة",
  "🔬 جرب لماذا لا يكفي حذف الخاصية الحساسة",
];
let labOpen = false;
const labEl = document.getElementById("lab");

/* ---------- تبديل التبويبين ---------- */
const efScenes = [document.getElementById("efScene0"), document.getElementById("efScene1")];
const efTabs = [document.getElementById("efTab0"), document.getElementById("efTab1")];
let efActiveTab = 0, efTab2Ready = false;
function efSelectTab(i) {
  efActiveTab = i;
  efScenes.forEach((s, j) => s && s.classList.toggle("on", j === i));
  efTabs.forEach((t, j) => t && t.classList.toggle("on", j === i));
  if (i === 0) efRender1();
  else { if (!efTab2Ready) { efTrain2(); efTab2Ready = true; } efRender2(); }
}
efTabs.forEach((t, i) => t && t.addEventListener("click", () => efSelectTab(i)));

function openLab(mode) {
  closeCard();
  labOpen = true;
  labEl.classList.add("open");
  efBuild1();
  efSelectTab((mode | 0) === 1 ? 1 : 0);
}
function closeLab() { labOpen = false; labEl.classList.remove("open"); }
document.getElementById("labClose").addEventListener("click", closeLab);

/* =========================================================
   التبويب 1 — استحالة العدالة
   ========================================================= */
const EF_MU1 = 0.65, EF_MU0 = 0.35, EF_SD = 0.15, EF_N = 600, EF_SEED = 12345, EF_EPS_LAMP = 0.05;
let efGA = [], efGB = [];
function efBuild1() {
  const equalBase = document.getElementById("efEqualBase").checked;
  const perfect = document.getElementById("efPerfect").checked;
  const pA = 0.60, pB = equalBase ? 0.60 : 0.30;
  const mu1 = perfect ? 0.92 : EF_MU1, mu0 = perfect ? 0.08 : EF_MU0, sd = perfect ? 0.05 : EF_SD;
  const rng = efMulberry32(EF_SEED);
  efGA = efGenGroup(rng, EF_N, pA, mu1, mu0, sd);
  efGB = efGenGroup(rng, EF_N, pB, mu1, mu0, sd);
  const bnote = document.getElementById("efBaseNote");
  if (bnote) bnote.textContent = equalBase
    ? "معدل الاساس متساو الان (0.60 و0.60) — لاحظ كيف يذوب التعارض."
    : "معدل اعادة الاعتقال المسجل: المجموعة أ 0.60 · المجموعة ب 0.30 (مختلف عمدا).";
}
function efTauA() { return parseInt(document.getElementById("efTauA").value, 10) / 100; }
function efTauB() { return parseInt(document.getElementById("efTauB").value, 10) / 100; }

const efCanA = document.getElementById("efCanvasA"), efCtxA = efCanA.getContext("2d");
const efCanB = document.getElementById("efCanvasB"), efCtxB = efCanB.getContext("2d");
(function () {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  for (const cv of [efCanA, efCanB]) {
    cv.width = 460 * d; cv.height = 96 * d; cv.style.width = "460px"; cv.style.height = "96px";
    cv.getContext("2d").setTransform(d, 0, 0, d, 0, 0);
  }
})();
function efDrawStrip(ctx, group, tau) {
  const W = 460, H = 96, padL = 6, padR = 6, plotW = W - padL - padR;
  ctx.clearRect(0, 0, W, H);
  const xOf = (s) => padL + s * plotW;
  /* منطقة المصنفين موجبا (يمين العتبة) */
  ctx.fillStyle = "rgba(255,178,89,0.08)";
  ctx.fillRect(xOf(tau), 0, W - padR - xOf(tau), H);
  /* نقاط الافراد ملونة بالتصنيف الحقيقي */
  let seed = 987654;
  const jit = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff); };
  for (const o of group) {
    const x = xOf(o.s), y = 12 + jit() * (H - 24);
    ctx.beginPath(); ctx.arc(x, y, 2.1, 0, Math.PI * 2);
    ctx.fillStyle = o.y === 1 ? "rgba(255,140,90,0.85)" : "rgba(79,200,248,0.8)";
    ctx.fill();
  }
  /* خط العتبة */
  ctx.strokeStyle = "#e9eef8"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(xOf(tau), 0); ctx.lineTo(xOf(tau), H); ctx.stroke();
  ctx.fillStyle = "#e9eef8"; ctx.font = "10px 'Segoe UI',sans-serif"; ctx.textAlign = "center";
  ctx.fillText("عتبة", xOf(tau), H - 2);
}
function efMatHtml(cm) {
  return '<table class="efMat"><tr><td class="efMh"></td><td class="efMh">توقع: خطر مرتفع</td><td class="efMh">توقع: منخفض</td></tr>'
    + '<tr><td class="efMh">فعليا: أعيد اعتقاله</td><td class="efTP">' + cm.TP + '</td><td class="efFN">' + cm.FN + '</td></tr>'
    + '<tr><td class="efMh">فعليا: لم يعتقل ثانية</td><td class="efFP">' + cm.FP + '</td><td class="efTN">' + cm.TN + '</td></tr></table>';
}
function efPct(x) { return isFinite(x) ? (x * 100).toFixed(1) + "%" : "—"; }
function efMetricsHtml(mA, mB) {
  const row = (label, en, a, b) => {
    const d = (isFinite(a) && isFinite(b)) ? Math.abs(a - b) : NaN;
    return '<tr><td class="efMl">' + label + ' <span class="efEn">' + en + '</span></td><td>' + efPct(a) + '</td><td>' + efPct(b) + '</td><td class="' + (isFinite(d) && d >= EF_EPS_LAMP ? "efGap" : "efOk") + '">' + (isFinite(d) ? "Δ " + efPct(d) : "—") + '</td></tr>';
  };
  return '<table class="efMetrics"><tr><th>المقياس</th><th>أ</th><th>ب</th><th>الفرق</th></tr>'
    + row("معدل الاساس", "Base rate", mA.base, mB.base)
    + row("معدل الاختيار", "Selection", mA.selRate, mB.selRate)
    + row("الايجاب الصحيح", "TPR", mA.tpr, mB.tpr)
    + row("الايجاب الكاذب", "FPR", mA.fpr, mB.fpr)
    + row("القيمة التنبئية", "PPV", mA.ppv, mB.ppv)
    + '</table>';
}
function efLamp(id, label, en, diff) {
  const el = document.getElementById(id); if (!el) return;
  const ok = isFinite(diff) && diff < EF_EPS_LAMP;
  el.className = "efLamp " + (ok ? "efLampOn" : "efLampOff");
  el.innerHTML = '<span class="efLdot"></span><span class="efLtxt">' + label + ' <span class="efEn">' + en + '</span></span><span class="efLval">' + (isFinite(diff) ? (ok ? "متحقق" : "Δ " + efPct(diff)) : "—") + '</span>';
}
function efRender1() {
  const tauA = efTauA(), tauB = efTauB();
  const cmA = efConfusion(efGA, tauA), cmB = efConfusion(efGB, tauB);
  const mA = efMetrics(cmA), mB = efMetrics(cmB);
  efDrawStrip(efCtxA, efGA, tauA); efDrawStrip(efCtxB, efGB, tauB);
  document.getElementById("efMatA").innerHTML = efMatHtml(cmA);
  document.getElementById("efMatB").innerHTML = efMatHtml(cmB);
  document.getElementById("efMetricsBox").innerHTML = efMetricsHtml(mA, mB);
  efLamp("efLampDP", "التكافو الديموغرافي", "Demographic parity", Math.abs(mA.selRate - mB.selRate));
  efLamp("efLampEQO", "تكافو الفرص", "Equal opportunity", Math.abs(mA.tpr - mB.tpr));
  efLamp("efLampEOD", "تكافو الاحتمالات", "Equalized odds", Math.max(Math.abs(mA.tpr - mB.tpr), Math.abs(mA.fpr - mB.fpr)));
  efLamp("efLampPP", "تكافو التنبؤ", "Predictive parity", Math.abs(mA.ppv - mB.ppv));
  /* منطقة تافهة: لو اختار احد المجموعتين شبه لا احد او شبه الجميع فان القيمة التنبئية تقترب من 1 زيفا
     فتضيء كل المصابيح — نحذر منها كي لا يناقض السطح التفاعلي رسالة النظرية (نفس حد الاختبار A5) */
  const efTrivial = !(mA.selRate >= 0.15 && mA.selRate <= 0.85 && mB.selRate >= 0.15 && mB.selRate <= 0.85);
  const efWarnEl = document.getElementById("efTrivialWarn");
  if (efWarnEl) efWarnEl.style.display = efTrivial ? "block" : "none";
  const efLampsEl = document.querySelector("#efScene0 .efLamps");
  if (efLampsEl) efLampsEl.classList.toggle("efLampsVacuous", efTrivial);
  /* متطابقة شولديتشوفا على المجموعة ب: FPR = p/(1-p) * (1-PPV)/PPV * (1-FNR) */
  const idEl = document.getElementById("efIdentity");
  if (idEl) {
    if (mB.ppv > 0 && mB.base < 1 && isFinite(mB.fpr)) {
      const rhs = (mB.base / (1 - mB.base)) * ((1 - mB.ppv) / mB.ppv) * (1 - mB.fnr);
      idEl.innerHTML = "متطابقة شولديتشوفا (المجموعة ب): FPR المقاس = <b>" + mB.fpr.toFixed(4)
        + "</b> · المحسوب من (معدل الاساس، PPV، FNR) = <b>" + rhs.toFixed(4) + "</b> — يتطابقان تماما (ليسا اختيارا بل قيد جبري).";
    } else idEl.textContent = "";
  }
}
/* الفخ الاول: مساواة معدلات الخطا (تكافو الاحتمالات) بتوحيد العتبتين */
document.getElementById("efEqErr").addEventListener("click", () => {
  document.getElementById("efTauB").value = document.getElementById("efTauA").value;
  document.getElementById("efTauBVal").textContent = efTauB().toFixed(2);
  efRender1();
});
/* الفخ الثاني: مساواة الدقة (تكافو التنبؤ) — نحرك عتبة ب حتى تقترب PPV_B من PPV_A */
document.getElementById("efEqPrec").addEventListener("click", () => {
  const tauA = efTauA();
  const targetPpv = efMetrics(efConfusion(efGA, tauA)).ppv;
  let best = null;
  for (let i = 1; i < 100; i++) {
    const tb = i / 100, m = efMetrics(efConfusion(efGB, tb));
    if (!(m.sel > 5) || !isFinite(m.ppv)) continue;
    const d = Math.abs(m.ppv - targetPpv);
    if (!best || d < best.d) best = { i, d };
  }
  if (best) {
    document.getElementById("efTauB").value = best.i;
    document.getElementById("efTauBVal").textContent = (best.i / 100).toFixed(2);
    efRender1();
  }
});
document.getElementById("efReset1").addEventListener("click", () => {
  document.getElementById("efTauA").value = 50; document.getElementById("efTauB").value = 50;
  document.getElementById("efTauAVal").textContent = "0.50"; document.getElementById("efTauBVal").textContent = "0.50";
  document.getElementById("efEqualBase").checked = false; document.getElementById("efPerfect").checked = false;
  efBuild1(); efRender1();
});
document.getElementById("efTauA").addEventListener("input", () => { document.getElementById("efTauAVal").textContent = efTauA().toFixed(2); efRender1(); });
document.getElementById("efTauB").addEventListener("input", () => { document.getElementById("efTauBVal").textContent = efTauB().toFixed(2); efRender1(); });
document.getElementById("efEqualBase").addEventListener("change", () => { efBuild1(); efRender1(); });
document.getElementById("efPerfect").addEventListener("change", () => { efBuild1(); efRender1(); });

/* =========================================================
   التبويب 2 — التمييز بالوكالة
   ========================================================= */
const EF2_N = 1000, EF2_K = 5, EF2_B = 0.20, EF2_ITERS = 300, EF2_LR = 1.0, EF2_SEED = 20260708;
let ef2 = null;
function ef2Eps() { return parseInt(document.getElementById("efEps").value, 10) / 100; }
function efTrain2() {
  const eps = ef2Eps();
  const rng = efMulberry32(EF2_SEED);
  const pop = efGenPop(rng, EF2_N, EF2_K, eps, EF2_B);
  const y = pop.map(r => r.yTilde);
  const wWith = efLogRegFit(pop.map(r => efFeatures(r, "withA")), y, EF2_ITERS, EF2_LR);
  const wBlind = efLogRegFit(pop.map(r => efFeatures(r, "blind")), y, EF2_ITERS, EF2_LR);
  const wMerit = efLogRegFit(pop.map(r => efFeatures(r, "meritOnly")), y, EF2_ITERS, EF2_LR);
  const aTarget = pop.map(r => r.a);
  const wAux = efLogRegFit(pop.map(r => efFeatures(r, "blind")), aTarget, EF2_ITERS, EF2_LR);
  let ok = 0; for (const r of pop) if ((efLogRegPredict(wAux, efFeatures(r, "blind")) >= 0.5 ? 1 : 0) === r.a) ok++;
  const rate = (a, key) => { let n = 0, s = 0; for (const r of pop) if (r.a === a) { n++; s += r[key]; } return s / n; };
  ef2 = {
    withA: efSelectionRates(pop, wWith, "withA"),
    blind: efSelectionRates(pop, wBlind, "blind"),
    merit: efSelectionRates(pop, wMerit, "meritOnly"),
    auxAcc: ok / pop.length,
    deservedA0: rate(0, "yStar"), deservedA1: rate(1, "yStar"),
  };
}
function efCondHtml(title, en, sr) {
  const di = efDI(sr.s0, sr.s1), pass = di >= 0.8;
  const bar = (v, cls) => '<div class="efBarWrap"><div class="efBar ' + cls + '" style="width:' + (v * 100).toFixed(1) + '%"></div><span class="efBarVal">' + (v * 100).toFixed(0) + '%</span></div>';
  return '<div class="efCond"><div class="efCondT">' + title + ' <span class="efEn">' + en + '</span></div>'
    + '<div class="efBarRow"><span class="efGrpL">مجموعة أ</span>' + bar(sr.s0, "efBarA") + '</div>'
    + '<div class="efBarRow"><span class="efGrpL">مجموعة ب</span>' + bar(sr.s1, "efBarB") + '</div>'
    + '<div class="efDI ' + (pass ? "efDIok" : "efDIbad") + '">نسبة الاثر المتفاوت (اربعة اخماس) = <b>' + di.toFixed(2) + '</b> ' + (pass ? "✓ ضمن الحد" : "✗ دون 0.80") + '</div></div>';
}
function efRender2() {
  if (!ef2) efTrain2();
  document.getElementById("efCondWith").innerHTML = efCondHtml("مع الخاصية الحساسة", "with A", ef2.withA);
  document.getElementById("efCondBlind").innerHTML = efCondHtml("بحذف الخاصية (لكن الوكلاء باقون)", "blind", ef2.blind);
  document.getElementById("efCondMerit").innerHTML = efCondHtml("الجدارة وحدها (بلا وكلاء)", "merit only", ef2.merit);
  document.getElementById("efAux").innerHTML = "نموذج مساعد يخمن الخاصية الحساسة من الميزات «المحايدة» وحدها بدقة <b>"
    + (ef2.auxAcc * 100).toFixed(1) + "%</b> — الوكلاء يعيدون بناءها، فحذف العمود لا يحذف المعلومة.";
  document.getElementById("efDeserved").textContent = "المجموعتان متساويتان في الجدارة بالبناء (نسبة الاستحقاق أ "
    + (ef2.deservedA0 * 100).toFixed(0) + "% · ب " + (ef2.deservedA1 * 100).toFixed(0) + "%)، فاي فرق في الاختيار هنا غير مبرر.";
}
document.getElementById("efEps").addEventListener("input", () => {
  document.getElementById("efEpsVal").textContent = ef2Eps().toFixed(2);
});
document.getElementById("efEps").addEventListener("change", () => { efTrain2(); efRender2(); });
document.getElementById("efRetrain").addEventListener("click", () => { efTrain2(); efRender2(); });

/* تهيئة اولية */
document.getElementById("efTauAVal").textContent = "0.50";
document.getElementById("efTauBVal").textContent = "0.50";
document.getElementById("efEpsVal").textContent = ef2Eps().toFixed(2);
efBuild1();
efRender1();
