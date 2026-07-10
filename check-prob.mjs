// يتحقق من سلامة prob-content: مفاتيح فريدة، آباء موجودون، رحلة صحيحة، لا تشكيل، روابط متقاطعة صحيحة
import { readFileSync, writeFileSync } from "node:fs";
import * as PROB from "./prob-content.mjs";

const HARAKAT = /[ً-ْٰ]/g;
let issues = 0;
const bad = (m) => { console.log("✗ " + m); issues++; };

// 1) تشكيل — افحص المصدر الخام
const raw = readFileSync("./prob-content.mjs", "utf8");
const marks = raw.match(HARAKAT);
if (marks) {
  bad(`تشكيل: ${marks.length} حركة — يجري التجريد`);
  writeFileSync("./prob-content.mjs", raw.replace(HARAKAT, ""), "utf8");
  console.log("  ✓ جُردت الحركات، اعد التشغيل للتأكد");
} else console.log("✓ لا تشكيل");

const { GROUPS, NODES, JOURNEY } = PROB;

// 2) root اولا
if (NODES[0].k !== "root") bad("العقدة الاولى ليست root");

// 3) مفاتيح فريدة
const keys = new Set();
for (const nd of NODES) {
  if (keys.has(nd.k)) bad("مفتاح مكرر: " + nd.k);
  keys.add(nd.k);
}

// 4) آباء موجودون + مجموعات في المدى
for (const nd of NODES) {
  if (nd.p !== null && !keys.has(nd.p)) bad(`اب مجهول ${nd.p} في ${nd.k}`);
  if (nd.g < -1 || nd.g >= GROUPS.length) bad(`مجموعة خارج المدى ${nd.g} في ${nd.k}`);
}

// 5) الرحلة
for (const s of JOURNEY) {
  if (!keys.has(s.k)) bad("خطوة رحلة مجهولة: " + s.k);
  for (const r of (s.rel || [])) if (!keys.has(r)) bad(`rel مجهول ${r} في خطوة ${s.k}`);
}

// 6) الروابط المتقاطعة داخل العالم
const XLINKS_PROB = [
  ["bayes-rule", "conditional-prob"], ["bayes-net", "conditional-independence"], ["d-separation", "conditional-independence"],
  ["gibbs-sampling", "markov-blanket"], ["variable-elimination", "bn-factorization"], ["mcmc", "mcmc-history"],
  ["kalman-filter", "kalman-1960"], ["bayes-net", "pearl-1988"], ["em-algorithm", "forward-backward"],
  ["vae-p", "variational-inference"], ["naive-bayes-p", "conditional-independence"], ["pomdp", "temporal-models"],
  ["enumeration-inference", "marginalization"], ["bayes-1763", "bayes-rule"], ["diffusion-p", "variational-inference"],
];
for (const [a, b] of XLINKS_PROB) {
  if (!keys.has(a)) bad("رابط متقاطع مفتاح مجهول: " + a);
  if (!keys.has(b)) bad("رابط متقاطع مفتاح مجهول: " + b);
}

// 7) قاعدة المحاور (قننت 11 يوليو 2026): كل مجموعة فيها محور واحد على الاقل،
//    وكل محور اما عقدة حلقة اولى (p=root) او عقدة داخلية ترسو عائلة (لها ابناء) —
//    القاعدة القديمة (محور واحد بالضبط) كانت خاطئة: اشقاء الحلقة الاولى قد يتشاركون مجموعة لونية واحدة عن حق.
for (let g = 0; g < GROUPS.length; g++) {
  const hubs = NODES.filter((n) => n.g === g && n.h);
  if (hubs.length === 0) bad(`المجموعة ${g} (${GROUPS[g].name}) بلا محور`);
  for (const h of hubs) {
    if (h.k !== "root" && h.p !== "root" && !NODES.some((x) => x.p === h.k))
      bad(`محور داخلي بلا ابناء (بروز يتيم): ${h.k} في ${GROUPS[g].name}`);
  }
}

console.log(`\nالعقد: ${NODES.length} · المجموعات: ${GROUPS.length} · خطوات الرحلة: ${JOURNEY.length} · روابط متقاطعة: ${XLINKS_PROB.length}`);
console.log(issues === 0 ? "✓✓ prob-content سليم" : `\n✗ ${issues} مشكلة`);
