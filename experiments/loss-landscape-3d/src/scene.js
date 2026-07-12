/* مشهد مختبر سطح الخسارة 3D — كل ارتفاع على السطح قيمة J محسوبة من الدالة الفعلية،
   وكل مسار كرة تنفيذ حرفي لخوارزمية منشورة (كوشي 1847؛ بولياك 1964؛ Kingma-Ba 2015).
   الارتفاع مضغوط لوغارتميا للعرض (log1p) — القراءات الرقمية كلها خام. */
import * as THREE from "../../nn-3d-simulation/vendor/three/three.module.js";
import { OrbitControls } from "../../nn-3d-simulation/vendor/three/OrbitControls.js";
import {
  HUBBLE_1929, makeMSE, rosenbrock, himmelblau,
  gradCheck, makeGD, makeMomentum, makeAdam, buildGrid, contourSegments,
} from "./math.js";

/* ---------- مسار الفشل المرئي (نمط مختبرات الاطلس) ---------- */
const state = { ready: false };
function showFatal(err) {
  const box = document.getElementById("loading");
  if (!box) return;
  box.classList.remove("hide");
  box.innerHTML = `تعذر تحميل المختبر: <b style="color:#ffb3b3">${String((err && err.message) || err)}</b>
    <br><span style="font-size:12px;color:#8ba3c2">تاكد ان الخادم المحلي يعمل ثم اعد المحاولة — فتح index.html مباشرة من القرص (file://) يمنع تحميل الوحدات</span>
    <br><button id="retryBtn" style="margin-top:12px;background:rgba(105,201,255,.15);border:1px solid rgba(105,201,255,.5);color:#cfeaff;border-radius:9px;padding:8px 16px;cursor:pointer;font-family:inherit">اعادة المحاولة</button>`;
  box.style.flexDirection = "column";
  box.style.textAlign = "center";
  const rb = document.getElementById("retryBtn");
  if (rb) rb.onclick = () => location.reload();
}
window.addEventListener("error", (e) => {
  if (state.ready) return;
  const src = e && e.target && (e.target.src || e.target.href);
  showFatal((e && e.message) || (src ? "تعذر تحميل: " + src : "خطا في تحميل وحدة"));
}, true);
window.addEventListener("unhandledrejection", (e) => { if (!state.ready) showFatal(e.reason); });

const el = (id) => document.getElementById(id);
const fmt = (v) => {
  if (!isFinite(v)) return "∞";
  const a = Math.abs(v);
  return (a !== 0 && (a >= 1e6 || a < 1e-3)) ? v.toExponential(3) : Number(v.toPrecision(6)).toString();
};

