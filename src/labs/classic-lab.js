/* ==================== مختبر الذكاء الكلاسيكي — بحث حي في فضاء الحالات ==================== */
/* ===== CLASSIC LAB MATH: بحث في فضاء الحالات بلا DOM (تختبر آليا قبل النشر) ===== */
/* البحث على شبكة رباعية الاتصال. تكلفة الانتقال الى خلية = تكلفة تضاريسها (1 عادي، 10 مستنقع، جدار = لا مرور). */

const CS_SWAMP = 10;
const CS_WALL = 0;               /* 0 = جدار (لا يدخل) */
/* الشبكة الثابتة (حتمية، لا Math.random): 13 عرضا × 9 ارتفاعا.
   S بداية، G هدف، # جدار، ~ مستنقع (تكلفة 10)، . عادي (تكلفة 1).
   حاجز عند العمود x=6: قبعتا جدار اعلى/اسفل، ممر مستنقع اوسط (صفوف 3-5)، فتحتان مفتوحتان (صفوف 2 و6). */
const CS_MAP = [
  ". . . . . . # . . . . . .",
  ". . . . . . # . . . . . .",
  ". . . . . . . . . . . . .",
  ". . . . . . ~ . . . . . .",
  "S . . . . . ~ . . . . . G",
  ". . . . . . ~ . . . . . .",
  ". . . . . . . . . . . . .",
  ". . . . . . # . . . . . .",
  ". . . . . . # . . . . . ."
];

/* اتجاهات الجوار بترتيب ثابت (شمال، شرق، جنوب، غرب) — يثبت السلوك بت-ببت بين Node والمتصفح */
const CS_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/* يحول الخريطة النصية الى بنية: {W,H,cost:[y][x], start, goal} */
function csParse(mapRows) {
  const H = mapRows.length;
  const cells = mapRows.map(r => r.trim().split(/\s+/));
  const W = cells[0].length;
  let start = null, goal = null;
  const cost = cells.map((row, y) => row.map((c, x) => {
    if (c === "S") { start = { x, y }; return 1; }
    if (c === "G") { goal = { x, y }; return 1; }
    if (c === "#") return CS_WALL;
    if (c === "~") return CS_SWAMP;
    return 1;
  }));
  return { W, H, cost, start, goal };
}

const csIndex = (g, x, y) => y * g.W + x;                 /* دليل صف-رئيسي: يكسر التعادل حتميا */
const csInBounds = (g, x, y) => x >= 0 && x < g.W && y >= 0 && y < g.H;
const csIsWall = (g, x, y) => g.cost[y][x] === CS_WALL;
const csManhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/* البحث العام. mode: 'bfs' (اتساعا) | 'ucs' (تكلفة موحدة/دايكسترا) | 'greedy' (جشع افضل-اولا) | 'astar'.
   useH: تشغيل الاستدلال (لـ astar/greedy). دالة الاولوية:
     bfs   → ترتيب الادخال (طابور FIFO)
     ucs   → g (التكلفة المتراكمة)
     greedy→ h (مانهاتن الى الهدف)   [useH=false ⇒ يتحول الى ucs]
     astar → f = g + h                [useH=false ⇒ f=g ⇒ يتحول الى ucs بالضبط]
   بحث-الرسم بمجموعة مغلقة، واختبار-الهدف-عند-الاخراج (يضمن الامثلية لـ ucs/astar).
   كسر التعادل عند تساوي الاولوية: اصغر دليل صف-رئيسي. */
