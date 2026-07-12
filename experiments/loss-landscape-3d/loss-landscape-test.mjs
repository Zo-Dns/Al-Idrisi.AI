/* اختبارات مختبر سطح الخسارة — تستورد وحدة الرياضيات المنشورة نفسها (src/math.js)
   وتتحقق منها ضد حسابات يدوية وقيم موثقة في الادبيات. التشغيل: node loss-landscape-test.mjs */
import {
  HUBBLE_1929, makeMSE, rosenbrock, himmelblau, newtonRefine,
  gradCheck, makeGD, makeMomentum, makeAdam, buildGrid,
} from "./src/math.js";

let fails = 0;
const T = (name, ok, info = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${info ? " | " + info : ""}`);
  if (!ok) fails++;
};

/* 1. سلامة جدول هابل 1929: 24 صفا، مسافات موجبة، سرعات ضمن نطاق الورقة */
{
  const rows = HUBBLE_1929.rows;
  const ok = rows.length === 24
    && rows.every(([nm, r, v]) => typeof nm === "string" && r > 0 && r <= 2 && Math.abs(v) <= 1090);
  T("hubble-table-shape (24 صفا ضمن نطاقات الورقة)", ok, `n=${rows.length}`);
}

const mse = makeMSE(HUBBLE_1929.rows);

/* 2. الحارس الحاسم: حل المربعات الصغرى يطابق القيمة الموثقة في الادبيات للجدول 1
      (OLS على بيانات هابل 1929: الميل ≈ 454.16 km/s/Mpc والتقاطع ≈ -40.78 km/s —
      اعادة الحساب القياسية المنشورة في مراجع الاحصاء لهذه البيانات؛ هابل نفسه اورد K=465±50) */
{
  const { w, b } = mse.closedForm();
  const ok = Math.abs(w - 454.16) < 0.5 && Math.abs(b - (-40.78)) < 0.5;
  T("hubble-ols-matches-literature", ok, `w=${w.toFixed(2)} b=${b.toFixed(2)} (متوقع ≈454.16/-40.78)`);
}

/* 3. الحل المغلق نقطة حرجة فعلا: ‖∇J(w*,b*)‖ ≈ 0 */
{
  const { w, b } = mse.closedForm();
  const [gw, gb] = mse.grad(w, b);
  const norm = Math.hypot(gw, gb);
  T("closed-form-is-stationary", norm < 1e-6, `‖∇J‖=${norm.toExponential(2)}`);
}

/* 4. النزول التدرجي يتقارب الى الحل المغلق بالضبط (تربيعية: البرهان الذهبي) */
{
  const { w, b } = mse.closedForm();
  const gd = makeGD(1 / mse.eig().max);
  gd.init(0, 0);
  for (let i = 0; i < 5000; i++) gd.step(mse.grad);
  const dw = Math.abs(gd.p[0] - w), db = Math.abs(gd.p[1] - b);
  T("gd-converges-to-closed-form", dw < 1e-6 && db < 1e-6,
    `Δw=${dw.toExponential(1)} Δb=${db.toExponential(1)} بعد 5000 خطوة`);
}

/* 5. فحص التدرج (فروق مركزية) على الاسطح الثلاثة في نقاط متعددة */
{
  const pts = [[0, 0], [300, -200], [454, -40], [-1.5, 2], [2, 0.5], [-3, -3], [4, 1], [0.3, 0.7]];
  let worst = 0;
  for (const [x, y] of pts) {
    worst = Math.max(worst,
      gradCheck(mse.f, mse.grad, x, y),
      gradCheck(rosenbrock.f, rosenbrock.grad, x / 100, y / 100),
      gradCheck(himmelblau.f, himmelblau.grad, x / 100, y / 100));
  }
  T("gradient-check-all-surfaces", worst < 1e-5, `اسوأ خطا نسبي=${worst.toExponential(1)}`);
}

/* 6. قاع Rosenbrock الشامل دقيق جبريا: f(1,1)=0 و∇f(1,1)=0 بالضبط */
{
  const f = rosenbrock.f(1, 1);
  const [gx, gy] = rosenbrock.grad(1, 1);
  T("rosenbrock-global-min-exact", f === 0 && gx === 0 && gy === 0, `f=${f} ∇=[${gx},${gy}]`);
}

/* 7. قيعان Himmelblau الاربعة: (3,2) صفر جبري، والثلاثة المصقولة بنيوتن عند دقة الآلة */
{
  const exact = himmelblau.f(3, 2);
  let worstF = 0, worstG = 0;
  for (const { x, y } of himmelblau.minima) {
    worstF = Math.max(worstF, himmelblau.f(x, y));
    const [gx, gy] = himmelblau.grad(x, y);
    worstG = Math.max(worstG, Math.hypot(gx, gy));
  }
  T("himmelblau-four-minima", exact === 0 && worstF < 1e-16 && worstG < 1e-7,
    `f(3,2)=${exact} · اسوأ f=${worstF.toExponential(1)} · اسوأ ‖∇‖=${worstG.toExponential(1)}`);
}

/* 8. صقل نيوتن يبلغ نقطة حرجة من بذرة مزاحة (يثبت ان القيعان المعلنة حرجة حقا) */
{
  const { x, y } = newtonRefine(himmelblau.grad, himmelblau.hess, 3.2, 1.8);
  const [gx, gy] = himmelblau.grad(x, y);
  T("newton-refine-reaches-stationary", Math.hypot(gx, gy) < 1e-10 && Math.abs(x - 3) < 0.01,
    `(${x.toFixed(6)}, ${y.toFixed(6)}) ‖∇‖=${Math.hypot(gx, gy).toExponential(1)}`);
}

/* 9. هوية Adam عند الخطوة الاولى: m̂₁ = g بالضبط (تصحيح الانحياز يلغي (1−β₁) جبريا)
      والخطوة ≈ −lr·g/(|g|+ε) لان v̂₁ = g² */
{
  const adam = makeAdam(0.05);
  adam.init(100, 100);
  const [gx, gy] = mse.grad(100, 100);
  const p0 = [...adam.p];
  adam.step(mse.grad);
  const idOk = Math.abs(adam.mhat[0] - gx) / Math.abs(gx) < 1e-14
            && Math.abs(adam.mhat[1] - gy) / Math.abs(gy) < 1e-14;
  const s0 = p0[0] - adam.lr * gx / (Math.abs(gx) + adam.eps);
  const s1 = p0[1] - adam.lr * gy / (Math.abs(gy) + adam.eps);
  const stepOk = Math.abs(adam.p[0] - s0) < 1e-10 && Math.abs(adam.p[1] - s1) < 1e-10;
  T("adam-step1-identity (Kingma-Ba Alg.1)", idOk && stepOk,
    `m̂₁=g ✓ · |Δθ|≈lr=${adam.lr}`);
}

/* 10. الزخم يطابق التكرار اليدوي (v←αv−lr·g؛ θ←θ+v) ثلاث خطوات على تربيعية بسيطة f=x²+4y² */
{
  const f2grad = (x, y) => [2 * x, 8 * y];
  const mom = makeMomentum(0.1, 0.9);
  mom.init(1, 1);
  let px = 1, py = 1, vx = 0, vy = 0;
  for (let i = 0; i < 3; i++) {
    mom.step(f2grad);
    const [gx, gy] = f2grad(px, py);
    vx = 0.9 * vx - 0.1 * gx; vy = 0.9 * vy - 0.1 * gy;
    px += vx; py += vy;
  }
  const ok = Math.abs(mom.p[0] - px) < 1e-15 && Math.abs(mom.p[1] - py) < 1e-15;
  T("momentum-matches-hand-recurrence", ok, `θ₃=(${px.toFixed(6)}, ${py.toFixed(6)})`);
}

/* 11+12. عتبة التقارب النظرية lr=2/λmax على التربيعية — من الجهتين:
       دون العتبة: هبوط رتيب في J كل خطوة؛ فوقها: J تنمو (تباعد) */
{
  const lmax = mse.eig().max;
  const below = makeGD(1.99 / lmax);
  below.init(0, 0);
  let mono = true, prev = mse.f(0, 0);
  for (let i = 0; i < 300; i++) {
    below.step(mse.grad);
    const j = mse.f(below.p[0], below.p[1]);
    if (j > prev + 1e-9) { mono = false; break; }
    prev = j;
  }
  T("monotone-descent-below-2/L", mono, `lr=1.99/λmax=${(1.99 / lmax).toFixed(4)}`);

  const above = makeGD(2.05 / lmax);
  above.init(0, 0);
  const j0 = mse.f(0, 0);
  for (let i = 0; i < 50; i++) above.step(mse.grad);
  const j50 = mse.f(above.p[0], above.p[1]);
  T("divergence-above-2/L", j50 > j0, `J₀=${j0.toExponential(2)} → J₅₀=${j50.toExponential(2)}`);
}

/* 13. شبكة السطح التي يعرضها المشهد = قيم الدالة نفسها (عينات حتمية) */
{
  const grid = buildGrid(mse.f, -200, 1100, -600, 600, 121, 121);
  let ok = true;
  for (let s = 0; s < 25; s++) {
    const ix = (s * 29) % grid.nx, iy = (s * 53) % grid.ny;
    const x = grid.xmin + (grid.xmax - grid.xmin) * ix / (grid.nx - 1);
    const y = grid.ymin + (grid.ymax - grid.ymin) * iy / (grid.ny - 1);
    if (grid.J[iy * grid.nx + ix] !== mse.f(x, y)) { ok = false; break; }
  }
  T("surface-grid-equals-function", ok, "25 عينة حتمية متطابقة تماما");
}

console.log(fails === 0 ? "\nALL LOSS-LANDSCAPE TESTS PASSED" : `\n${fails} FAILURES`);
process.exit(fails ? 1 : 0);
