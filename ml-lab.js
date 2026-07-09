/* ==================== مختبر تعلم الآلة — مصنفات حقيقية وحدود قرار حية ==================== */
/* ===== ML LAB MATH: رياضيات صرفة بلا DOM (تختبر آليا قبل النشر) ===== */
function mlMulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* اقرب الجيران k: تصويت الاغلبية على اقرب k نقاط (مع امكانية استبعاد نقطة لترك-واحد) */
function mlKNN(points, px, py, k, excludeIdx) {
  const ds = [];
  for (let i = 0; i < points.length; i++) {
    if (i === excludeIdx) continue;
    const dx = px - points[i].x, dy = py - points[i].y;
    ds.push({ d: dx * dx + dy * dy, c: points[i].cls });
  }
  if (!ds.length) return { cls: 0, conf: 0.5 };
  ds.sort((a, b) => a.d - b.d);
  const kk = Math.min(k, ds.length);
  let c1 = 0;
  for (let i = 0; i < kk; i++) if (ds[i].c === 1) c1++;
  const p1 = c1 / kk;
  return { cls: p1 >= 0.5 ? 1 : 0, conf: Math.max(p1, 1 - p1) };
}

/* الانحدار اللوجستي: نزول تدرجي على دالة سينية. الميزات تنقل الى [-1,1] لتحسين التقارب */
function mlLogRegTrain(points, iters, lr) {
  let w0 = 0, w1 = 0, w2 = 0;
  const n = points.length || 1;
  for (let t = 0; t < iters; t++) {
    let g0 = 0, g1 = 0, g2 = 0;
    for (const p of points) {
      const x = p.x * 2 - 1, y = p.y * 2 - 1;
      const z = w0 + w1 * x + w2 * y;
      const s = 1 / (1 + Math.exp(-z));
      const err = s - p.cls;
      g0 += err; g1 += err * x; g2 += err * y;
    }
    w0 -= lr * g0 / n; w1 -= lr * g1 / n; w2 -= lr * g2 / n;
  }
  return { w0, w1, w2 };
}
function mlLogRegProb(w, px, py) {
  const x = px * 2 - 1, y = py * 2 - 1;
  return 1 / (1 + Math.exp(-(w.w0 + w.w1 * x + w.w2 * y)));
}

/* شجرة القرار: تقسيمات محورية حقيقية تختار اقل جيني مرجح */
function mlGini(pts) {
  if (!pts.length) return 0;
  let c1 = 0;
  for (const p of pts) if (p.cls === 1) c1++;
  const p1 = c1 / pts.length;
  return 1 - p1 * p1 - (1 - p1) * (1 - p1);
}
function mlMajority(pts) {
  let c1 = 0;
  for (const p of pts) if (p.cls === 1) c1++;
  return c1 * 2 >= pts.length ? 1 : 0;
}
function mlTreeBuild(points, maxDepth) {
  function build(pts, depth) {
    if (depth >= maxDepth || pts.length <= 2 || mlGini(pts) === 0) return { leaf: true, cls: mlMajority(pts), n: pts.length };
    let best = null;
    for (const feat of ["x", "y"]) {
      const vals = [...new Set(pts.map((p) => p[feat]))].sort((a, b) => a - b);
      for (let i = 0; i < vals.length - 1; i++) {
        const thr = (vals[i] + vals[i + 1]) / 2;
        const L = [], R = [];
        for (const p of pts) (p[feat] <= thr ? L : R).push(p);
        if (!L.length || !R.length) continue;
        const g = (L.length * mlGini(L) + R.length * mlGini(R)) / pts.length;
        if (!best || g < best.g) best = { g, feat, thr, L, R };
      }
    }
    if (!best) return { leaf: true, cls: mlMajority(pts), n: pts.length };
    return { leaf: false, feat: best.feat, thr: best.thr, left: build(best.L, depth + 1), right: build(best.R, depth + 1) };
  }
  return build(points, 0);
}
function mlTreePredict(tree, px, py) {
  let node = tree;
  while (!node.leaf) {
    const val = node.feat === "y" ? py : px;
    node = val <= node.thr ? node.left : node.right;
  }
  return node.cls;
}
/*__LAB_DOM__*/

const LAB_MAP = {
  algos: 0, linreg: 0, logreg: 0, knn: 0, decisiontree: 0, randomforest: 0,
  svm: 0, naivebayes: 0, kmeans: 0, classification: 0, supervised: 0,
  overfitting: 0, biasvariance: 0, model: 0,
};
const LAB_BTN_TEXT = ["🔬 جرب التصنيف وحدود القرار حيا"];
let labOpen = false;
const labEl = document.getElementById("lab");

const ML_DIM = 340, ML_GRID = 68;
let mlPoints = [];
let mlModel = null, mlModelKind = null;
const mlRng = mlMulberry32(7);

