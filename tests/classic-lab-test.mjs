// اختبار صحة رياضيات مختبر الذكاء الكلاسيكي (بحث A*) — مستخرجة من الاطلس المبني نفسه، مبرهنة ضد حساب يدوي
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);

const html = readFileSync(new URL("../pages/ai-how-ai-works.html", import.meta.url), "utf8");
const start = html.indexOf("/* ===== CLASSIC LAB MATH:");
const end = html.indexOf("/*__LAB_DOM__*/", start);
if (start < 0 || end < 0) throw new Error("CLASSIC LAB MATH markers not found");
const code = html.slice(start, end) +
  "\nmodule.exports = { CS_SWAMP, CS_WALL, CS_MAP, CS_DIRS, csParse, csIndex, csInBounds, csIsWall, csManhattan, csSearch, csTrueCost };\n";
writeFileSync(new URL("./classic-lab-extracted.cjs", import.meta.url), code);
const M = require2("./classic-lab-extracted.cjs");

let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? "PASS" : "FAIL") + " | " + name + (detail ? " | " + detail : ""));
  if (!ok) failures++;
};

const g = M.csParse(M.CS_MAP);
const bfs = M.csSearch(g, "bfs", false);
const ucs = M.csSearch(g, "ucs", false);
const greedy = M.csSearch(g, "greedy", true);
const astar = M.csSearch(g, "astar", true);
const tc = M.csTrueCost(g);
const OPT = tc[g.start.y][g.start.x];

/* 1) الامثلية: A* باسترشاد مقبول يعيد مسارا امثل التكلفة == UCS == التكلفة الحقيقية == 16 */
check("astar-optimal (cost==UCS==trueCost==16)",
  astar.cost === 16 && astar.cost === ucs.cost && astar.cost === OPT,
  "astar=" + astar.cost + " ucs=" + ucs.cost + " trueCost(S)=" + OPT);

/* 2) القبول: h(n)=مانهاتن <= trueCost(n) لكل خلية غير جدارية؛ اقصى ارتخاء=4 عند البداية */
{
  let admissible = true, maxSlack = -Infinity, worst = null;
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) {
    if (M.csIsWall(g, x, y)) continue;
    const h = M.csManhattan({ x, y }, g.goal), t = tc[y][x];
    if (isFinite(t)) { if (h > t) admissible = false; if (t - h > maxSlack) { maxSlack = t - h; worst = { x, y, h, t }; } }
  }
  check("admissible (h<=trueCost for all n; maxSlack=4)", admissible && maxSlack === 4,
    "maxSlack=" + maxSlack + " at (" + worst.x + "," + worst.y + ")");
}

/* 3) الاتساق (الرتابة): h(n) <= c(n,n') + h(n') لكل حافة — يضمن ان A* لا تعيد فتح اي خلية */
{
  let consistent = true;
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) {
    if (M.csIsWall(g, x, y)) continue;
    const h = M.csManhattan({ x, y }, g.goal);
    for (const [dx, dy] of M.CS_DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!M.csInBounds(g, nx, ny) || M.csIsWall(g, nx, ny)) continue;
      if (h > g.cost[ny][nx] + M.csManhattan({ x: nx, y: ny }, g.goal)) consistent = false;
    }
  }
  check("consistent (monotone) heuristic", consistent);
}

/* 4) الجشع دون امثلية: افضل-اولا الجشع يعبر المستنقع فتكلفته 21 > 16 المثلى */
check("greedy-suboptimal (cost==21 > 16)", greedy.cost === 21 && greedy.cost > OPT,
  "greedy=" + greedy.cost + " optimal=" + OPT);

/* 5) BFS يقلل الخطوات لا التكلفة: اقل خطوات=12 لكنها تخترق المستنقع فالتكلفة=21>16 */
check("bfs-fewest-steps-not-least-cost (steps==12, cost==21)",
  bfs.steps === 12 && bfs.steps < ucs.steps && bfs.cost === 21 && bfs.cost > OPT,
  "bfsSteps=" + bfs.steps + " ucsSteps=" + ucs.steps + " bfsCost=" + bfs.cost);

/* 6) هيمنة الاسترشاد المتسق: A* يوسع مجموعة جزئية من عقد UCS ⇒ 43 < 111 */
check("astar-dominates-ucs (expanded 43 < 111)",
  astar.expanded === 43 && ucs.expanded === 111 && astar.expanded < ucs.expanded,
  "astarExp=" + astar.expanded + " ucsExp=" + ucs.expanded + " ratio=" + (ucs.expanded / astar.expanded).toFixed(2) + "x");

/* 7) اطفاء الاسترشاد يحول A* الى UCS بالضبط (h≡0): نفس الكلفة ونفس عدد التوسيعات */
{
  const astarNoH = M.csSearch(g, "astar", false);
  check("astar(h=0) identical to UCS (cost & expanded)",
    astarNoH.cost === ucs.cost && astarNoH.expanded === ucs.expanded,
    "cost=" + astarNoH.cost + " expanded=" + astarNoH.expanded);
}

/* 8) اكتمال: كل الخوارزميات تصل الهدف، والمسار الامثل ابعد خطوات من BFS (16 > 12) */
check("all-complete (paths found; optimal has more steps than BFS)",
  bfs.path.length > 0 && ucs.path.length > 0 && greedy.path.length > 0 && astar.path.length > 0 && astar.steps === 16 && astar.steps > bfs.steps,
  "astarSteps=" + astar.steps + " bfsSteps=" + bfs.steps);

if (failures) { console.log("\n" + failures + " FAILURES"); process.exit(1); }
console.log("\nALL CLASSIC (A*) LAB TESTS PASSED");
