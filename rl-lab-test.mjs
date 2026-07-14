// اختبار صحة رياضيات مختبر التعلم المعزز (Q-Learning + تكرار القيمة) — مستخرجة من الاطلس المبني، مبرهنة ضد حساب يدوي
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);

const html = readFileSync(new URL("./ai-how-ai-works.html", import.meta.url), "utf8");
const start = html.indexOf("/* ===== RL LAB MATH:");
const end = html.indexOf("/*__LAB_DOM__*/", start);
if (start < 0 || end < 0) throw new Error("RL LAB MATH markers not found");
const code = html.slice(start, end) +
  "\nmodule.exports = { RL_MAP, RL_GAMMA, rlMulberry32, rlParse, rlIdx, rlStates, rlIsGoal, rlIsPit, rlStep, rlValueIteration, rlQStar, rlGreedy, rlRollout, rlNewQ, rlQLearn, rlTinyVI };\n";
writeFileSync(new URL("./rl-lab-extracted.cjs", import.meta.url), code);
const M = require2("./rl-lab-extracted.cjs");

let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? "PASS" : "FAIL") + " | " + name + (detail ? " | " + detail : ""));
  if (!ok) failures++;
};

const g = M.rlParse(M.RL_MAP);
const vi = M.rlValueIteration(g, M.RL_GAMMA, 1e-12, 1000);
const Qstar = M.rlQStar(g, vi.V, M.RL_GAMMA);
const S = g.start;

/* 1) عملية ماركوف صغيرة محلولة يدويا: V* = [8, 10, 0] بالضبط */
{
  const v = M.rlTinyVI(0.9, 1e-12);
  check("tiny-MDP hand-check V*==[8,10,0]",
    Math.abs(v[0] - 8) < 1e-9 && Math.abs(v[1] - 10) < 1e-9 && Math.abs(v[2] - 0) < 1e-9,
    "V=[" + v[0].toFixed(3) + "," + v[1].toFixed(3) + "," + v[2].toFixed(3) + "]");
}

/* 2) تكرار القيمة يحقق معادلة بلمان للامثلية (بقية صفر)؛ مراسي V*(S)=3.122، V*(0,2)=10، V*(1,2)=8 */
{
  let res = 0;
  for (const { x, y } of M.rlStates(g)) {
    let best = -Infinity;
    for (let a = 0; a < 4; a++) { const { nx, ny, r } = M.rlStep(g, x, y, a); best = Math.max(best, r + M.RL_GAMMA * vi.V[ny][nx]); }
    res = Math.max(res, Math.abs(best - vi.V[y][x]));
  }
  const anchors = Math.abs(vi.V[S.y][S.x] - 3.122) < 1e-9 && Math.abs(vi.V[0][2] - 10) < 1e-9 && Math.abs(vi.V[1][2] - 8) < 1e-9;
  check("value-iteration Bellman-optimal (residual~0, anchors exact)", res < 1e-9 && anchors,
    "residual=" + res.toExponential(1) + " V*(S)=" + vi.V[S.y][S.x].toFixed(3));
}

/* 3) الرايةFLAG: Q-Learning ببذرة 12345 وبدايات استكشافية تطابق Q* الى دقة الآلة في هذا المثال */
{
  const Q = M.rlNewQ(g);
  M.rlQLearn(g, Q, { alpha: 0.5, gamma: 0.9, epsilon: 0.3, episodes: 5000, maxSteps: 100 }, M.rlMulberry32(12345));
  let maxDiff = 0;
  for (const { x, y } of M.rlStates(g)) { const k = M.rlIdx(g, x, y); for (let a = 0; a < 4; a++) maxDiff = Math.max(maxDiff, Math.abs(Q[k][a] - Qstar[k][a])); }
  check("LEARNING==PLANNING: max|Q_learned - Q*| < 1e-9", maxDiff < 1e-9, "maxDiff=" + maxDiff.toExponential(2));
}

/* 4) السياسة الجشعة المثلى: المسار من S يصل الهدف في 5 خطوات بالضبط (اقصر مسار آمن، بلا حفرة) */
{
  const roll = M.rlRollout(g, Qstar, 100);
  check("greedy-optimal: reaches goal in exactly 5 steps", roll.reached === "goal" && roll.steps === 5,
    "reached=" + roll.reached + " steps=" + roll.steps);
}

/* 5) الوكيل تعلم ان يخشى الحفرة: عند الخلية المجاورة للحفرة، فعل الغطس سالب بشدة والافضل يتجنبه */
{
  // (1,2) in (x,y) = row1 col2 (المجاور الايسر للحفرة (1,3))؛ الغطس يمينا الى الحفرة
  const k = M.rlIdx(g, 2, 1);
  const goRight = Qstar[k][1], best = Math.max(Qstar[k][0], Qstar[k][1], Qstar[k][2], Qstar[k][3]);
  check("agent fears pit: Q*[near-pit, into-pit]=-10, greedy avoids", Math.abs(goRight - (-10)) < 1e-9 && best === Qstar[k][0],
    "Q[into-pit]=" + goRight.toFixed(1) + " best-action=" + ["U", "R", "D", "L"][M.rlGreedy(Qstar[k])]);
}

/* 6) التعلم ضروري + الحتمية: وكيل غير مدرب (Q=0) يدور بلا وصول؛ وتشغيلان بنفس البذرة يعطيان Q متطابقا */
{
  const untrained = M.rlNewQ(g);
  const roll0 = M.rlRollout(g, untrained, 100);
  const Qa = M.rlNewQ(g), Qb = M.rlNewQ(g);
  M.rlQLearn(g, Qa, { alpha: 0.5, gamma: 0.9, epsilon: 0.3, episodes: 300, maxSteps: 100 }, M.rlMulberry32(777));
  M.rlQLearn(g, Qb, { alpha: 0.5, gamma: 0.9, epsilon: 0.3, episodes: 300, maxSteps: 100 }, M.rlMulberry32(777));
  let diff = 0; for (const { x, y } of M.rlStates(g)) { const k = M.rlIdx(g, x, y); for (let a = 0; a < 4; a++) diff = Math.max(diff, Math.abs(Qa[k][a] - Qb[k][a])); }
  check("learning-necessary (untrained loops) + determinism (same seed identical)",
    roll0.reached !== "goal" && diff === 0, "untrained=" + roll0.reached + " seedDiff=" + diff);
}

if (failures) { console.log("\n" + failures + " FAILURES"); process.exit(1); }
console.log("\nALL RL LAB TESTS PASSED");
