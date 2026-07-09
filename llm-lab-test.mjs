// اختبار صحة رياضيات مختبري التوليد والترميز — مستخرجة من الصفحة المبنية نفسها
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);

const html = readFileSync(new URL("./ai-how-ai-works.html", import.meta.url), "utf8");
const start = html.indexOf("/* ===== LLM LAB MATH:");
const end = html.indexOf("/*__LAB_DOM__*/", start);
if (start < 0 || end < 0) throw new Error("LAB MATH markers not found");
const code = html.slice(start, end) +
  "\nmodule.exports = { mulberry32, LAB_CORPUS, LM_BOS, LM_EOS, lmBuild, lmNextDist, lmSample, bpeTrain, bpeEncode, bpeDecode, BPE_EOW };\n";
writeFileSync(new URL("./llm-lab-extracted.cjs", import.meta.url), code);
const M = require2("./llm-lab-extracted.cjs");

let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? "PASS" : "FAIL") + " | " + name + (detail ? " | " + detail : ""));
  if (!ok) failures++;
};

const LM = M.lmBuild(M.LAB_CORPUS);
check("corpus-size", LM.vocab.length >= 200 && LM.sentences >= 80,
  "vocab=" + LM.vocab.length + " sentences=" + LM.sentences);

/* 1) التوزيع سليم: مجموعه 1 في عدة سياقات وقيم حرارة */
let maxDev = 0;
for (const [w1, w2] of [["كان", "الصياد"], ["<s>", "<s>"], ["الى", "البحر"], ["كلمة", "غريبة"]]) {
  for (const T of [0.3, 1.0, 2.0]) {
    const d = M.lmNextDist(LM, w1, w2, T, 0);
    const s = d.reduce((a, o) => a + o.q, 0);
    maxDev = Math.max(maxDev, Math.abs(s - 1));
  }
}
check("distribution-sums-to-1", maxDev < 1e-9, "maxDev=" + maxDev.toExponential(2));

/* 2) الحرارة تعمل بالاتجاه الصحيح: انتروبيا اعلى مع حرارة اعلى */
const entropy = (d) => -d.reduce((s, o) => s + (o.q > 0 ? o.q * Math.log(o.q) : 0), 0);
const dLow = M.lmNextDist(LM, "كان", "الصياد", 0.5, 0);
const dHigh = M.lmNextDist(LM, "كان", "الصياد", 2.0, 0);
check("temperature-entropy", entropy(dHigh) > entropy(dLow) + 0.1,
  "H(T=0.5)=" + entropy(dLow).toFixed(3) + " H(T=2.0)=" + entropy(dHigh).toFixed(3));

/* 3) حرارة قريبة من الصفر + top-k=1 = اختيار اعظمي حتمي */
const dGreedy = M.lmNextDist(LM, "كان", "الصياد", 0.01, 1);
const dFull = M.lmNextDist(LM, "كان", "الصياد", 1.0, 0);
const rngG = M.mulberry32(1);
let deterministic = dGreedy.length === 1;
for (let i = 0; i < 20; i++) if (M.lmSample(dGreedy, rngG) !== dFull[0].w) deterministic = false;
check("greedy-deterministic", deterministic, "argmax=" + dFull[0].w);

/* 4) التوليد ينتهي برمز التوقف غالبا وكل كلماته من المفردات */
const vocabSet = new Set(LM.vocab);
let ended = 0, badWord = false;
for (let run = 0; run < 50; run++) {
  const rng = M.mulberry32(1000 + run);
  let w1 = "كان", w2 = "الصياد", steps = 0;
  while (steps < 150) {
    const d = M.lmNextDist(LM, w1, w2, 1.0, 12);
    const w = M.lmSample(d, rng);
    if (!vocabSet.has(w)) badWord = true;
    if (w === M.LM_EOS) { ended++; break; }
    w1 = w2; w2 = w; steps++;
  }
}
check("generation-terminates", ended >= 40 && !badWord, "ended=" + ended + "/50 badWord=" + badWord);

/* 5) BPE: ذهاب واياب بلا فقدان على جمل النص وعلى نص خارجي */
const BPE = M.bpeTrain(M.LAB_CORPUS, 200);
check("bpe-merges", BPE.merges.length === 200, "merges=" + BPE.merges.length);
const norm = (s) => s.replace(/[.،,]/g, " ").split(/\s+/).filter(Boolean).join(" ");
let rtOk = true, tested = 0;
const sents = M.LAB_CORPUS.split(".").map(s => s.trim()).filter(Boolean);
for (let i = 0; i < sents.length; i += 6) {
  const x = sents[i];
  if (M.bpeDecode(M.bpeEncode(BPE, x)) !== norm(x)) rtOk = false;
  tested++;
}
for (const x of ["ذهب الولد الى المدرسة الجديدة", "الشبكات العصبية تتعلم من البيانات", "hello world model"]) {
  if (M.bpeDecode(M.bpeEncode(BPE, x)) !== norm(x)) rtOk = false;
  tested++;
}
check("bpe-roundtrip-lossless", rtOk, "tested=" + tested + " strings");

/* 6) BPE يضغط فعلا: كلمات النص الشائعة رموز اقل من حروفها */
const commonTokens = M.bpeEncode(BPE, "الصياد البحر الصباح القرية");
const commonChars = "الصيادالبحرالصباحالقرية".length;
check("bpe-compresses-common", commonTokens.length <= commonChars / 2,
  "tokens=" + commonTokens.length + " chars=" + commonChars);

if (failures) { console.log("\n" + failures + " FAILURES"); process.exit(1); }
console.log("\nALL LLM LAB TESTS PASSED");