const mlCv = document.getElementById("mlCanvas");
const mlCtx = mlCv.getContext("2d");
(function () {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  mlCv.width = ML_DIM * d; mlCv.height = ML_DIM * d;
  mlCv.style.width = ML_DIM + "px"; mlCv.style.height = ML_DIM + "px";
  mlCtx.setTransform(d, 0, 0, d, 0, 0);
})();
document.getElementById("labParams").textContent = "k-NN · انحدار لوجستي · شجرة قرار (Gini) — كلها من الصفر";
document.getElementById("mlHint2").textContent = "انقر = فئة A (ازرق) · Shift+نقر = فئة B (برتقالي) · اسحب لرسم عدة نقاط";

function mlAlgo() { return document.getElementById("mlAlgo").value; }
function mlK() { return parseInt(document.getElementById("mlK").value, 10); }
function mlDepth() { return parseInt(document.getElementById("mlDepth").value, 10); }

function mlTrain() {
  const algo = mlAlgo();
  if (algo === "logreg") { mlModel = mlLogRegTrain(mlPoints, 600, 1.2); mlModelKind = "logreg"; }
  else if (algo === "tree") { mlModel = mlPoints.length ? mlTreeBuild(mlPoints, mlDepth()) : null; mlModelKind = "tree"; }
  else { mlModel = null; mlModelKind = "knn"; }
}
function mlPredict(px, py, excludeIdx) {
  const algo = mlAlgo();
  if (algo === "knn") return mlKNN(mlPoints, px, py, mlK(), excludeIdx === undefined ? -1 : excludeIdx);
  if (algo === "logreg") { const pr = mlModel ? mlLogRegProb(mlModel, px, py) : 0.5; return { cls: pr >= 0.5 ? 1 : 0, conf: Math.max(pr, 1 - pr) }; }
  const c = mlModel ? mlTreePredict(mlModel, px, py) : 0; return { cls: c, conf: 1 };
}

function mlRender() {
  mlTrain();
  const c = mlCtx;
  c.clearRect(0, 0, ML_DIM, ML_DIM);
  const cell = ML_DIM / ML_GRID;
  if (mlPoints.length) {
    for (let gy = 0; gy < ML_GRID; gy++) {
      for (let gx = 0; gx < ML_GRID; gx++) {
        const px = (gx + 0.5) / ML_GRID, py = (gy + 0.5) / ML_GRID;
        const r = mlPredict(px, py);
        const a = 0.12 + (r.conf - 0.5) * 0.55;
        c.fillStyle = r.cls === 1 ? "rgba(255,178,89," + a.toFixed(3) + ")" : "rgba(79,200,248," + a.toFixed(3) + ")";
        c.fillRect(gx * cell, gy * cell, cell + 0.6, cell + 0.6);
      }
    }
  } else {
    c.fillStyle = "#0a0f1c"; c.fillRect(0, 0, ML_DIM, ML_DIM);
    c.fillStyle = "#8792ac"; c.font = "13px 'Segoe UI', sans-serif"; c.textAlign = "center";
    c.fillText("انقر لاضافة نقاط او اختر مثالا جاهزا", ML_DIM / 2, ML_DIM / 2);
  }
  for (const p of mlPoints) {
    c.beginPath();
    c.arc(p.x * ML_DIM, p.y * ML_DIM, 5.5, 0, Math.PI * 2);
    c.fillStyle = p.cls === 1 ? "#ffb259" : "#4fc8f8";
    c.fill();
    c.lineWidth = 1.5; c.strokeStyle = "rgba(10,14,25,0.85)"; c.stroke();
  }
  mlUpdateStats();
}

function mlUpdateStats() {
  let a = 0, b = 0;
  for (const p of mlPoints) (p.cls === 1 ? (b++) : (a++));
  document.getElementById("mlCountA").textContent = a;
  document.getElementById("mlCountB").textContent = b;
  const accEl = document.getElementById("mlAcc"), noteEl = document.getElementById("mlAccNote");
  if (mlPoints.length < 2) { accEl.textContent = "—"; noteEl.textContent = ""; return; }
  let ok = 0;
  for (let i = 0; i < mlPoints.length; i++) {
    const r = mlPredict(mlPoints[i].x, mlPoints[i].y, i); /* excludeIdx يهم k-NN فقط */
    if (r.cls === mlPoints[i].cls) ok++;
  }
  const acc = ok / mlPoints.length;
  accEl.textContent = Math.round(acc * 100) + "%";
  noteEl.textContent = mlAlgo() === "knn"
    ? "محسوبة بترك-واحد (كل نقطة تصنف دون احتساب نفسها) — تقدير امين للتعميم."
    : "دقة على نفس نقاط التدريب — قد تكون متفائلة (خصوصا لشجرة عميقة).";
}