function csSearch(g, mode, useH) {
  const INF = Infinity;
  const gScore = Array.from({ length: g.H }, () => Array(g.W).fill(INF));
  const closed = Array.from({ length: g.H }, () => Array(g.W).fill(false));
  const came = {};
  gScore[g.start.y][g.start.x] = 0;
  let seq = 0;
  const heuristic = (x, y) => (useH ? csManhattan({ x, y }, g.goal) : 0);
  const priority = (n) => {
    if (mode === "bfs") return n.seq;
    if (mode === "ucs") return gScore[n.y][n.x];
    if (mode === "greedy") return heuristic(n.x, n.y);
    return gScore[n.y][n.x] + heuristic(n.x, n.y);   /* astar: f = g + h */
  };
  const frontier = [{ x: g.start.x, y: g.start.y, seq: seq++ }];
  let expanded = 0;
  const expandedOrder = [];
  while (frontier.length) {
    /* اخرج اصغر اولوية، ثم اصغر دليل صف-رئيسي (مسح خطي حتمي — الشبكة صغيرة) */
    let bi = 0;
    for (let i = 1; i < frontier.length; i++) {
      const a = frontier[i], b = frontier[bi];
      const pa = priority(a), pb = priority(b);
      if (pa < pb || (pa === pb && csIndex(g, a.x, a.y) < csIndex(g, b.x, b.y))) bi = i;
    }
    const cur = frontier.splice(bi, 1)[0];
    if (closed[cur.y][cur.x]) continue;
    closed[cur.y][cur.x] = true;
    expanded++;
    expandedOrder.push(csIndex(g, cur.x, cur.y));
    if (cur.x === g.goal.x && cur.y === g.goal.y) {
      const path = [];
      let c = csIndex(g, cur.x, cur.y);
      while (c !== undefined) { const cx = c % g.W, cy = (c - cx) / g.W; path.push([cx, cy]); c = came[c]; }
      path.reverse();
      return { cost: gScore[g.goal.y][g.goal.x], steps: path.length - 1, expanded, path, expandedOrder };
    }
    for (const [dx, dy] of CS_DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!csInBounds(g, nx, ny) || csIsWall(g, nx, ny) || closed[ny][nx]) continue;
      const tentative = gScore[cur.y][cur.x] + g.cost[ny][nx];   /* تكلفة الحافة = تكلفة الخلية المدخلة */
      if (mode === "bfs") {
        /* BFS يقيس الخطوات لا التكلفة: اكتشاف-مرة-واحدة (FIFO نقي) يضمن اقل عدد حواف لاي شبكة */
        if (gScore[ny][nx] === INF) {
          gScore[ny][nx] = tentative;
          came[csIndex(g, nx, ny)] = csIndex(g, cur.x, cur.y);
          frontier.push({ x: nx, y: ny, seq: seq++ });
        }
      } else if (tentative < gScore[ny][nx]) {
        gScore[ny][nx] = tentative;
        came[csIndex(g, nx, ny)] = csIndex(g, cur.x, cur.y);
        frontier.push({ x: nx, y: ny, seq: seq++ });
      }
    }
  }
  return { cost: Infinity, steps: -1, expanded, path: [], expandedOrder };
}

/* حقل التكلفة الحقيقية: دايكسترا عكسي من الهدف ⇒ trueCost(n) = التكلفة المثلى من n الى الهدف.
   يستعمل للبرهنة ان مانهاتن مقبول (لا يبالغ ابدا): h(n) <= trueCost(n) لكل n. */
function csTrueCost(g) {
  const dist = Array.from({ length: g.H }, () => Array(g.W).fill(Infinity));
  dist[g.goal.y][g.goal.x] = 0;
  const pq = [{ x: g.goal.x, y: g.goal.y, d: 0 }];
  while (pq.length) {
    let bi = 0;
    for (let i = 1; i < pq.length; i++) {
      if (pq[i].d < pq[bi].d || (pq[i].d === pq[bi].d && csIndex(g, pq[i].x, pq[i].y) < csIndex(g, pq[bi].x, pq[bi].y))) bi = i;
    }
    const c = pq.splice(bi, 1)[0];
    if (c.d > dist[c.y][c.x]) continue;
    for (const [dx, dy] of CS_DIRS) {
      const nx = c.x + dx, ny = c.y + dy;
      if (!csInBounds(g, nx, ny) || csIsWall(g, nx, ny)) continue;
      const nd = c.d + g.cost[c.y][c.x];   /* الدخول الى الخلية الحالية من الجار يكلف تكلفة الحالية */
      if (nd < dist[ny][nx]) { dist[ny][nx] = nd; pq.push({ x: nx, y: ny, d: nd }); }
    }
  }
  return dist;
}
/*__LAB_DOM__*/

const LAB_MAP = {
  search: 0, "state-space": 0, "combinatorial-explosion": 0, uninformed: 0, bfs: 0, dfs: 0, ucs: 0, ids: 0,
  informed: 0, heuristic: 0, greedy: 0, astar: 0, admissibility: 0, consistency: 0,
};
const LAB_BTN_TEXT = ["🔬 جرب البحث حيا: قارن BFS و UCS و الجشع و A*"];
let labOpen = false;
const labEl = document.getElementById("lab");

let csGrid = csParse(CS_MAP);
const CS_CELL = 30;
const csCv = document.getElementById("csCanvas");
const csCtx = csCv.getContext("2d");
(function () {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  csCv.width = csGrid.W * CS_CELL * d; csCv.height = csGrid.H * CS_CELL * d;
  csCv.style.width = (csGrid.W * CS_CELL) + "px"; csCv.style.height = (csGrid.H * CS_CELL) + "px";
  csCtx.setTransform(d, 0, 0, d, 0, 0);
})();

const CS_OBSERVE = {
  bfs: "البحث بالعرض يجد اقل عدد خطوات (12) لكنه لا يبالي بالتكلفة، فيعبر المستنقع وتصير كلفته 21 — يقلل الحواف لا الكلفة. لهذا تلزم دايكسترا للشبكات الموزونة.",
  ucs: "الكلفة الموحدة (دايكسترا) تجد الحل الامثل (16) لكنها تغمر الخريطة كلها: 111 عقدة موسعة. صحيح لكنه مبذر.",
  greedy: "الجشع يلاحق الاسترشاد وحده فيطعن مباشرة نحو الهدف عبر المستنقع: 13 عقدة فقط (سريع) لكن كلفته 21 — سريع وخاطئ.",
  astar: "A* = الكلفة + الاسترشاد (f=g+h): يجد نفس الحل الامثل (16) لكن بـ43 عقدة فقط بدل 111. اطفئ الاسترشاد فيصير دايكسترا بالضبط. صحيح وفعال معا.",
};

