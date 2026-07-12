/* رياضيات مختبر سطح الخسارة — وحدة نقية (بلا DOM/THREE) تستورد في المتصفح وnode معا،
   فالاختبارات الآلية تختبر الكود المنشور نفسه لا نسخة منه.

   المصادر الاولية:
   - Cauchy (1847), "Méthode générale pour la résolution des systèmes d'équations simultanées" — اصل النزول التدرجي.
   - Polyak (1964), "Some methods of speeding up the convergence of iteration methods" — الزخم (الكرة الثقيلة)؛
     والصيغة المنفذة هي Goodfellow, Bengio & Courville (2016), Deep Learning, Algorithm 8.2.
   - Kingma & Ba (2015), "Adam: A Method for Stochastic Optimization", ICLR (arXiv:1412.6980), Algorithm 1 حرفيا.
   - Rosenbrock (1960), "An automatic method for finding the greatest or least value of a function",
     The Computer Journal 3(3):175–184.
   - Himmelblau (1972), Applied Nonlinear Programming, McGraw-Hill.
   - Hubble (1929), "A relation between distance and radial velocity among extra-galactic nebulae",
     PNAS 15(3):168–173 — الجدول 1 (24 سديما).
   - نظرية عتبة التقارب على الدوال التربيعية: التدرج بخطوة ثابتة يتقارب اذا وفقط اذا lr < 2/λmax(H)
     — نتيجة قياسية في تحسين الدوال التربيعية (تحليل الانماط الذاتية للهسيان؛ يقارب في
     Goodfellow واخرون 2016 §4.3 عبر رقم الشرط، ويرد صريحا في مراجع التحسين المحدب). */

/* ============ بيانات هابل 1929 (الجدول 1 كاملا: الاسم، المسافة Mpc، السرعة km/s) ============
   ملاحظة امانة تاريخية: مسافات 1929 تحمل خطا منهجيا معروفا في معايرة الشموع القياسية،
   فثابت هابل الناتج (≈454 بالمربعات الصغرى) اعلى بنحو 6-7 اضعاف من القياسات الحديثة (H0 ≈ 67-74).
   صحة رياضيات الملاءمة مستقلة تماما عن هذا الخطا المنهجي في البيانات — وهذا نفسه درس علمي يعرضه المختبر. */
export const HUBBLE_1929 = {
  source: "Hubble, E. (1929). PNAS 15(3), 168-173. Table 1.",
  units: { r: "Mpc", v: "km/s" },
  rows: [
    ["S. Mag.", 0.032, 170], ["L. Mag.", 0.034, 290], ["NGC 6822", 0.214, -130],
    ["NGC 598", 0.263, -70], ["NGC 221", 0.275, -185], ["NGC 224", 0.275, -220],
    ["NGC 5457", 0.45, 200], ["NGC 4736", 0.5, 290], ["NGC 5194", 0.5, 270],
    ["NGC 4449", 0.63, 200], ["NGC 4214", 0.8, 300], ["NGC 3031", 0.9, -30],
    ["NGC 3627", 0.9, 650], ["NGC 4826", 0.9, 150], ["NGC 5236", 0.9, 500],
    ["NGC 1068", 1.0, 920], ["NGC 5055", 1.1, 450], ["NGC 7331", 1.1, 500],
    ["NGC 4258", 1.4, 500], ["NGC 4151", 1.7, 960], ["NGC 4382", 2.0, 500],
    ["NGC 4472", 2.0, 850], ["NGC 4486", 2.0, 800], ["NGC 4649", 2.0, 1090],
  ],
};

/* ============ سطح خسارة MSE لانحدار خطي v ≈ w·r + b ============
   J(w,b) = (1/n) Σ (vᵢ − (w·rᵢ + b))²  — تربيعية محدبة تماما: قاع وحيد، لا قيعان محلية.
   J تحسب بحلقة مباشرة على الصفوف (لا صيغة مختصرة) — السطح المعروض هو الدالة الفعلية نقطة نقطة. */
