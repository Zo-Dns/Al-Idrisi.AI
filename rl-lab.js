/* ==================== مختبر التعلم المعزز — Q-Learning حية على شبكة ==================== */
/* ===== RL LAB MATH: Q-Learning الجدولية + عراف تكرار القيمة (بلا DOM؛ يختبر آليا) ===== */
/* الوكيل يتعلم من التجربة باستخدام Q-Learning، ثم تقارن قيمه بما يحسبه التخطيط (تكرار القيمة). */

function rlMulberry32(seed) {                     /* مولد مشترك: Node والمتصفح متطابقان */
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* شبكة ثابتة حتمية (الصف 0 اعلى). S بداية، G هدف(+10 نهائي)، P حفرة(-10 نهائي)، # جدار */
const RL_MAP = ["...G", ".#.P", "S..."];
const RL_STEP = -1, RL_GOAL = 10, RL_PIT = -10, RL_GAMMA = 0.9;
const RL_ACTS = [[-1, 0], [0, 1], [1, 0], [0, -1]];   /* اعلى، يمين، اسفل، يسار — ترتيب ثابت لكسر التعادل */

function rlParse(m) {
  const H = m.length, W = m[0].length, cell = []; let start = null;
  for (let y = 0; y < H; y++) { cell.push([]); for (let x = 0; x < W; x++) {
    const c = m[y][x]; cell[y].push(c); if (c === "S") start = { x, y }; } }
  return { W, H, cell, start };
}
const rlIdx = (g, x, y) => y * g.W + x;
const rlInB = (g, x, y) => x >= 0 && x < g.W && y >= 0 && y < g.H;
const rlIsWall = (g, x, y) => g.cell[y][x] === "#";
const rlIsGoal = (g, x, y) => g.cell[y][x] === "G";
const rlIsPit = (g, x, y) => g.cell[y][x] === "P";
const rlIsTerm = (g, x, y) => rlIsGoal(g, x, y) || rlIsPit(g, x, y);

/* خطوة حتمية: الاصطدام بجدار/حافة => البقاء مكانك، بمكافأة RL_STEP */
function rlStep(g, x, y, a) {
  const dy = RL_ACTS[a][0], dx = RL_ACTS[a][1];
  let nx = x + dx, ny = y + dy;
  if (!rlInB(g, nx, ny) || rlIsWall(g, nx, ny)) { nx = x; ny = y; }
  let r = RL_STEP;
  if (rlIsGoal(g, nx, ny)) r = RL_GOAL; else if (rlIsPit(g, nx, ny)) r = RL_PIT;
  return { nx, ny, r, done: rlIsTerm(g, nx, ny) };
}
function rlStates(g) {                             /* الخلايا غير النهائية وغير الجدارية (لها افعال) */
  const s = [];
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++)
    if (!rlIsWall(g, x, y) && !rlIsTerm(g, x, y)) s.push({ x, y });
  return s;
}

/* ---- تكرار القيمة: V*, Q* الدقيقتان على النموذج المعلوم (العراف المرجعي) ---- */
function rlValueIteration(g, gamma, tol, maxIter) {
  const V = Array.from({ length: g.H }, () => Array(g.W).fill(0)), S = rlStates(g);
  let iter = 0, delta = Infinity;
  while (delta > tol && iter < maxIter) {
    delta = 0;
    for (const { x, y } of S) {
      let best = -Infinity;
      for (let a = 0; a < 4; a++) { const { nx, ny, r } = rlStep(g, x, y, a); best = Math.max(best, r + gamma * V[ny][nx]); }
      delta = Math.max(delta, Math.abs(best - V[y][x])); V[y][x] = best;
    }
    iter++;
  }
  return { V, iter };
}
function rlQStar(g, V, gamma) {
  const Q = {};
  for (const { x, y } of rlStates(g)) { const k = rlIdx(g, x, y); Q[k] = [0, 0, 0, 0];
    for (let a = 0; a < 4; a++) { const { nx, ny, r } = rlStep(g, x, y, a); Q[k][a] = r + gamma * V[ny][nx]; } }
  return Q;
}
function rlGreedy(q) { let b = 0; for (let a = 1; a < 4; a++) if (q[a] > q[b]) b = a; return b; }

function rlRollout(g, Q, maxSteps) {               /* المسار الجشع من S: خطوات للهدف او دوران/حفرة */
  let { x, y } = g.start, steps = 0; const seen = new Set();
  while (steps < maxSteps) {
    const k = rlIdx(g, x, y); if (seen.has(k)) return { steps: -1, reached: "loop" }; seen.add(k);
    const { nx, ny } = rlStep(g, x, y, rlGreedy(Q[k])); x = nx; y = ny; steps++;
    if (rlIsGoal(g, x, y)) return { steps, reached: "goal" };
    if (rlIsPit(g, x, y)) return { steps, reached: "pit" };
  }
  return { steps: -1, reached: "timeout" };
}

