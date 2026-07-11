/* برهان مطابقة رياضيات المتصفح لمرجع التدريب — يشغل: node experiments/llm-3d-lab/tiny-gpt-test.mjs */
import { readFileSync } from "node:fs";
import { buildModel, encode, decode, forward, softmax, entropy, argmax, countParams } from "./src/gpt.js";

const json = JSON.parse(readFileSync(new URL("./data/tiny-gpt.json", import.meta.url), "utf8"));
const model = buildModel(json);
const fail = (name, detail) => { console.error(`FAIL | ${name} | ${detail}`); process.exitCode = 1; };
const pass = (name, detail) => console.log(`PASS | ${name} | ${detail}`);

/* 1) عدد المعاملات المعاد حسابه من الابعاد = المصدر */
const params = countParams(model);
if (params === json.meta.params) pass("param-count", params.toLocaleString("en-US"));
else fail("param-count", `computed=${params} exported=${json.meta.params}`);

/* 2) الترميز يسترجع نص المرجع */
const ptoks = encode(model, json.reference.prompt);
if (JSON.stringify(ptoks) === JSON.stringify(json.reference.promptTokens)) pass("tokenizer-roundtrip", `${ptoks.length} tokens`);
else fail("tokenizer-roundtrip", "mismatch");

/* 3) لوغتات الموضع الاخير تطابق المرجع (المحسوب من نفس الاوزان المقربة) */
const passFwd = forward(model, ptoks);
const logits = passFwd.logits[passFwd.T - 1];
let maxDiff = 0;
for (let i = 0; i < logits.length; i++) maxDiff = Math.max(maxDiff, Math.abs(logits[i] - json.reference.logitsLast[i]));
if (maxDiff < 1e-4) pass("forward-logits-match", `maxΔ=${maxDiff.toExponential(2)}`);
else fail("forward-logits-match", `maxΔ=${maxDiff}`);

/* 4) مصفوفة انتباه الطبقة 0 الراس 0 تطابق المرجع + صفوفها تجمع الى 1 + سببية */
const att = passFwd.attention[0][0];
let attDiff = 0, rowErr = 0, future = 0;
for (let i = 0; i < passFwd.T; i++) {
  let sum = 0;
  for (let j = 0; j < passFwd.T; j++) {
    attDiff = Math.max(attDiff, Math.abs(att[i][j] - json.reference.attL0H0[i][j]));
    if (j <= i) sum += att[i][j]; else future = Math.max(future, att[i][j]);
  }
  rowErr = Math.max(rowErr, Math.abs(sum - 1));
}
if (attDiff < 5e-4) pass("attention-matches-reference", `maxΔ=${attDiff.toExponential(2)}`);
else fail("attention-matches-reference", `maxΔ=${attDiff}`);
if (rowErr < 1e-9) pass("attention-rows-sum-to-1", `err=${rowErr.toExponential(2)}`);
else fail("attention-rows-sum-to-1", `err=${rowErr}`);
if (future === 0) pass("causal-mask", "no weight to the future");
else fail("causal-mask", `future weight ${future}`);

/* 5) اعادة حساب q·k/√d يدويا = المرجع */
const hd = model.config.dModel / model.config.nHead;
const pr = json.reference.proof;
let qk = 0;
for (let d = 0; d < hd; d++) qk += passFwd.qk[0].q[pr.pos][d] * passFwd.qk[0].k[pr.srcIndex][d];
qk /= Math.sqrt(hd);
if (Math.abs(qk - pr.preScore) < 1e-4 && Math.abs(att[pr.pos][pr.srcIndex] - pr.postWeight) < 1e-4)
  pass("manual-qk-proof", `${qk.toFixed(6)} ≈ ${pr.preScore}`);
else fail("manual-qk-proof", `qk=${qk} ref=${pr.preScore}`);

/* 6) التوليد الجشع يعيد انتاج نص المرجع حرفا حرفا (حتمية كاملة) */
const tokens = [...ptoks];
const out = [];
for (let i = 0; i < json.reference.greedy.length; i++) {
  const win = tokens.slice(-model.config.blockSize);
  const p = forward(model, win);
  const nxt = argmax(p.logits[p.T - 1]);
  if (i === 10) {
    let d10 = 0;
    const lg = p.logits[p.T - 1];
    for (let v = 0; v < lg.length; v++) d10 = Math.max(d10, Math.abs(lg[v] - json.reference.step10LogitsLast[v]));
    if (d10 < 1e-4) pass("autoregressive-step10-logits", `maxΔ=${d10.toExponential(2)}`);
    else fail("autoregressive-step10-logits", `maxΔ=${d10}`);
  }
  tokens.push(nxt);
  out.push(model.vocab[nxt]);
}
if (out.join("") === json.reference.greedy.text) pass("greedy-generation-exact", `${out.length} chars reproduced`);
else fail("greedy-generation-exact", `got ${JSON.stringify(out.join("").slice(0, 40))}`);

/* 7) الحرارة ترفع الانتروبيا رتيبا */
const h = [0.5, 1, 2].map((t) => entropy(softmax(logits, t)));
if (h[0] < h[1] && h[1] < h[2]) pass("temperature-raises-entropy", h.map((x) => x.toFixed(2)).join(" < ") + " bits");
else fail("temperature-raises-entropy", h.join(","));

if (!process.exitCode) console.log("\nALL TINY GPT 3D LAB TESTS PASSED");