export function makeMSE(rows) {
  const n = rows.length;
  let Sr = 0, Srr = 0, Sv = 0, Srv = 0;
  for (const [, r, v] of rows) { Sr += r; Srr += r * r; Sv += v; Srv += r * v; }

  const f = (w, b) => {
    let s = 0;
    for (const [, r, v] of rows) { const e = v - (w * r + b); s += e * e; }
    return s / n;
  };
  const grad = (w, b) => {
    let gw = 0, gb = 0;
    for (const [, r, v] of rows) { const e = w * r + b - v; gw += e * r; gb += e; }
    return [2 * gw / n, 2 * gb / n];
  };
  /* هسيان ثابت (تربيعية): H = (2/n) [[Σr², Σr], [Σr, n]] */
  const hessian = () => [[2 * Srr / n, 2 * Sr / n], [2 * Sr / n, 2]];
  /* القيم الذاتية لمصفوفة 2×2 متناظرة — صيغة مغلقة */
  const eig = () => {
    const [[a, c], [, d]] = hessian();
    const t = (a + d) / 2, det = a * d - c * c;
    const s = Math.sqrt(Math.max(0, t * t - det));
    return { max: t + s, min: t - s };
  };
  /* الحل المغلق (المعادلات الطبيعية least squares): [[Σr², Σr],[Σr, n]]·[w,b]ᵀ = [Σrv, Σv]ᵀ */
  const closedForm = () => {
    const det = Srr * n - Sr * Sr;
    return { w: (n * Srv - Sr * Sv) / det, b: (Srr * Sv - Sr * Srv) / det };
  };
  return { f, grad, hessian, eig, closedForm, n,
    lrMax: () => 2 / eig().max,                 /* عتبة التقارب النظرية على التربيعية */
    condition: () => eig().max / eig().min };
}

/* ============ دالتا الاختبار القياسيتان (معلنتان: ليستا خسارة نموذج مدرب) ============ */

/* Rosenbrock (1960): f = (1−x)² + 100(y−x²)² — قاع شامل وحيد عند (1,1) بقيمة 0، داخل واد منحن ضيق. */
export const rosenbrock = {
  f: (x, y) => { const a = 1 - x, b = y - x * x; return a * a + 100 * b * b; },
  grad: (x, y) => [-2 * (1 - x) - 400 * x * (y - x * x), 200 * (y - x * x)],
  minima: [{ x: 1, y: 1 }],
};

/* Himmelblau (1972): f = (x²+y−11)² + (x+y²−7)² — اربعة قيعان شاملة متساوية (كلها f=0). */
const himmelblauF = (x, y) => {
  const a = x * x + y - 11, b = x + y * y - 7;
  return a * a + b * b;
};
const himmelblauGrad = (x, y) => {
  const a = x * x + y - 11, b = x + y * y - 7;
  return [4 * x * a + 2 * b, 2 * a + 4 * y * b];
};
const himmelblauHess = (x, y) => [
  [12 * x * x + 4 * y - 42, 4 * (x + y)],
  [4 * (x + y), 4 * x + 12 * y * y - 26],
];

/* صقل نيوتن لنقطة حرجة: θ ← θ − H⁻¹∇f — تقارب تربيعي، يبلغ دقة الآلة في بضع خطوات */
export function newtonRefine(grad, hess, x0, y0, iters = 12) {
  let x = x0, y = y0;
  for (let i = 0; i < iters; i++) {
    const [gx, gy] = grad(x, y);
    const [[a, b], [c, d]] = hess(x, y);
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-14) break;
    x -= (d * gx - b * gy) / det;
    y -= (a * gy - c * gx) / det;
  }
  return { x, y };
}

/* القيعان الاربعة: (3,2) جذر صحيح دقيق؛ الثلاثة الاخرى لاجذرية تصقل بنيوتن الى دقة الآلة عند التحميل */
const HIMMELBLAU_SEEDS = [[3, 2], [-2.805118, 3.131312], [-3.779310, -3.283186], [3.584428, -1.848126]];
export const himmelblau = {
  f: himmelblauF, grad: himmelblauGrad, hess: himmelblauHess,
  minima: HIMMELBLAU_SEEDS.map(([x, y]) => newtonRefine(himmelblauGrad, himmelblauHess, x, y)),
};

/* ============ فحص التدرج (فروق مركزية) — نفس بوابة البرهان في مختبرات الاطلس ============ */
export function gradCheck(f, grad, x, y) {
  const [ax, ay] = grad(x, y);
  const hx = 1e-5 * Math.max(1, Math.abs(x)), hy = 1e-5 * Math.max(1, Math.abs(y));
  const nx = (f(x + hx, y) - f(x - hx, y)) / (2 * hx);
  const ny = (f(x, y + hy) - f(x, y - hy)) / (2 * hy);
  const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(a) + Math.abs(b));
  return Math.max(rel(ax, nx), rel(ay, ny));
}

/* ============ المحسنات — الصيغ المنشورة حرفيا، بحالة مكشوفة للاختبار ============ */

/* النزول التدرجي (كوشي 1847): θ ← θ − lr·∇J */
export function makeGD(lr) {
  return {
    kind: "gd", lr, p: [0, 0], k: 0,
    init(w, b) { this.p = [w, b]; this.k = 0; },
    step(grad) {
      const [gx, gy] = grad(this.p[0], this.p[1]);
      this.p[0] -= this.lr * gx; this.p[1] -= this.lr * gy;
      this.k++; return [gx, gy];
    },
  };
}