/* ---------- المشاهد الثلاثة (النوع معلن بصدق على كل واحد) ---------- */
const mse = makeMSE(HUBBLE_1929.rows);
const CF = mse.closedForm();
const SCENES = {
  hubble: {
    title: "هابل 1929",
    badge: "خسارة نموذج حقيقي — MSE محدبة", badgeClass: "model",
    desc: "انحدار خطي v = w·r + b على السدم الـ24 من الجدول 1 في ورقة هابل (PNAS 1929). " +
      "السطح هو خسارة MSE الفعلية: تربيعية محدبة بقاع وحيد عند حل المربعات الصغرى — " +
      "والميل عند القاع هو ثابت هابل بوحدات km/s لكل Mpc. " +
      "(امانة تاريخية: مسافات 1929 تحمل خطا منهجيا في المعايرة؛ القيمة الحديثة H₀ ≈ 70 — صحة الملاءمة مستقلة عن ذلك.) " +
      "لاحظ Adam: خطوته محدودة بنحو ±lr لكل معامل مهما كبر التدرج (خاصية موثقة في الورقة، القسم 2.1) — " +
      "فعلى سطح بوحدات مئوية يزحف بخطوات ثابتة بينما يقفز النزول التدرجي مع التدرجات الكبيرة؛ سلوك حقيقي لا خطا عرض.",
    f: mse.f, grad: mse.grad,
    domain: { x: [-200, 1100], y: [-600, 600] },
    axis: { x: "w = H₀ (km/s / Mpc)", y: "b = v₀ (km/s)" },
    minima: [{ x: CF.w, y: CF.b, label: "الحل المغلق (المعادلات الطبيعية)" }],
    lr: { min: 1e-3, max: 1.2, def: 0.15 }, threshold: mse.lrMax(),
    logK: 60, start: [0, 0], inset: true,
    stats: [
      ["عدد السدم n", "24"], ["رقم الشرط κ", mse.condition().toFixed(2)],
      ["اكبر قيمة ذاتية λmax", mse.eig().max.toFixed(4)], ["عتبة التقارب 2/λmax", mse.lrMax().toFixed(4)],
      ["الحل المغلق (w*, b*)", `(${CF.w.toFixed(2)}, ${CF.b.toFixed(2)})`],
      ["J* عند القاع", fmt(mse.f(CF.w, CF.b))],
    ],
  },
  rosenbrock: {
    title: "روزنبروك 1960",
    badge: "دالة اختبار قياسية — ليست خسارة نموذج", badgeClass: "test",
    desc: "f = (1−x)² + 100(y−x²)² (Rosenbrock 1960): وادٍ منحنٍ ضيق يقود الى قاع شامل وحيد عند (1,1). " +
      "درسها: النزول التدرجي الخام يتعرج ويزحف في الوادي، والزخم يراكم السرعة على طوله — " +
      "قارن المسارات بنفسك من نفس نقطة البداية.",
    f: rosenbrock.f, grad: rosenbrock.grad,
    domain: { x: [-2, 2], y: [-1, 3] },
    axis: { x: "x", y: "y" },
    minima: [{ x: 1, y: 1, label: "القاع الشامل (1,1)" }],
    lr: { min: 1e-5, max: 3e-3, def: 1e-3 }, threshold: null,
    logK: 400, start: [-1.2, 1], inset: false,
    stats: [["القاع الشامل", "(1, 1)"], ["f عند القاع", "0 (جبريا)"], ["البنية", "وادٍ منحنٍ ضيق"]],
  },
  himmelblau: {
    title: "هيملبلاو 1972",
    badge: "دالة اختبار قياسية — ليست خسارة نموذج", badgeClass: "test",
    desc: "f = (x²+y−11)² + (x+y²−7)² (Himmelblau 1972): اربعة قيعان شاملة متساوية كلها f=0. " +
      "درسها: اي قاع تبلغه يقرره موضع البداية — انقر على السطح وغير البداية لترى احواض الجذب، " +
      "وهذا جوهر حساسية تدريب الشبكات العصبية للتهيئة.",
    f: himmelblau.f, grad: himmelblau.grad,
    domain: { x: [-5.5, 5.5], y: [-5.5, 5.5] },
    axis: { x: "x", y: "y" },
    minima: himmelblau.minima.map((m, i) => ({ x: m.x, y: m.y, label: `قاع ${i + 1}` })),
    lr: { min: 1e-4, max: 0.05, def: 0.01 }, threshold: null,
    logK: 50, start: [0, 0.5], inset: false,
    stats: [["عدد القيعان الشاملة", "4 (كلها f=0)"], ["اول قاع (جذر صحيح)", "(3, 2)"],
      ["البقية (مصقولة بنيوتن)", "دقة الآلة"]],
  },
};

/* ---------- THREE: المسرح ---------- */
const canvas = el("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene3 = new THREE.Scene();
scene3.background = new THREE.Color(0x070d19);
scene3.fog = new THREE.FogExp2(0x070d19, 0.00085);
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 4000);
camera.position.set(210, 250, 330);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = false;
controls.autoRotateSpeed = 0.25;
controls.minDistance = 90;
controls.maxDistance = 1200;
controls.target.set(0, 30, 0);