const ML_OBSERVE = {
  knn: "غير k: قيمة 1 تعطي حدودا متعرجة تحفظ كل نقطة (تباين عال، فرط تخصيص)، وقيمة كبيرة تنعم الحد كثيرا (انحياز اعلى). جرب مثال الدائرة: k-NN يتقنه لانه لا يفترض خطا مستقيما.",
  logreg: "الانحدار اللوجستي يرسم دائما حدا مستقيما واحدا. جرب مثال «فئتان»: يفصلهما تماما. ثم جرب XOR او الدائرة: يفشل — لان النمط ليس خطيا. هذا حد النماذج الخطية.",
  tree: "شجرة القرار تقسم بخطوط افقية وعمودية فقط، فتظهر حدود «مدرجة». زد العمق: تلتقط انماطا اعقد لكنها تحفظ الضجيج (فرط تخصيص) وتقفز الدقة الى 100% بلا معنى. جرب XOR: عمق 2 يكفي.",
};
function mlSyncControls() {
  document.getElementById("mlKRow").style.display = mlAlgo() === "knn" ? "flex" : "none";
  document.getElementById("mlDepthRow").style.display = mlAlgo() === "tree" ? "flex" : "none";
  document.getElementById("mlObserve").textContent = ML_OBSERVE[mlAlgo()];
}

/* اضافة نقاط بالفارة */
let mlPainting = false, mlPaintCls = 0, mlLastAdd = 0;
function mlAddAt(clientX, clientY, cls) {
  const rect = mlCv.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return;
  const now = performance.now();
  if (now - mlLastAdd < 45) return; /* لا تكدس نقاطا كثيرة اثناء السحب */
  mlLastAdd = now;
  mlPoints.push({ x, y, cls });
  mlRender();
}
mlCv.addEventListener("pointerdown", (e) => {
  mlPainting = true; mlPaintCls = e.shiftKey ? 1 : 0;
  mlCv.setPointerCapture(e.pointerId);
  mlLastAdd = 0; mlAddAt(e.clientX, e.clientY, mlPaintCls);
});
mlCv.addEventListener("pointermove", (e) => { if (mlPainting) mlAddAt(e.clientX, e.clientY, mlPaintCls); });
mlCv.addEventListener("pointerup", () => { mlPainting = false; });
mlCv.addEventListener("contextmenu", (e) => e.preventDefault());

document.getElementById("mlAlgo").addEventListener("change", () => { mlSyncControls(); mlRender(); });
document.getElementById("mlK").addEventListener("input", () => { document.getElementById("mlKVal").textContent = mlK(); mlRender(); });
document.getElementById("mlDepth").addEventListener("input", () => { document.getElementById("mlDepthVal").textContent = mlDepth(); mlRender(); });
document.getElementById("mlClear").addEventListener("click", () => { mlPoints = []; mlRender(); });

/* بيانات جاهزة */
function mlGaussBlob(cx, cy, cls, n, sd) {
  for (let i = 0; i < n; i++) {
    const a = mlRng() * Math.PI * 2, r = (mlRng() + mlRng()) / 2 * sd;
    mlPoints.push({ x: Math.min(0.97, Math.max(0.03, cx + Math.cos(a) * r)), y: Math.min(0.97, Math.max(0.03, cy + Math.sin(a) * r)), cls });
  }
}
document.getElementById("mlBlobs").addEventListener("click", () => {
  mlPoints = []; mlGaussBlob(0.32, 0.38, 0, 22, 0.16); mlGaussBlob(0.68, 0.64, 1, 22, 0.16); mlRender();
});
document.getElementById("mlXor").addEventListener("click", () => {
  mlPoints = [];
  mlGaussBlob(0.28, 0.28, 0, 12, 0.1); mlGaussBlob(0.72, 0.72, 0, 12, 0.1);
  mlGaussBlob(0.72, 0.28, 1, 12, 0.1); mlGaussBlob(0.28, 0.72, 1, 12, 0.1);
  mlRender();
});
document.getElementById("mlCircle").addEventListener("click", () => {
  mlPoints = [];
  for (let i = 0; i < 26; i++) { const a = mlRng() * Math.PI * 2, r = mlRng() * 0.16; mlPoints.push({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r, cls: 1 }); }
  for (let i = 0; i < 34; i++) { const a = mlRng() * Math.PI * 2, r = 0.28 + mlRng() * 0.16; mlPoints.push({ x: Math.min(0.97, Math.max(0.03, 0.5 + Math.cos(a) * r)), y: Math.min(0.97, Math.max(0.03, 0.5 + Math.sin(a) * r)), cls: 0 }); }
  mlRender();
});

function openLab(mode) {
  closeCard();
  labOpen = true;
  labEl.classList.add("open");
  mlRender();
}
function closeLab() {
  labOpen = false;
  labEl.classList.remove("open");
}
document.getElementById("labClose").addEventListener("click", closeLab);

/* تهيئة: ابدا بمثال الفئتين */
document.getElementById("mlKVal").textContent = mlK();
document.getElementById("mlDepthVal").textContent = mlDepth();
mlSyncControls();
mlGaussBlob(0.32, 0.38, 0, 22, 0.16); mlGaussBlob(0.68, 0.64, 1, 22, 0.16);
mlRender();