/* الزخم — الكرة الثقيلة (Polyak 1964؛ Goodfellow et al. 2016, Alg. 8.2):
   v ← α·v − lr·∇J ؛ θ ← θ + v */
export function makeMomentum(lr, alpha = 0.9) {
  return {
    kind: "momentum", lr, alpha, p: [0, 0], v: [0, 0], k: 0,
    init(w, b) { this.p = [w, b]; this.v = [0, 0]; this.k = 0; },
    step(grad) {
      const [gx, gy] = grad(this.p[0], this.p[1]);
      this.v[0] = this.alpha * this.v[0] - this.lr * gx;
      this.v[1] = this.alpha * this.v[1] - this.lr * gy;
      this.p[0] += this.v[0]; this.p[1] += this.v[1];
      this.k++; return [gx, gy];
    },
  };
}

/* Adam (Kingma & Ba 2015، الخوارزمية 1 حرفيا):
   t←t+1؛ m←β₁m+(1−β₁)g؛ v←β₂v+(1−β₂)g²؛ m̂←m/(1−β₁ᵗ)؛ v̂←v/(1−β₂ᵗ)؛ θ←θ−α·m̂/(√v̂+ε) */
export function makeAdam(lr, beta1 = 0.9, beta2 = 0.999, eps = 1e-8) {
  return {
    kind: "adam", lr, beta1, beta2, eps,
    p: [0, 0], m: [0, 0], v: [0, 0], t: 0, mhat: [0, 0], vhat: [0, 0],
    init(w, b) { this.p = [w, b]; this.m = [0, 0]; this.v = [0, 0]; this.t = 0; },
    step(grad) {
      const g = grad(this.p[0], this.p[1]);
      this.t++;
      const c1 = 1 - Math.pow(this.beta1, this.t), c2 = 1 - Math.pow(this.beta2, this.t);
      for (let i = 0; i < 2; i++) {
        this.m[i] = this.beta1 * this.m[i] + (1 - this.beta1) * g[i];
        this.v[i] = this.beta2 * this.v[i] + (1 - this.beta2) * g[i] * g[i];
        this.mhat[i] = this.m[i] / c1;
        this.vhat[i] = this.v[i] / c2;
        this.p[i] -= this.lr * this.mhat[i] / (Math.sqrt(this.vhat[i]) + this.eps);
      }
      return g;
    },
  };
}

/* ============ شبكة السطح — يبنيها المشهد والاختبار من الدالة نفسها ============ */
export function buildGrid(f, xmin, xmax, ymin, ymax, nx = 121, ny = 121) {
  const J = new Float64Array(nx * ny);
  let jmin = Infinity, jmax = -Infinity;
  for (let iy = 0; iy < ny; iy++) {
    const y = ymin + (ymax - ymin) * iy / (ny - 1);
    for (let ix = 0; ix < nx; ix++) {
      const x = xmin + (xmax - xmin) * ix / (nx - 1);
      const v = f(x, y);
      J[iy * nx + ix] = v;
      if (v < jmin) jmin = v;
      if (v > jmax) jmax = v;
    }
  }
  return { J, nx, ny, xmin, xmax, ymin, ymax, jmin, jmax };
}

/* خطوط الكنتور (مربعات زاحفة مبسطة) — مستويات J ترجع قطعا [x1,y1,x2,y2] بوحدات المعاملات */
export function contourSegments(grid, level) {
  const { J, nx, ny, xmin, xmax, ymin, ymax } = grid;
  const dx = (xmax - xmin) / (nx - 1), dy = (ymax - ymin) / (ny - 1);
  const segs = [];
  const lerp = (a, b, va, vb) => a + (level - va) / (vb - va) * (b - a);
  for (let iy = 0; iy < ny - 1; iy++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const x0 = xmin + ix * dx, y0 = ymin + iy * dy;
      const v00 = J[iy * nx + ix], v10 = J[iy * nx + ix + 1];
      const v01 = J[(iy + 1) * nx + ix], v11 = J[(iy + 1) * nx + ix + 1];
      const pts = [];
      if ((v00 < level) !== (v10 < level)) pts.push([lerp(x0, x0 + dx, v00, v10), y0]);
      if ((v10 < level) !== (v11 < level)) pts.push([x0 + dx, lerp(y0, y0 + dy, v10, v11)]);
      if ((v01 < level) !== (v11 < level)) pts.push([lerp(x0, x0 + dx, v01, v11), y0 + dy]);
      if ((v00 < level) !== (v01 < level)) pts.push([x0, lerp(y0, y0 + dy, v00, v01)]);
      if (pts.length === 2) segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]]);
    }
  }
  return segs;
}
