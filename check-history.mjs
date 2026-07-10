// يتحقق من سلامة history-content: مفاتيح فريدة، آباء موجودون، رحلة صحيحة، لا تشكيل، روابط متقاطعة صحيحة
import { readFileSync, writeFileSync } from "node:fs";
import * as HIST from "./history-content.mjs";

const HARAKAT = /[ً-ْٰ]/g;
let issues = 0;
const bad = (m) => { console.log("✗ " + m); issues++; };

const raw = readFileSync("./history-content.mjs", "utf8");
const marks = raw.match(HARAKAT);
if (marks) {
  bad(`تشكيل: ${marks.length} حركة — يجري التجريد`);
  writeFileSync("./history-content.mjs", raw.replace(HARAKAT, ""), "utf8");
  console.log("  ✓ جُردت الحركات، اعد التشغيل للتأكد");
} else console.log("✓ لا تشكيل");

const { GROUPS, NODES, JOURNEY } = HIST;

if (NODES[0].k !== "root") bad("العقدة الاولى ليست root");

const keys = new Set();
for (const nd of NODES) {
  if (keys.has(nd.k)) bad("مفتاح مكرر: " + nd.k);
  keys.add(nd.k);
}
for (const nd of NODES) {
  if (nd.p !== null && !keys.has(nd.p)) bad(`اب مجهول ${nd.p} في ${nd.k}`);
  if (nd.g < -1 || nd.g >= GROUPS.length) bad(`مجموعة خارج المدى ${nd.g} في ${nd.k}`);
  if (nd.k !== "root" && HARAKAT.test(nd.e)) { /* handled above */ }
}
for (const s of JOURNEY) {
  if (!keys.has(s.k)) bad("خطوة رحلة مجهولة: " + s.k);
  for (const r of (s.rel || [])) if (!keys.has(r)) bad(`rel مجهول ${r} في خطوة ${s.k}`);
}

const XLINKS_HISTORY = [
  ["turing-1950", "turing-machine"], ["mcculloch-pitts", "perceptron"], ["perceptrons-book", "perceptron"],
  ["backprop-1986", "perceptrons-book"], ["deep-blue", "shannon-chess"], ["lecun-convnet", "alexnet"],
  ["imagenet", "alexnet"], ["alphago", "dqn-atari"], ["alphago", "deep-blue"],
  ["transformer", "gpt-series"], ["chatgpt", "eliza"], ["turing-award-2018", "backprop-1986"],
  ["nobel-2024", "hopfield-net"], ["nobel-2024", "alphafold2"],
];
for (const [a, b] of XLINKS_HISTORY) {
  if (!keys.has(a)) bad("رابط متقاطع مفتاح مجهول: " + a);
  if (!keys.has(b)) bad("رابط متقاطع مفتاح مجهول: " + b);
}

for (let g = 0; g < GROUPS.length; g++) {
  const hubs = NODES.filter((n) => n.g === g && n.h);
  if (hubs.length !== 1) bad(`المجموعة ${g} (${GROUPS[g].name}) فيها ${hubs.length} محاور`);
}

console.log(`\nالعقد: ${NODES.length} · المجموعات: ${GROUPS.length} · خطوات الرحلة: ${JOURNEY.length} · روابط متقاطعة: ${XLINKS_HISTORY.length}`);
console.log(issues === 0 ? "✓✓ history-content سليم" : `\n✗ ${issues} مشكلة`);