/* ---- Q-Learning: ببذرة، ببدايات استكشافية، بابسيلون-الجشعة (تحكم TD خارج السياسة) ---- */
function rlNewQ(g) { const Q = {}; for (const { x, y } of rlStates(g)) Q[rlIdx(g, x, y)] = [0, 0, 0, 0]; return Q; }
function rlQLearn(g, Q, cfg, rng) {
  const { alpha, gamma, epsilon, episodes, maxSteps } = cfg, S = rlStates(g);
  for (let ep = 0; ep < episodes; ep++) {
    const s0 = S[Math.floor(rng() * S.length)];    /* بداية استكشافية => تغطية كل (حالة، فعل) */
    let x = s0.x, y = s0.y, step = 0;
    while (step < maxSteps) {
      const k = rlIdx(g, x, y);
      const a = (rng() < epsilon) ? Math.floor(rng() * 4) : rlGreedy(Q[k]);
      const { nx, ny, r, done } = rlStep(g, x, y, a), nk = rlIdx(g, nx, ny);
      const future = done ? 0 : Math.max(Q[nk][0], Q[nk][1], Q[nk][2], Q[nk][3]);
      Q[k][a] += alpha * (r + gamma * future - Q[k][a]);   /* قاعدة تحديث Q-Learning */
      x = nx; y = ny; step++; if (done) break;
    }
  }
  return Q;
}

/* ---- عملية ماركوف صغيرة محلولة يدويا: V* = [8,10,0] بالضبط (فحص مستقل لحلال تكرار القيمة) ---- */
function rlTinyVI(gamma, tol) {
  const T = { 0: { R: 1, L: 0 }, 1: { R: 2, L: 0 } }, rew = (s2) => (s2 === 2 ? 10 : -1);
  let V = { 0: 0, 1: 0, 2: 0 }, delta = Infinity, iter = 0;
  while (delta > tol && iter < 1000) { delta = 0;
    for (const s of [0, 1]) { let best = -Infinity;
      for (const a of ["R", "L"]) best = Math.max(best, rew(T[s][a]) + gamma * V[T[s][a]]);
      delta = Math.max(delta, Math.abs(best - V[s])); V[s] = best; } iter++; }
  return V;
}
/*__LAB_DOM__*/

const LAB_MAP = {
  "rl-problem": 0, mdp: 0, "value-v": 0, "action-q": 0, "bellman-optimality": 0, "bellman-expectation": 0,
  dp: 0, "policy-iteration": 0, "value-iteration": 0, "model-free": 0, "td-learning": 0, "q-learning": 0, sarsa: 0,
};
const LAB_BTN_TEXT = ["🔬 جرب التعلم المعزز حيا: وكيل يستخدم Q-Learning ونقارن نتائجه بالتخطيط"];
let labOpen = false;
const labEl = document.getElementById("lab");

const rlGrid = rlParse(RL_MAP);
const RL_CELL = 74;
const rlVi = rlValueIteration(rlGrid, RL_GAMMA, 1e-12, 1000);
const rlQstar = rlQStar(rlGrid, rlVi.V, RL_GAMMA);
let rlQ = rlNewQ(rlGrid);
let rlEpisodes = 0;
let rlRng = rlMulberry32(12345);

const rlCv = document.getElementById("rlCanvas");
const rlCtx = rlCv.getContext("2d");
(function () {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  rlCv.width = rlGrid.W * RL_CELL * d; rlCv.height = rlGrid.H * RL_CELL * d;
  rlCv.style.width = (rlGrid.W * RL_CELL) + "px"; rlCv.style.height = (rlGrid.H * RL_CELL) + "px";
  rlCtx.setTransform(d, 0, 0, d, 0, 0);
})();

function rlAlpha() { return parseInt(document.getElementById("rlAlpha").value, 10) / 100; }
function rlGamma() { return parseInt(document.getElementById("rlGamma").value, 10) / 100; }
function rlEps() { return parseInt(document.getElementById("rlEps").value, 10) / 100; }
function rlShowOracle() { return document.getElementById("rlOracle").checked; }

