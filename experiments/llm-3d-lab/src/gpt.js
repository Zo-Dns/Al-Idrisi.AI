/* ===== TINY GPT MATH =====
   انتشار امامي كامل وحقيقي لمحول GPT مصغر في المتصفح — بلا اي مكتبة.
   يطابق سكربت التدريب numpy معادلة معادلة (pre-LN، رؤوس متعددة، قناع سببي، GELU-tanh، راس مربوط بالتمثيلات).
   نقي بلا DOM كي يستورده ملف الاختبار في node ويبرهن مطابقته لمرجع التدريب. */

export function buildModel(json) {
  const { config, vocab, weights } = json;
  const stoi = new Map(vocab.map((ch, i) => [ch, i]));
  return { config, vocab, stoi, w: weights, meta: json.meta, reference: json.reference };
}

export function encode(model, text) {
  const out = [];
  for (const ch of text) {
    const id = model.stoi.get(ch);
    if (id !== undefined) out.push(id);
  }
  return out;
}

export function decode(model, tokens) {
  return tokens.map((t) => model.vocab[t]).join("");
}

function layernorm(x, g, b) {
  const D = x.length;
  let mu = 0;
  for (let i = 0; i < D; i++) mu += x[i];
  mu /= D;
  let v = 0;
  for (let i = 0; i < D; i++) { const d = x[i] - mu; v += d * d; }
  v /= D;
  const inv = 1 / Math.sqrt(v + 1e-5);
  const y = new Float64Array(D);
  for (let i = 0; i < D; i++) y[i] = g[i] * (x[i] - mu) * inv + b[i];
  return y;
}

function linear(x, W, b) {
  const inD = W.length, outD = W[0].length;
  const y = new Float64Array(outD);
  if (b) for (let j = 0; j < outD; j++) y[j] = b[j];
  for (let i = 0; i < inD; i++) {
    const xi = x[i];
    if (xi === 0) continue;
    const row = W[i];
    for (let j = 0; j < outD; j++) y[j] += xi * row[j];
  }
  return y;
}

function gelu(x) {
  const c = Math.sqrt(2 / Math.PI);
  return 0.5 * x * (1 + Math.tanh(c * (x + 0.044715 * x * x * x)));
}

export function softmax(z, temperature = 1) {
  const t = Math.max(temperature, 1e-6);
  let mx = -Infinity;
  for (const v of z) mx = Math.max(mx, v / t);
  let sum = 0;
  const e = new Float64Array(z.length);
  for (let i = 0; i < z.length; i++) { e[i] = Math.exp(z[i] / t - mx); sum += e[i]; }
  for (let i = 0; i < z.length; i++) e[i] /= sum;
  return e;
}

export function entropy(probs) {
  let h = 0;
  for (const p of probs) if (p > 0) h -= p * Math.log2(p);
  return h;
}

/* التمريرة الامامية الكاملة لتسلسل رموز — تعيد لوغتات كل موضع + مصفوفات الانتباه كاملة للعرض */
export function forward(model, tokens) {
  const { nLayer, nHead, dModel } = model.config;
  const hd = dModel / nHead;
  const T = tokens.length;
  const w = model.w;

  let x = [];
  for (let tpos = 0; tpos < T; tpos++) {
    const row = new Float64Array(dModel);
    const emb = w.tokEmb[tokens[tpos]];
    const pos = w.posEmb[tpos];
    for (let i = 0; i < dModel; i++) row[i] = emb[i] + pos[i];
    x.push(row);
  }

  const attention = []; // [layer][head] = T×T
  const qk = [];        // [layer] = {q:[T][head][hd], k:...} للوحة البرهان
  const hiddenNorms = [];

  for (let l = 0; l < nLayer; l++) {
    const L = w.layers[l];
    const a = x.map((row) => layernorm(row, L.ln1g, L.ln1b));
    const q = a.map((row) => linear(row, L.Wq, L.bq));
    const k = a.map((row) => linear(row, L.Wk, L.bk));
    const v = a.map((row) => linear(row, L.Wv, L.bv));

    const attL = [];
    for (let h = 0; h < nHead; h++) attL.push([]);
    const merged = x.map(() => new Float64Array(dModel));

    for (let h = 0; h < nHead; h++) {
      const off = h * hd;
      for (let tq = 0; tq < T; tq++) {
        const scores = new Float64Array(tq + 1);
        for (let tk = 0; tk <= tq; tk++) {
          let s = 0;
          for (let d = 0; d < hd; d++) s += q[tq][off + d] * k[tk][off + d];
          scores[tk] = s / Math.sqrt(hd);
        }
        const att = softmax(scores, 1);
        const rowOut = new Float64Array(hd);
        for (let tk = 0; tk <= tq; tk++) {
          const wgt = att[tk];
          for (let d = 0; d < hd; d++) rowOut[d] += wgt * v[tk][off + d];
        }
        const full = new Float64Array(T);
        for (let tk = 0; tk <= tq; tk++) full[tk] = att[tk];
        attL[h].push(full);
        for (let d = 0; d < hd; d++) merged[tq][off + d] = rowOut[d];
      }
    }

    for (let tpos = 0; tpos < T; tpos++) {
      const proj = linear(merged[tpos], L.Wo, L.bo);
      for (let i = 0; i < dModel; i++) x[tpos][i] += proj[i];
      const m = layernorm(x[tpos], L.ln2g, L.ln2b);
      const h1 = linear(m, L.W1, L.b1);
      for (let i = 0; i < h1.length; i++) h1[i] = gelu(h1[i]);
      const r2 = linear(h1, L.W2, L.b2);
      for (let i = 0; i < dModel; i++) x[tpos][i] += r2[i];
    }

    attention.push(attL);
    qk.push({ q, k });
    hiddenNorms.push(x.map((row) => Math.hypot(...row)));
  }

  const logits = [];
  for (let tpos = 0; tpos < T; tpos++) {
    const f = layernorm(x[tpos], w.lnfg, w.lnfb);
    const lg = new Float64Array(model.config.vocabSize);
    for (let vtok = 0; vtok < model.config.vocabSize; vtok++) {
      const row = w.tokEmb[vtok];
      let s = 0;
      for (let i = 0; i < dModel; i++) s += f[i] * row[i];
      lg[vtok] = s;
    }
    logits.push(lg);
  }
  return { logits, attention, qk, hiddenNorms, T };
}

export function nextDistribution(model, tokens, temperature = 1) {
  const window = tokens.slice(-model.config.blockSize);
  const pass = forward(model, window);
  const logits = pass.logits[pass.T - 1];
  return { probs: softmax(logits, temperature), logits, pass };
}

export function sampleFrom(probs, rand = Math.random) {
  let r = rand();
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i];
    if (r <= 0) return i;
  }
  return probs.length - 1;
}

export function argmax(arr) {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

export function countParams(model) {
  const { vocabSize, blockSize, nLayer, dModel, dFF } = model.config;
  const perLayer = 2 * dModel + 4 * (dModel * dModel + dModel) + 2 * dModel + (dModel * dFF + dFF) + (dFF * dModel + dModel);
  return vocabSize * dModel + blockSize * dModel + nLayer * perLayer + 2 * dModel;
}