scene3.add(new THREE.AmbientLight(0x9eb4d6, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(-180, 320, 140);
scene3.add(sun);
const fill = new THREE.PointLight(0x69c9ff, 30, 1500);
fill.position.set(220, 180, -200);
scene3.add(fill);

const WORLD = 150, HEIGHT = 105;
const surfGroup = new THREE.Group(); scene3.add(surfGroup);
const pinGroup = new THREE.Group(); scene3.add(pinGroup);
const trailGroup = new THREE.Group(); scene3.add(trailGroup);
const axisGroup = new THREE.Group(); scene3.add(axisGroup);
scene3.add(new THREE.GridHelper(2 * WORLD + 60, 18, 0x24344f, 0x101b30));

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}
window.addEventListener("resize", resize);
resize();

function disposeGroup(g) {
  for (const child of [...g.children]) {
    g.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material) { if (child.material.map) child.material.map.dispose(); child.material.dispose(); }
  }
}
function labelSprite(text, color, width = 460, font = 40, scale = 84, dir = "rtl") {
  /* المستند RTL؛ النصوص اللاتينية (وحدات المحاور) يجب رسمها LTR والا اعاد bidi ترتيب مقاطعها فبدت مبتورة */
  const c = document.createElement("canvas");
  c.width = width; c.height = 100;
  const ctx = c.getContext("2d");
  ctx.font = `700 ${font}px Segoe UI, Tahoma, sans-serif`;
  ctx.direction = dir; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.fillStyle = color;
  ctx.fillText(text, width / 2, 50);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
  sp.scale.set(scale, scale * 100 / width, 1);
  sp.renderOrder = 25;
  return sp;
}

