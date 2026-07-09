// اختبار صحة خوارزميات مختبر تعلم الآلة — مستخرجة من الاطلس المبني نفسه
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);

const html = readFileSync(new URL("./ai-how-ai-works.html", import.meta.url), "utf8");
const start = html.indexOf("/* ===== ML LAB MATH:");
const end = html.indexOf("/*__LAB_DOM__*/", start);
if (start < 0 || end < 0) throw new Error("ML LAB MATH markers not found");
const code = html.slice(start, end) +
  "\nmodule.exports = { mlMulberry32, mlKNN, mlLogRegTrain, mlLogRegProb, mlGini, mlMajority, mlTreeBuild, mlTreePredict };\n";
writeFileSync(new URL("./ml-lab-extracted.cjs", import.meta.url), code);
const M = require2("./ml-lab-extracted.cjs");

let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? "PASS" : "FAIL") + " | " + name + (detail ? " | " + detail : ""));
  if (!ok) failures++;
};

/* بيانات: فئتان منفصلتان خطيا */
const rng = M.mlMulberry32(3);
const blob = (cx, cy, cls, n) => Array.from({ length: n }, () => ({ x: cx + (rng() - 0.5) * 0.25, y: cy + (rng() - 0.5) * 0.25, cls }));
const linSep = [...blob(0.3, 0.3, 0, 40), ...blob(0.7, 0.7, 1, 40)];
/* XOR: قطرا نفس الفئة */
const xor = [...blob(0.25, 0.25, 0, 25), ...blob(0.75, 0.75, 0, 25), ...blob(0.75, 0.25, 1, 25), ...blob(0.25, 0.75, 1, 25)];

/* 1) k-NN: حساب يدوي — نقطة قرب تجمع A تصنف A */
const pts = [{ x: 0.1, y: 0.1, cls: 0 }, { x: 0.12, y: 0.11, cls: 0 }, { x: 0.9, y: 0.9, cls: 1 }];
const r1 = M.mlKNN(pts, 0.11, 0.1, 3, -1);
check("knn-hand-computed", r1.cls === 0, "cls=" + r1.cls + " (متوقع 0)");

/* 2) k-NN بترك-واحد على فئتين منفصلتين: دقة عالية */
let ok = 0;
for (let i = 0; i < linSep.length; i++) if (M.mlKNN(linSep, linSep[i].x, linSep[i].y, 5, i).cls === linSep[i].cls) ok++;
check("knn-loo-accuracy-linsep", ok / linSep.length >= 0.95, "acc=" + Math.round(ok / linSep.length * 100) + "%");

/* 3) الانحدار اللوجستي يفصل بيانات خطية بدقة عالية */
const w = M.mlLogRegTrain(linSep, 600, 1.2);
let okL = 0;
for (const p of linSep) if ((M.mlLogRegProb(w, p.x, p.y) >= 0.5 ? 1 : 0) === p.cls) okL++;
check("logreg-separates-linear", okL / linSep.length >= 0.95, "acc=" + Math.round(okL / linSep.length * 100) + "%");

/* 4) الانحدار اللوجستي يفشل في XOR (غير خطي) — برهان حد النماذج الخطية */
const wx = M.mlLogRegTrain(xor, 600, 1.2);
let okX = 0;
for (const p of xor) if ((M.mlLogRegProb(wx, p.x, p.y) >= 0.5 ? 1 : 0) === p.cls) okX++;
check("logreg-fails-xor (expected ~50%)", okX / xor.length < 0.7, "acc=" + Math.round(okX / xor.length * 100) + "%");

/* 5) شجرة القرار تنجح في XOR بعمق كاف */
const tree = M.mlTreeBuild(xor, 4);
let okT = 0;
for (const p of xor) if (M.mlTreePredict(tree, p.x, p.y) === p.cls) okT++;
check("tree-solves-xor", okT / xor.length >= 0.9, "acc=" + Math.round(okT / xor.length * 100) + "%");

/* 6) جيني: صحة الحساب — نقي=0، متوازن تماما=0.5 */
check("gini-pure-zero", M.mlGini([{ cls: 1 }, { cls: 1 }]) === 0);
check("gini-balanced-half", Math.abs(M.mlGini([{ cls: 0 }, { cls: 1 }]) - 0.5) < 1e-9, "gini=" + M.mlGini([{ cls: 0 }, { cls: 1 }]));

/* 7) شجرة بعمق 0 = جذر واحد يتنبا بالاغلبية */
const stump = M.mlTreeBuild([{ x: 0.1, y: 0.1, cls: 1 }, { x: 0.2, y: 0.2, cls: 1 }, { x: 0.9, y: 0.9, cls: 0 }], 0);
check("tree-depth0-is-majority-leaf", stump.leaf === true && stump.cls === 1, "leaf=" + stump.leaf + " cls=" + stump.cls);

if (failures) { console.log("\n" + failures + " FAILURES"); process.exit(1); }
console.log("\nALL ML LAB TESTS PASSED");
