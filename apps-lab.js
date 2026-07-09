/* ==================== مختبر التطبيقات - قرار النشر والكلفة ==================== */
/* ===== APPS LAB MATH: قرار عتبة التطبيق عبر الكلفة المتوقعة (بلا DOM؛ يختبر آليا) ===== */
/* الفكرة: النموذج يعطي درجة خطر/احتمال. تحويل الدرجة الى فعل ليس مسالة دقة فقط؛
   القرار الامثل يعتمد على كلفة الايجاب الكاذب والسلب الكاذب في المجال. */

const APP_DOMAINS = {
  medical: {
    node: "medical-imaging",
    name: "فرز طبي",
    en: "Medical triage",
    positive: "حالة تحتاج مراجعة",
    negative: "حالة سليمة",
    action: "ارسال للمراجعة",
    a: 0.72,
    b: 8.6,
    costFP: 1,
    costFN: 18,
    latencyMs: 420,
    inferCost: 18,
    privacy: "مراجعة بشرية / سحابة امنة",
    note: "في الفرز الطبي، السلب الكاذب اخطر كثيرا من الانذار الكاذب؛ لذلك تهبط العتبة المثلى كي لا تفوت الحالات النادرة."
  },
  fraud: {
    node: "fraud-detection",
    name: "كشف الاحتيال",
    en: "Fraud detection",
    positive: "معاملة احتيالية",
    negative: "معاملة سليمة",
    action: "ايقاف او مراجعة",
    a: 0.62,
    b: 12.0,
    costFP: 2,
    costFN: 14,
    latencyMs: 85,
    inferCost: 7,
    privacy: "سحابة بزمن منخفض",
    note: "في الاحتيال، حظر معاملة سليمة مؤلم لكنه غالبا اقل كلفة من تمرير احتيال كبير؛ العتبة تميل للانخفاض."
  },
  moderation: {
    node: "content-moderation",
    name: "اشراف محتوى",
    en: "Content moderation",
    positive: "محتوى مخالف",
    negative: "محتوى سليم",
    action: "حجب او مراجعة",
    a: 1.15,
    b: 5.2,
    costFP: 6,
    costFN: 7,
    latencyMs: 160,
    inferCost: 9,
    privacy: "حارس امان + مراجعة",
    note: "في الاشراف على المحتوى، الخطان مؤذيان: ترك الضار يضر السلامة، وحذف السليم يضر التعبير والثقة؛ العتبة اقرب للتوازن."
  },
  recommend: {
    node: "recommendation-engines",
    name: "توصية",
    en: "Recommendation ranking",
    positive: "سيتفاعل المستخدم",
    negative: "لن يتفاعل",
    action: "اعرض العنصر",
    a: 1.7,
    b: 3.6,
    costFP: 1,
    costFN: 2,
    latencyMs: 28,
    inferCost: 3,
    privacy: "طرفي او خدمة خفيفة",
    note: "في التوصية، الخطا الفردي منخفض الكلفة نسبيا؛ الهدف عادة منفعة كلية وترتيب، لا قرارا حادا فقط."
  }
};

function appClamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function appLogit(p) {
  p = Math.min(0.999999, Math.max(0.000001, p));
  return Math.log(p / (1 - p));
}
function appSigmoid(z) { return 1 / (1 + Math.exp(-z)); }
function appTheoryThreshold(costFP, costFN) {
  return costFP / (costFP + costFN);
}
function appBetaShape(s, a, b) {
  return Math.pow(s, a - 1) * Math.pow(1 - s, b - 1);
}

/* سكان صناعيون على 99 خانة درجات. عند drift=0 تكون الدرجة calibrated:
   P(Y=1 | score=s) = s. الانحراف يحرك الاحتمال الحقيقي عند نفس الدرجة. */
function appMakeBins(domain, drift) {
  const bins = [];
  let weightSum = 0;
  for (let i = 1; i <= 99; i++) {
    const score = i / 100;
    const weight = appBetaShape(score, domain.a, domain.b);
    bins.push({ score, weight });
    weightSum += weight;
  }
  for (const bin of bins) {
    const total = 10000 * bin.weight / weightSum;
    const pTrue = appSigmoid(appLogit(bin.score) + drift);
    bin.total = total;
    bin.pos = total * pTrue;
    bin.neg = total * (1 - pTrue);
  }
  return bins;
}