/* خريطة الالوان (منخفض ازرق داكن → مرتفع ذهبي) على الارتفاع اللوغارتمي المطبع */
const STOPS = [[0.06, 0.11, 0.23], [0.12, 0.29, 0.56], [0.18, 0.62, 0.63], [0.50, 0.82, 0.56], [1.0, 0.82, 0.40]];
function colorAt(t) {
  const x = Math.min(0.9999, Math.max(0, t)) * (STOPS.length - 1);
  const i = Math.floor(x), u = x - i;
  const a = STOPS[i], b = STOPS[i + 1];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

/* ---------- الحالة الحية ---------- */
const OPT_COLORS = { gd: 0x69c9ff, momentum: 0xf7a6d9, adam: 0xffd166 };
const OPT_NAMES = { gd: "نزول تدرجي", momentum: "زخم", adam: "Adam" };
const live = {
  key: null, sc: null, grid: null, mesh: null, wire: null, contours: null,
  toWorld: null, toParam: null, heightOfJ: null,
  opts: {}, running: false, rate: 12, acc: 0, start: [0, 0],
  arrow: null, alpha: 0.9,
};

function heightFor(sc, grid) {
  const k = sc.logK, span = Math.max(1e-12, grid.jmax - grid.jmin), lk = Math.log1p(k);
  return (J) => HEIGHT * Math.log1p(k * Math.max(0, J - grid.jmin) / span) / lk;
}

function buildSurface(sc) {
  disposeGroup(surfGroup); disposeGroup(pinGroup); disposeGroup(axisGroup);
  const [x0, x1] = sc.domain.x, [y0, y1] = sc.domain.y;
  const grid = buildGrid(sc.f, x0, x1, y0, y1, 121, 121);
  const hOf = heightFor(sc, grid);
  const toWorld = (x, y) => [((x - x0) / (x1 - x0) - 0.5) * 2 * WORLD, ((y - y0) / (y1 - y0) - 0.5) * 2 * WORLD];
  const toParam = (X, Z) => [x0 + (X / (2 * WORLD) + 0.5) * (x1 - x0), y0 + (Z / (2 * WORLD) + 0.5) * (y1 - y0)];

  const { nx, ny, J } = grid;
  const pos = new Float32Array(nx * ny * 3), col = new Float32Array(nx * ny * 3);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const i = iy * nx + ix;
      const x = x0 + (x1 - x0) * ix / (nx - 1), y = y0 + (y1 - y0) * iy / (ny - 1);
      const [X, Z] = toWorld(x, y);
      const h = hOf(J[i]);
      pos[3 * i] = X; pos[3 * i + 1] = h; pos[3 * i + 2] = Z;
      const [r, g, b] = colorAt(h / HEIGHT);
      col[3 * i] = r; col[3 * i + 1] = g; col[3 * i + 2] = b;
    }
  }
  const idx = new Uint32Array((nx - 1) * (ny - 1) * 6);
  let p = 0;
  for (let iy = 0; iy < ny - 1; iy++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = iy * nx + ix, b = a + 1, c = a + nx, d = c + 1;
      idx[p++] = a; idx[p++] = c; idx[p++] = b;
      idx[p++] = b; idx[p++] = c; idx[p++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.82, metalness: 0.05, side: THREE.DoubleSide,
  }));
  surfGroup.add(mesh);

  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x9eb4d6, transparent: true, opacity: 0.05 }));
  wire.visible = el("wireChk").checked;
  surfGroup.add(wire);

  /* كنتور: 12 مستوى موزعة لوغارتميا بين قيم الشبكة */
  const cGroup = new THREE.Group();
  const span = Math.max(1e-12, grid.jmax - grid.jmin);
  for (let L = 1; L <= 12; L++) {
    const t = L / 13;
    const level = grid.jmin + span * (Math.expm1(t * Math.log1p(sc.logK)) / sc.logK);
    const segs = contourSegments(grid, level);
    if (!segs.length) continue;
    const cp = new Float32Array(segs.length * 6);
    let q = 0;
    for (const [ax, ay, bx, by] of segs) {
      const [AX, AZ] = toWorld(ax, ay), [BX, BZ] = toWorld(bx, by);
      cp[q++] = AX; cp[q++] = 0.6; cp[q++] = AZ;
      cp[q++] = BX; cp[q++] = 0.6; cp[q++] = BZ;
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute("position", new THREE.BufferAttribute(cp, 3));
    cGroup.add(new THREE.LineSegments(cg,
      new THREE.LineBasicMaterial({ color: 0x8ba3c2, transparent: true, opacity: 0.22 })));
  }
  cGroup.visible = el("contourChk").checked;
  surfGroup.add(cGroup);

  /* دبابيس القيعان المعلومة */
  for (const m of sc.minima) {
    const [X, Z] = toWorld(m.x, m.y);
    const h = hOf(sc.f(m.x, m.y));
    const pin = new THREE.Mesh(new THREE.OctahedronGeometry(3.4),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.95 }));
    pin.position.set(X, h + 6, Z);
    pinGroup.add(pin);
    const lb = labelSprite(m.label, "#ffd166", 480, 34, 70);
    lb.position.set(X, h + 16, Z);
    pinGroup.add(lb);
  }

  /* تسميات المحاور — اللاتينية LTR كي لا يشوهها bidi، وتسمية الارتفاع عربية نقية */
  const ax1 = labelSprite(sc.axis.x, "#8ba3c2", 520, 34, 96, "ltr");
  ax1.position.set(0, 3, WORLD + 26); axisGroup.add(ax1);
  const ax2 = labelSprite(sc.axis.y, "#8ba3c2", 520, 34, 96, "ltr");
  ax2.position.set(-(WORLD + 26), 3, 0); ax2.material.rotation = Math.PI / 2; axisGroup.add(ax2);
  const ax3 = labelSprite("الارتفاع: قيمة الخسارة (مضغوطة لوغارتميا — القراءات الرقمية خام)", "#5f7397", 680, 30, 118);
  ax3.position.set(WORLD + 20, HEIGHT * 0.75, -(WORLD + 20)); axisGroup.add(ax3);

  live.grid = grid; live.mesh = mesh; live.wire = wire; live.contours = cGroup;
  live.toWorld = toWorld; live.toParam = toParam; live.heightOfJ = hOf;
}