const RL_ARROW = ["↑", "→", "↓", "←"];
function rlHeat(v) {                                 /* تدرج لوني بقيمة الحالة */
  const t = Math.max(0, Math.min(1, (v + 10) / 20));
  const r = Math.round(20 + 40 * (1 - t)), g = Math.round(30 + 160 * t), b = Math.round(50 + 60 * (1 - t));
  return "rgb(" + r + "," + g + "," + b + ")";
}
function rlDraw() {
  const Q = rlShowOracle() ? rlQstar : rlQ;
  const c = rlCtx, W = rlGrid.W, H = rlGrid.H;
  c.clearRect(0, 0, W * RL_CELL, H * RL_CELL);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const cx = x * RL_CELL, cy = y * RL_CELL;
    if (rlIsWall(rlGrid, x, y)) { c.fillStyle = "#05070d"; c.fillRect(cx, cy, RL_CELL - 2, RL_CELL - 2); continue; }
    if (rlIsGoal(rlGrid, x, y)) { c.fillStyle = "#2e7d46"; c.fillRect(cx, cy, RL_CELL - 2, RL_CELL - 2); c.fillStyle = "#c7f5cf"; c.font = "bold 16px 'Segoe UI'"; c.textAlign = "center"; c.fillText("G +10", cx + RL_CELL / 2, cy + RL_CELL / 2 + 5); continue; }
    if (rlIsPit(rlGrid, x, y)) { c.fillStyle = "#7d2e2e"; c.fillRect(cx, cy, RL_CELL - 2, RL_CELL - 2); c.fillStyle = "#ffc9c9"; c.font = "bold 16px 'Segoe UI'"; c.textAlign = "center"; c.fillText("P -10", cx + RL_CELL / 2, cy + RL_CELL / 2 + 5); continue; }
    const k = rlIdx(rlGrid, x, y), v = Math.max(Q[k][0], Q[k][1], Q[k][2], Q[k][3]);
    c.fillStyle = rlHeat(v); c.fillRect(cx, cy, RL_CELL - 2, RL_CELL - 2);
    c.fillStyle = "rgba(255,255,255,0.92)"; c.font = "bold 22px 'Segoe UI'"; c.textAlign = "center";
    c.fillText(RL_ARROW[rlGreedy(Q[k])], cx + RL_CELL / 2, cy + 30);
    c.fillStyle = "rgba(233,238,248,0.75)"; c.font = "11px 'Segoe UI'";
    c.fillText("V=" + v.toFixed(2), cx + RL_CELL / 2, cy + RL_CELL - 10);
    if (x === rlGrid.start.x && y === rlGrid.start.y) { c.strokeStyle = "#7ce38b"; c.lineWidth = 3; c.strokeRect(cx + 2, cy + 2, RL_CELL - 6, RL_CELL - 6); c.fillStyle = "#7ce38b"; c.font = "bold 11px 'Segoe UI'"; c.textAlign = "left"; c.fillText("S", cx + 5, cy + 14); }
  }
  rlStats();
}
function rlStats() {
  let maxDiff = 0;
  for (const { x, y } of rlStates(rlGrid)) { const k = rlIdx(rlGrid, x, y); for (let a = 0; a < 4; a++) maxDiff = Math.max(maxDiff, Math.abs(rlQ[k][a] - rlQstar[k][a])); }
  const roll = rlRollout(rlGrid, rlQ, 100);
  const rollTxt = roll.reached === "goal" ? ("يصل الهدف في " + roll.steps + " خطوات" + (roll.steps === 5 ? " (الامثل)" : "")) : (roll.reached === "loop" ? "يدور بلا وصول (لم يتعلم بعد)" : roll.reached);
  document.getElementById("rlStats").innerHTML =
    "حلقات مدربة <b>" + rlEpisodes + "</b> &nbsp;·&nbsp; المسار الجشع: " + rollTxt +
    " &nbsp;·&nbsp; البعد عن الامثل max|Q-Q*| = <b>" + (maxDiff < 1e-9 ? maxDiff.toExponential(1) : maxDiff.toFixed(4)) + "</b>";
  document.getElementById("rlOracleNote").textContent = rlShowOracle()
    ? "تعرض الآن Q* التي حسبها تكرار القيمة (التخطيط بالنموذج) — الحل المرجعي المثالي."
    : "تعرض الآن Q التي تعلمها الوكيل من التجربة. درب حتى تطابق العراف.";
}
function rlRun(n) {
  const cfg = { alpha: rlAlpha(), gamma: rlGamma(), epsilon: rlEps(), episodes: n, maxSteps: 100 };
  rlQLearn(rlGrid, rlQ, cfg, rlRng);
  rlEpisodes += n; rlDraw();
}
document.getElementById("rlRun").addEventListener("click", () => rlRun(200));
document.getElementById("rlRun5k").addEventListener("click", () => rlRun(5000));
document.getElementById("rlReset").addEventListener("click", () => { rlQ = rlNewQ(rlGrid); rlEpisodes = 0; rlRng = rlMulberry32(12345); rlDraw(); });
document.getElementById("rlOracle").addEventListener("change", rlDraw);
document.getElementById("rlAlpha").addEventListener("input", () => { document.getElementById("rlAlphaVal").textContent = rlAlpha().toFixed(2); });
document.getElementById("rlGamma").addEventListener("input", () => { document.getElementById("rlGammaVal").textContent = rlGamma().toFixed(2); });
document.getElementById("rlEps").addEventListener("input", () => { document.getElementById("rlEpsVal").textContent = rlEps().toFixed(2); });

function openLab(mode) { closeCard(); labOpen = true; labEl.classList.add("open"); rlDraw(); }
function closeLab() { labOpen = false; labEl.classList.remove("open"); }
document.getElementById("labClose").addEventListener("click", closeLab);

document.getElementById("rlAlphaVal").textContent = rlAlpha().toFixed(2);
document.getElementById("rlGammaVal").textContent = rlGamma().toFixed(2);
document.getElementById("rlEpsVal").textContent = rlEps().toFixed(2);
rlDraw();