function csAlgo() { return document.getElementById("csAlgo").value; }
function csUseH() { return document.getElementById("csHeuristic").checked; }

function csRender() {
  const algo = csAlgo();
  const useH = (algo === "astar" || algo === "greedy") ? csUseH() : false;
  const res = csSearch(csGrid, algo, useH);
  const ucs = csSearch(csGrid, "ucs", false);
  const c = csCtx, W = csGrid.W, H = csGrid.H;
  c.clearRect(0, 0, W * CS_CELL, H * CS_CELL);
  const expRank = {}; res.expandedOrder.forEach((idx, i) => { expRank[idx] = i; });
  const pathSet = new Set(res.path.map(([x, y]) => y * W + x));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const idx = y * W + x, cost = csGrid.cost[y][x];
    c.fillStyle = cost === CS_WALL ? "#05070d" : (cost === CS_SWAMP ? "#3a2f1a" : "#0f1524");
    c.fillRect(x * CS_CELL, y * CS_CELL, CS_CELL - 1, CS_CELL - 1);
    if ((idx in expRank) && cost !== CS_WALL) {
      const tt = expRank[idx] / Math.max(1, res.expanded);
      c.fillStyle = "rgba(79,200,248," + (0.10 + 0.34 * (1 - tt)).toFixed(3) + ")";
      c.fillRect(x * CS_CELL, y * CS_CELL, CS_CELL - 1, CS_CELL - 1);
    }
    if (pathSet.has(idx)) { c.fillStyle = "rgba(124,227,139,0.80)"; c.fillRect(x * CS_CELL + 4, y * CS_CELL + 4, CS_CELL - 9, CS_CELL - 9); }
    if (cost === CS_SWAMP) { c.fillStyle = "#c9a24a"; c.font = "10px 'Segoe UI',sans-serif"; c.textAlign = "center"; c.fillText("10", x * CS_CELL + CS_CELL / 2, y * CS_CELL + CS_CELL / 2 + 3); }
  }
  const mark = (p, col, ch) => {
    c.fillStyle = col; c.beginPath(); c.arc(p.x * CS_CELL + CS_CELL / 2, p.y * CS_CELL + CS_CELL / 2, CS_CELL / 2 - 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#05070d"; c.font = "bold 13px 'Segoe UI',sans-serif"; c.textAlign = "center"; c.fillText(ch, p.x * CS_CELL + CS_CELL / 2, p.y * CS_CELL + CS_CELL / 2 + 4);
  };
  mark(csGrid.start, "#7ce38b", "S"); mark(csGrid.goal, "#ff8c5a", "G");
  const names = { bfs: "العرض BFS", ucs: "الكلفة الموحدة UCS", greedy: "الجشع Greedy", astar: "A*" };
  const opt = (res.cost === ucs.cost) ? "<span style='color:#7ce38b'>امثل ✓</span>" : "<span style='color:#ffb259'>غير امثل ✗ (الامثل " + ucs.cost + ")</span>";
  document.getElementById("csStats").innerHTML =
    "<b>" + names[algo] + "</b> &nbsp; الكلفة <b>" + res.cost + "</b> " + opt +
    " &nbsp;·&nbsp; خطوات <b>" + res.steps + "</b> &nbsp;·&nbsp; عقد موسعة <b>" + res.expanded + "</b>";
  document.getElementById("csObserve").textContent = CS_OBSERVE[algo] || "";
  const hRow = document.getElementById("csHeuristicRow");
  if (hRow) hRow.style.display = (algo === "astar" || algo === "greedy") ? "flex" : "none";
}

/* تحرير التضاريس بالنقر: عادي ← جدار ← مستنقع ← عادي (عدا البداية والهدف) */
csCv.addEventListener("pointerdown", (e) => {
  const rect = csCv.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / CS_CELL), y = Math.floor((e.clientY - rect.top) / CS_CELL);
  if (!csInBounds(csGrid, x, y)) return;
  if ((x === csGrid.start.x && y === csGrid.start.y) || (x === csGrid.goal.x && y === csGrid.goal.y)) return;
  const cur = csGrid.cost[y][x];
  csGrid.cost[y][x] = cur === 1 ? CS_WALL : (cur === CS_WALL ? CS_SWAMP : 1);
  csRender();
});

document.getElementById("csAlgo").addEventListener("change", csRender);
document.getElementById("csHeuristic").addEventListener("change", csRender);
document.getElementById("csReset").addEventListener("click", () => { csGrid = csParse(CS_MAP); csRender(); });

function openLab(mode) { closeCard(); labOpen = true; labEl.classList.add("open"); csRender(); }
function closeLab() { labOpen = false; labEl.classList.remove("open"); }
document.getElementById("labClose").addEventListener("click", closeLab);

csRender();