/* ---------- المحسنات الثلاثة ---------- */
function makeOpts(sc) {
  disposeGroup(trailGroup);
  const lr = currentLr();   /* المنزلق لوغاريتمي — القيمة الفعلية 10^قيمته */
  const defs = {
    gd: makeGD(lr),
    momentum: makeMomentum(lr, live.alpha),
    adam: makeAdam(lr),
  };
  live.opts = {};
  for (const key of ["gd", "momentum", "adam"]) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(3.1, 22, 14),
      new THREE.MeshBasicMaterial({ color: OPT_COLORS[key] }));
    trailGroup.add(ball);
    const trailGeo = new THREE.BufferGeometry();
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
      color: OPT_COLORS[key], transparent: true, opacity: 0.85 }));
    trail.frustumCulled = false;
    trailGroup.add(trail);
    live.opts[key] = { o: defs[key], ball, trail, pts: [], enabled: el(`chip-${key}`).classList.contains("off") === false, diverged: false };
  }
  if (!live.arrow) {
    live.arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 20, 0xeaf4ff, 6, 3.4);
    scene3.add(live.arrow);
  }
  resetOpts(live.start[0], live.start[1]);
}

function resetOpts(x, y) {
  live.start = [x, y];
  for (const key of Object.keys(live.opts)) {
    const L = live.opts[key];
    L.o.init(x, y);
    L.diverged = false;
    L.pts = [];
    placeBall(L);
    pushTrail(L);
  }
  updateReadout(); updateArrow(); drawInset();
}

function placeBall(L) {
  const [x, y] = L.o.p;
  const sc = live.sc;
  const cx = Math.min(Math.max(x, sc.domain.x[0]), sc.domain.x[1]);
  const cy = Math.min(Math.max(y, sc.domain.y[0]), sc.domain.y[1]);
  const [X, Z] = live.toWorld(cx, cy);
  const J = sc.f(x, y);
  const h = live.heightOfJ(isFinite(J) ? sc.f(cx, cy) : live.grid.jmax);
  L.ball.position.set(X, h + 3.4, Z);
  L.ball.visible = L.enabled;
  L.trail.visible = L.enabled;
}

function pushTrail(L) {
  const p = L.ball.position;
  L.pts.push(p.x, p.y + 0.8, p.z);
  if (L.pts.length > 3 * 4000) L.pts.splice(0, 3 * 400);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(L.pts), 3));
  L.trail.geometry.dispose();
  L.trail.geometry = g;
}

function outOfRange(sc, x, y, J) {
  const w = sc.domain.x[1] - sc.domain.x[0], h = sc.domain.y[1] - sc.domain.y[0];
  return !isFinite(J) || J > 1e14
    || x < sc.domain.x[0] - 4 * w || x > sc.domain.x[1] + 4 * w
    || y < sc.domain.y[0] - 4 * h || y > sc.domain.y[1] + 4 * h;
}

function stepAll(n = 1) {
  const sc = live.sc;
  for (let i = 0; i < n; i++) {
    for (const key of Object.keys(live.opts)) {
      const L = live.opts[key];
      if (!L.enabled || L.diverged) continue;
      L.o.step(sc.grad);
      const [x, y] = L.o.p;
      const J = sc.f(x, y);
      if (outOfRange(sc, x, y, J)) { L.diverged = true; }
      placeBall(L);
      pushTrail(L);
    }
  }
  updateReadout(); updateArrow(); drawInset();
}