function appBaseRate(bins) {
  let pos = 0, total = 0;
  for (const b of bins) { pos += b.pos; total += b.total; }
  return total ? pos / total : 0;
}

function appConfusion(bins, threshold) {
  threshold = appClamp01(threshold);
  const cm = { TP: 0, FP: 0, TN: 0, FN: 0, N: 0 };
  for (const b of bins) {
    cm.N += b.total;
    if (b.score >= threshold) { cm.TP += b.pos; cm.FP += b.neg; }
    else { cm.FN += b.pos; cm.TN += b.neg; }
  }
  return cm;
}

function appMetrics(cm, costFP, costFN) {
  const safe = (a, b) => b ? a / b : 0;
  const cost = cm.FP * costFP + cm.FN * costFN;
  return {
    accuracy: safe(cm.TP + cm.TN, cm.N),
    precision: safe(cm.TP, cm.TP + cm.FP),
    recall: safe(cm.TP, cm.TP + cm.FN),
    specificity: safe(cm.TN, cm.TN + cm.FP),
    fpr: safe(cm.FP, cm.FP + cm.TN),
    fnr: safe(cm.FN, cm.FN + cm.TP),
    cost,
    costPerCase: safe(cost, cm.N),
    costPer1000: safe(cost, cm.N) * 1000,
    selectedRate: safe(cm.TP + cm.FP, cm.N),
  };
}

function appEvaluate(bins, threshold, costFP, costFN) {
  const cm = appConfusion(bins, threshold);
  return { cm, metrics: appMetrics(cm, costFP, costFN), threshold: appClamp01(threshold) };
}

function appFindBestThreshold(bins, costFP, costFN, objective) {
  let best = null;
  const candidates = [0, 1, ...bins.map((b) => b.score)];
  candidates.sort((a, b) => a - b);
  for (const threshold of candidates) {
    const ev = appEvaluate(bins, threshold, costFP, costFN);
    const value = objective === "accuracy" ? ev.metrics.accuracy : -ev.metrics.costPerCase;
    if (!best || value > best.value + 1e-12) best = { threshold, value, ev };
  }
  return best;
}

function appDomainAnalysis(domainKey, threshold, drift) {
  const domain = APP_DOMAINS[domainKey] || APP_DOMAINS.medical;
  const bins = appMakeBins(domain, drift || 0);
  const costBest = appFindBestThreshold(bins, domain.costFP, domain.costFN, "cost");
  const accBest = appFindBestThreshold(bins, domain.costFP, domain.costFN, "accuracy");
  const current = appEvaluate(bins, threshold, domain.costFP, domain.costFN);
  return {
    domain,
    bins,
    baseRate: appBaseRate(bins),
    theory: appTheoryThreshold(domain.costFP, domain.costFN),
    current,
    costBest,
    accBest,
  };
}
/*__LAB_DOM__*/

const LAB_MAP = {
  "deploy-apps": 0, "evaluation-monitoring": 0, "inference-serving": 0, "foundation-model-apis": 0,
  "model-adaptation": 0, "edge-on-device": 0, "medical-imaging": 0, "fraud-detection": 0,
  "content-moderation": 0, "recommendation-engines": 0, "business-apps": 0, "science-health-apps": 0,
};
const LAB_BTN_TEXT = ["🔬 جرب قرار التطبيق: العتبة، الكلفة، والانحراف"];
let labOpen = false;
const labEl = document.getElementById("lab");

const appDomainEl = document.getElementById("appDomain");
const appThreshEl = document.getElementById("appThreshold");
const appDriftEl = document.getElementById("appDrift");
const appCurve = document.getElementById("appCurve");
const appCtx = appCurve.getContext("2d");
let appCurrentDomain = "medical";

function appPct(x) { return (x * 100).toFixed(1) + "%"; }
function appNum(x) { return Math.round(x).toLocaleString("en-US"); }
function appCost(x) { return x.toFixed(1); }
function appCurrentThreshold() { return parseInt(appThreshEl.value, 10) / 100; }
function appCurrentDrift() { return parseInt(appDriftEl.value, 10) / 100; }