/* ---------- الواجهة ---------- */
function updateReadout() {
  const sc = live.sc;
  let html = `<div class="rrow head"><span class="nm"></span><span>J</span><span>‖∇J‖</span><span>خطوات</span><span>الحالة</span></div>`;
  for (const key of ["gd", "momentum", "adam"]) {
    const L = live.opts[key];
    const [x, y] = L.o.p;
    const J = sc.f(x, y);
    const [gx, gy] = sc.grad(x, y);
    const gn = Math.hypot(gx, gy);
    const st = !L.enabled ? "—" : L.diverged
      ? `<span class="st bad">تباعد ↑</span>`
      : (gn < 1e-6 ? `<span class="st">استقر ✓</span>` : `<span class="st">ينزل…</span>`);
    html += `<div class="rrow" data-o="${key}"><span class="nm">${OPT_NAMES[key]}</span>` +
      `<span>${L.enabled ? fmt(J) : "—"}</span><span>${L.enabled ? fmt(gn) : "—"}</span>` +
      `<span>${L.enabled ? L.o.k ?? L.o.t : "—"}</span><span>${st}</span></div>`;
  }
  el("readout").innerHTML = html;
}

function updateArrow() {
  const order = ["gd", "momentum", "adam"];
  const key = order.find((k) => live.opts[k].enabled && !live.opts[k].diverged);
  if (!key) { live.arrow.visible = false; return; }
  const L = live.opts[key];
  const [x, y] = L.o.p;
  const [gx, gy] = live.sc.grad(x, y);
  const gn = Math.hypot(gx, gy);
  if (gn < 1e-12) { live.arrow.visible = false; return; }
  /* اتجاه اشد انحدار = سالب التدرج، معروضا على ارضية المخطط (فضاء المعاملات) */
  const sx = (live.sc.domain.x[1] - live.sc.domain.x[0]) / (2 * WORLD);
  const sy = (live.sc.domain.y[1] - live.sc.domain.y[0]) / (2 * WORLD);
  const dir = new THREE.Vector3(-gx / sx, 0, -gy / sy).normalize();
  live.arrow.visible = true;
  live.arrow.position.copy(L.ball.position).setY(1.2);
  live.arrow.setDirection(dir);
  live.arrow.setLength(Math.min(44, 10 + 9 * Math.log10(1 + gn)), 6, 3.2);
}

/* اللوحة الداخلية (هابل فقط): فضاء البيانات — كل نقطة (w,b) على السطح تكافئ خطا كاملا */
function drawInset() {
  const box = el("inset");
  if (!live.sc || !live.sc.inset) { box.style.display = "none"; return; }
  box.style.display = "block";
  const cv = el("insetCv"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.direction = "ltr";   /* الكانفس يرث rtl من المستند فيشوه bidi التسميات اللاتينية */
  const rmax = 2.3, vmin = -450, vmax = 1250;
  const px = (r) => 30 + (W - 40) * r / rmax;
  const py = (v) => H - 22 - (H - 34) * (v - vmin) / (vmax - vmin);
  ctx.strokeStyle = "rgba(140,170,210,0.35)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px(0), py(vmin)); ctx.lineTo(px(0), py(vmax)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(px(rmax), py(0)); ctx.stroke();
  ctx.fillStyle = "#8ba3c2"; ctx.font = "10px Segoe UI"; ctx.textAlign = "left";
  ctx.fillText("v (km/s)", 4, 12); ctx.fillText("r (Mpc)", W - 48, py(0) - 6);
  const lines = [["#ffd166", CF.w, CF.b, 2, [5, 4]]];
  for (const key of ["gd", "momentum", "adam"]) {
    const L = live.opts[key];
    if (L && L.enabled && !L.diverged) lines.push(["#" + OPT_COLORS[key].toString(16).padStart(6, "0"), L.o.p[0], L.o.p[1], 1.4, []]);
  }
  for (const [color, w, b, lw, dash] of lines) {
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(px(0), py(b)); ctx.lineTo(px(rmax), py(w * rmax + b)); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = "#cfe4ff";
  for (const [, r, v] of HUBBLE_1929.rows) {
    ctx.beginPath(); ctx.arc(px(r), py(v), 2.1, 0, 7); ctx.fill();
  }
}

/* ---------- البرهان الحي (يعاد حسابه عند التحميل — نفس فحوص طقم node) ---------- */
function runProofs() {
  const rows = [];
  const pts = [[0, 0], [300, -200], [454, -40], [-1.5, 2], [2, 0.5], [-3, -3], [4, 1], [0.3, 0.7]];
  let worst = 0;
  for (const [x, y] of pts) {
    worst = Math.max(worst,
      gradCheck(mse.f, mse.grad, x, y),
      gradCheck(rosenbrock.f, rosenbrock.grad, x / 100, y / 100),
      gradCheck(himmelblau.f, himmelblau.grad, x / 100, y / 100));
  }
  rows.push(["فحص التدرج (3 اسطح، فروق مركزية)", `${worst.toExponential(1)} ${worst < 1e-5 ? "✓" : "✗"}`]);

  rows.push(["OLS يطابق الادبيات (454.16, −40.78)",
    `(${CF.w.toFixed(2)}, ${CF.b.toFixed(2)}) ${Math.abs(CF.w - 454.16) < 0.5 ? "✓" : "✗"}`]);

  const gd = makeGD(1 / mse.eig().max);
  gd.init(0, 0);
  for (let i = 0; i < 5000; i++) gd.step(mse.grad);
  const d = Math.hypot(gd.p[0] - CF.w, gd.p[1] - CF.b);
  rows.push(["تقارب GD الى الحل المغلق (5000 خطوة)", `Δ=${d.toExponential(1)} ${d < 1e-6 ? "✓" : "✗"}`]);

  const adam = makeAdam(0.05); adam.init(100, 100);
  const [gx] = mse.grad(100, 100);
  adam.step(mse.grad);
  const idOk = Math.abs(adam.mhat[0] - gx) / Math.abs(gx) < 1e-14;
  rows.push(["هوية Adam خطوة 1: m̂₁ = g", idOk ? "متطابقة ✓" : "✗"]);

  const lmax = mse.eig().max;
  const b1 = makeGD(1.99 / lmax); b1.init(0, 0);
  let mono = true, prev = mse.f(0, 0);
  for (let i = 0; i < 300; i++) { b1.step(mse.grad); const j = mse.f(b1.p[0], b1.p[1]); if (j > prev + 1e-9) { mono = false; break; } prev = j; }
  const b2 = makeGD(2.05 / lmax); b2.init(0, 0);
  const j0 = mse.f(0, 0);
  for (let i = 0; i < 50; i++) b2.step(mse.grad);
  const div = mse.f(b2.p[0], b2.p[1]) > j0;
  rows.push(["عتبة 2/λmax: هبوط دونها وتباعد فوقها", mono && div ? "الجهتان ✓" : "✗"]);

  el("proofRows").innerHTML = rows.map(([k, v]) => `<div class="proofRow"><span>${k}</span><b>${v}</b></div>`).join("");
}

/* ---------- تبديل المشهد ---------- */
function switchScene(key) {
  live.key = key;
  live.sc = SCENES[key];
  for (const k of Object.keys(SCENES)) el(`tab-${k}`).classList.toggle("on", k === key);
  const badge = el("sceneBadge");
  badge.textContent = live.sc.badge;
  badge.className = "badge " + live.sc.badgeClass;
  el("sceneDesc").textContent = live.sc.desc;
  el("stats").innerHTML = live.sc.stats.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");

  const { min, max, def } = live.sc.lr;
  const lrEl = el("lr");
  lrEl.min = Math.log10(min); lrEl.max = Math.log10(max); lrEl.step = 0.01;
  lrEl.value = Math.log10(def);
  el("lrVal").textContent = def.toPrecision(3);

  const tick = el("lrTick"), note = el("thresholdNote");
  if (live.sc.threshold) {
    const t = (Math.log10(live.sc.threshold) - Number(lrEl.min)) / (Number(lrEl.max) - Number(lrEl.min));
    tick.style.display = "block";
    tick.style.left = `${(1 - t) * 100}%`;   /* RTL: الشريط معكوس */
    tick.textContent = "▲";
    note.style.display = "block";
    note.innerHTML = `العتبة النظرية على هذه التربيعية: <b>2/λmax = ${live.sc.threshold.toFixed(4)}</b> — جرب تجاوزها وشاهد التباعد (مبرهنة في لوحة البرهان).`;
  } else {
    tick.style.display = "none";
    note.style.display = "block";
    note.textContent = "لا عتبة مغلقة هنا: الانحناء يتغير من نقطة لاخرى (الدالة غير تربيعية) — عتبة 2/λmax تخص التربيعيات كسطح هابل.";
  }

  buildSurface(live.sc);
  makeOpts(live.sc);
  live.running = false;
  el("runBtn").textContent = "تشغيل";
}

/* ---------- احداث ---------- */
function currentLr() { return Math.pow(10, Number(el("lr").value)); }
el("lr").addEventListener("input", () => {
  const lr = currentLr();
  el("lrVal").textContent = lr.toPrecision(3);
  for (const key of Object.keys(live.opts)) live.opts[key].o.lr = lr;
});
el("alpha").addEventListener("input", (e) => {
  live.alpha = Number(e.target.value);
  el("alphaVal").textContent = live.alpha.toFixed(2);
  live.opts.momentum.o.alpha = live.alpha;
});
el("rate").addEventListener("input", (e) => {
  live.rate = Number(e.target.value);
  el("rateVal").textContent = String(live.rate);
});
el("runBtn").addEventListener("click", () => {
  live.running = !live.running;
  el("runBtn").textContent = live.running ? "ايقاف" : "تشغيل";
});
el("stepBtn").addEventListener("click", () => stepAll(1));
el("resetBtn").addEventListener("click", () => resetOpts(live.start[0], live.start[1]));
el("randBtn").addEventListener("click", () => {
  const { x, y } = { x: live.sc.domain.x, y: live.sc.domain.y };
  resetOpts(x[0] + Math.random() * (x[1] - x[0]), y[0] + Math.random() * (y[1] - y[0]));
});
el("contourChk").addEventListener("change", (e) => { live.contours.visible = e.target.checked; });
el("wireChk").addEventListener("change", (e) => { live.wire.visible = e.target.checked; });
el("orbitChk").addEventListener("change", (e) => { controls.autoRotate = e.target.checked; });
for (const key of ["gd", "momentum", "adam"]) {
  el(`chip-${key}`).addEventListener("click", () => {
    const chip = el(`chip-${key}`);
    chip.classList.toggle("off");
    const L = live.opts[key];
    L.enabled = !chip.classList.contains("off");
    placeBall(L);
    updateReadout(); updateArrow(); drawInset();
  });
}
for (const key of Object.keys(SCENES)) {
  el(`tab-${key}`).addEventListener("click", () => switchScene(key));
}

/* نقر على السطح = نقطة بداية جديدة (يفرق عن سحب المدار بمسافة وزمن) */
const ray = new THREE.Raycaster();
let downAt = null;
canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
canvas.addEventListener("pointerup", (e) => {
  if (!downAt) return;
  const [dx, dy, t0] = downAt;
  downAt = null;
  if (Math.hypot(e.clientX - dx, e.clientY - dy) > 6 || performance.now() - t0 > 450) return;
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(live.mesh, false)[0];
  if (!hit) return;
  const [x, y] = live.toParam(hit.point.x, hit.point.z);
  resetOpts(x, y);
});

/* ---------- الاقلاع ---------- */
let last = 0;
function animate(t) {
  const dt = Math.min(0.1, (t - last) / 1000); last = t;
  if (live.running) {
    live.acc += dt * live.rate;
    const n = Math.floor(live.acc);
    if (n > 0) { live.acc -= n; stepAll(Math.min(n, 40)); }
  }
  controls.update();
  renderer.render(scene3, camera);
  requestAnimationFrame(animate);
}

try {
  runProofs();
  switchScene("hubble");
  state.ready = true;
  el("loading").classList.add("hide");
  requestAnimationFrame(animate);
} catch (err) {
  showFatal(err);
}