function appSetThreshold(t) {
  const v = Math.max(0, Math.min(100, Math.round(t * 100)));
  appThreshEl.value = v;
  document.getElementById("appThresholdVal").textContent = (v / 100).toFixed(2);
}
function appSetDriftText() {
  const d = appCurrentDrift();
  const label = d === 0 ? "0.00" : (d > 0 ? "+" : "") + d.toFixed(2);
  document.getElementById("appDriftVal").textContent = label;
}

function appMetricRow(label, en, value, cls) {
  return '<tr><td>' + label + '<div class="appEn">' + en + '</div></td><td class="' + (cls || "") + '">' + value + "</td></tr>";
}
function appConfCell(label, en, value, cls) {
  return '<div class="appCmCell ' + cls + '"><span>' + label + '<bdi>' + en + '</bdi></span><b>' + appNum(value) + "</b></div>";
}

function appDrawCurve(analysis) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = 540, H = 176;
  appCurve.width = W * dpr; appCurve.height = H * dpr;
  appCurve.style.width = W + "px"; appCurve.style.height = H + "px";
  appCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const c = appCtx;
  c.clearRect(0, 0, W, H);
  c.fillStyle = "#0a0f1c";
  c.fillRect(0, 0, W, H);
  const vals = [];
  let maxCost = 0, maxAccLoss = 0;
  for (let i = 0; i <= 100; i++) {
    const ev = appEvaluate(analysis.bins, i / 100, analysis.domain.costFP, analysis.domain.costFN);
    vals.push(ev);
    maxCost = Math.max(maxCost, ev.metrics.costPer1000);
    maxAccLoss = Math.max(maxAccLoss, 1 - ev.metrics.accuracy);
  }
  const padL = 34, padR = 12, padT = 12, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  c.strokeStyle = "rgba(255,255,255,0.12)";
  c.lineWidth = 1;
  c.strokeRect(padL, padT, plotW, plotH);
  function xOf(t) { return padL + t * plotW; }
  function yCost(v) { return padT + plotH * (1 - v / Math.max(1e-9, maxCost)); }
  function yAccLoss(v) { return padT + plotH * (1 - v / Math.max(1e-9, maxAccLoss)); }
  c.beginPath();
  vals.forEach((ev, i) => { const x = xOf(i / 100), y = yCost(ev.metrics.costPer1000); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
  c.strokeStyle = "#ffd166"; c.lineWidth = 2; c.stroke();
  c.beginPath();
  vals.forEach((ev, i) => { const x = xOf(i / 100), y = yAccLoss(1 - ev.metrics.accuracy); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
  c.strokeStyle = "#4fc8f8"; c.lineWidth = 1.8; c.stroke();
  const marks = [
    { t: analysis.current.threshold, col: "#e9eef8", lab: "الحالية" },
    { t: analysis.costBest.threshold, col: "#ffd166", lab: "اقل كلفة" },
    { t: analysis.accBest.threshold, col: "#4fc8f8", lab: "اعلى دقة" },
  ];
  c.font = "10px 'Segoe UI', sans-serif";
  c.textAlign = "center";
  for (const m of marks) {
    const x = xOf(m.t);
    c.strokeStyle = m.col; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(x, padT); c.lineTo(x, padT + plotH); c.stroke();
    c.fillStyle = m.col;
    c.fillText(m.lab, x, H - 8);
  }
  c.fillStyle = "#8792ac";
  c.textAlign = "left";
  c.fillText("0", padL, H - 8);
  c.textAlign = "right";
  c.fillText("1", padL + plotW, H - 8);
}

function appRender() {
  const analysis = appDomainAnalysis(appCurrentDomain, appCurrentThreshold(), appCurrentDrift());
  const { domain, current, costBest, accBest } = analysis;
  document.getElementById("appDomainTitle").innerHTML = domain.name + ' <span class="appEn">' + domain.en + "</span>";
  document.getElementById("appDomainNote").textContent = domain.note;
  document.getElementById("appBase").textContent = appPct(analysis.baseRate);
  document.getElementById("appCostFP").textContent = domain.costFP;
  document.getElementById("appCostFN").textContent = domain.costFN;
  document.getElementById("appTheory").textContent = analysis.theory.toFixed(2);
  document.getElementById("appCostBest").textContent = costBest.threshold.toFixed(2);
  document.getElementById("appAccBest").textContent = accBest.threshold.toFixed(2);
  document.getElementById("appThresholdVal").textContent = current.threshold.toFixed(2);
  document.getElementById("appLatency").textContent = domain.latencyMs + " ms";
  document.getElementById("appInferCost").textContent = domain.inferCost + " وحدة";
  document.getElementById("appPrivacy").textContent = domain.privacy;

  const cm = current.cm, m = current.metrics;
  document.getElementById("appConfusion").innerHTML =
    appConfCell("صحيح موجب", "TP", cm.TP, "tp") +
    appConfCell("ايجاب كاذب", "FP", cm.FP, "fp") +
    appConfCell("سلب كاذب", "FN", cm.FN, "fn") +
    appConfCell("صحيح سالب", "TN", cm.TN, "tn");
  document.getElementById("appMetrics").innerHTML =
    appMetricRow("الدقة", "Accuracy", appPct(m.accuracy)) +
    appMetricRow("القيمة التنبئية", "Precision / PPV", appPct(m.precision)) +
    appMetricRow("الاستدعاء", "Recall / TPR", appPct(m.recall)) +
    appMetricRow("النوعية", "Specificity / TNR", appPct(m.specificity)) +
    appMetricRow("معدل التصعيد", "Selected rate", appPct(m.selectedRate)) +
    appMetricRow("الكلفة لكل 1000 حالة", "Expected cost", appCost(m.costPer1000), "appCostHot");
  const gapCost = appEvaluate(analysis.bins, accBest.threshold, domain.costFP, domain.costFN).metrics.costPer1000 - costBest.ev.metrics.costPer1000;
  const driftText = appCurrentDrift() === 0
    ? "الدرجات معايرة هنا: العتبة النظرية القريبة من " + analysis.theory.toFixed(2) + " تطابق تقريبا اقل كلفة."
    : "الانحراف غير علاقة الدرجة بالحقيقة؛ لذلك يجب مراقبة الاداء واعادة ضبط العتبة بدل تثبيتها الى الابد.";
  document.getElementById("appReadout").innerHTML =
    "عند العتبة الحالية، كلفة القرار المتوقعة لكل 1000 حالة = <b>" + appCost(m.costPer1000) + "</b>. " +
    "لو اخترت عتبة اعلى دقة فقط، ستدفع كلفة اضافية تقارب <b>" + appCost(Math.max(0, gapCost)) + "</b> لكل 1000 حالة مقارنة بعتبة اقل كلفة. " + driftText;
  appDrawCurve(analysis);
}

function appSelectDomain(key) {
  appCurrentDomain = key;
  const domain = APP_DOMAINS[key];
  appSetThreshold(appTheoryThreshold(domain.costFP, domain.costFN));
  appRender();
}

for (const key of Object.keys(APP_DOMAINS)) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = APP_DOMAINS[key].name + " - " + APP_DOMAINS[key].en;
  appDomainEl.appendChild(opt);
}
appDomainEl.addEventListener("change", () => appSelectDomain(appDomainEl.value));
appThreshEl.addEventListener("input", () => { document.getElementById("appThresholdVal").textContent = appCurrentThreshold().toFixed(2); appRender(); });
appDriftEl.addEventListener("input", () => { appSetDriftText(); appRender(); });
document.getElementById("appUseCost").addEventListener("click", () => {
  const a = appDomainAnalysis(appCurrentDomain, appCurrentThreshold(), appCurrentDrift());
  appSetThreshold(a.costBest.threshold);
  appRender();
});
document.getElementById("appUseAcc").addEventListener("click", () => {
  const a = appDomainAnalysis(appCurrentDomain, appCurrentThreshold(), appCurrentDrift());
  appSetThreshold(a.accBest.threshold);
  appRender();
});
document.getElementById("appResetDrift").addEventListener("click", () => {
  appDriftEl.value = 0;
  appSetDriftText();
  appRender();
});

function openLab(mode) {
  closeCard();
  labOpen = true;
  labEl.classList.add("open");
  appRender();
}
function closeLab() {
  labOpen = false;
  labEl.classList.remove("open");
}
document.getElementById("labClose").addEventListener("click", closeLab);

appSetThreshold(appTheoryThreshold(APP_DOMAINS.medical.costFP, APP_DOMAINS.medical.costFN));
appSetDriftText();
appRender();
