"""Train a REAL miniature GPT (pure numpy) on the Atlas's own Arabic node texts.

Faithful GPT-2-style architecture: pre-LN transformer blocks, tied embedding head,
tanh-GELU, causal masking, AdamW with warmup+cosine, residual-scaled init.
A numerical gradient check MUST pass before any training starts (proof-not-claim).

The exported JSON contains the rounded weights AND reference activations computed
FROM those rounded weights, so the browser (float64) can be verified to ~1e-6.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]  # atlas repo root
LAB = Path(__file__).resolve().parents[1]
DATA = LAB / "data"

CONTENT_FILES = [
    "ai-content.mjs", "llm-content.mjs", "dl-content.mjs", "ml-content.mjs",
    "data-content.mjs", "ethics-content.mjs", "apps-content.mjs",
    "classic-content.mjs", "rl-content.mjs", "prob-content.mjs", "history-content.mjs",
]

SEED = 20260711
BLOCK = 64
D_MODEL = 64
N_HEAD = 4
N_LAYER = 2
D_FF = 256
BATCH = 48
STEPS = 3500
LR_MAX = 3e-3
LR_MIN = 3e-4
WARMUP = 150
WEIGHT_DECAY = 0.05
VAL_FRACTION = 0.05
GEN_LEN = 80
PROMPT = "الذكاء الاصطناعي "


# ---------------------------------------------------------------- corpus

def load_corpus() -> str:
    """Extract every node description (d:) and journey text (t:) from the content files."""
    pattern = re.compile(r'\b[dt]: "((?:[^"\\]|\\.)*)"')
    texts: list[str] = []
    for name in CONTENT_FILES:
        source = (ROOT / name).read_text(encoding="utf-8")
        for match in pattern.finditer(source):
            texts.append(match.group(1).replace('\\"', '"').replace("\\\\", "\\"))
    corpus = "\n".join(texts)
    if len(corpus) < 50_000:
        raise SystemExit(f"corpus suspiciously small: {len(corpus)} chars")
    return corpus


# ---------------------------------------------------------------- model core

def gelu(x):
    c = np.sqrt(2.0 / np.pi)
    inner = c * (x + 0.044715 * x ** 3)
    return 0.5 * x * (1.0 + np.tanh(inner))


def gelu_grad(x):
    c = np.sqrt(2.0 / np.pi)
    inner = c * (x + 0.044715 * x ** 3)
    t = np.tanh(inner)
    return 0.5 * (1.0 + t) + 0.5 * x * (1.0 - t ** 2) * c * (1.0 + 3 * 0.044715 * x ** 2)


def softmax_last(z):
    z = z - z.max(axis=-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)


def init_params(vocab: int, rng: np.random.Generator, dtype=np.float32) -> dict:
    def n(*shape, std=0.02):
        return (rng.standard_normal(shape) * std).astype(dtype)

    resid_std = 0.02 / np.sqrt(2 * N_LAYER)
    params: dict[str, np.ndarray] = {
        "tokEmb": n(vocab, D_MODEL),
        "posEmb": n(BLOCK, D_MODEL),
        "lnfg": np.ones(D_MODEL, dtype=dtype),
        "lnfb": np.zeros(D_MODEL, dtype=dtype),
    }
    for l in range(N_LAYER):
        params[f"l{l}.ln1g"] = np.ones(D_MODEL, dtype=dtype)
        params[f"l{l}.ln1b"] = np.zeros(D_MODEL, dtype=dtype)
        params[f"l{l}.Wq"] = n(D_MODEL, D_MODEL)
        params[f"l{l}.bq"] = np.zeros(D_MODEL, dtype=dtype)
        params[f"l{l}.Wk"] = n(D_MODEL, D_MODEL)
        params[f"l{l}.bk"] = np.zeros(D_MODEL, dtype=dtype)
        params[f"l{l}.Wv"] = n(D_MODEL, D_MODEL)
        params[f"l{l}.bv"] = np.zeros(D_MODEL, dtype=dtype)
        params[f"l{l}.Wo"] = (rng.standard_normal((D_MODEL, D_MODEL)) * resid_std).astype(dtype)
        params[f"l{l}.bo"] = np.zeros(D_MODEL, dtype=dtype)
        params[f"l{l}.ln2g"] = np.ones(D_MODEL, dtype=dtype)
        params[f"l{l}.ln2b"] = np.zeros(D_MODEL, dtype=dtype)
        params[f"l{l}.W1"] = n(D_MODEL, D_FF)
        params[f"l{l}.b1"] = np.zeros(D_FF, dtype=dtype)
        params[f"l{l}.W2"] = (rng.standard_normal((D_FF, D_MODEL)) * resid_std).astype(dtype)
        params[f"l{l}.b2"] = np.zeros(D_MODEL, dtype=dtype)
    return params


def layernorm_forward(x, g, b, eps=1e-5):
    mu = x.mean(axis=-1, keepdims=True)
    var = x.var(axis=-1, keepdims=True)
    inv = 1.0 / np.sqrt(var + eps)
    xhat = (x - mu) * inv
    return g * xhat + b, (xhat, inv, g)


def layernorm_backward(dy, cache):
    xhat, inv, g = cache
    dg = (dy * xhat).sum(axis=tuple(range(dy.ndim - 1)))
    db = dy.sum(axis=tuple(range(dy.ndim - 1)))
    dxhat = dy * g
    m1 = dxhat.mean(axis=-1, keepdims=True)
    m2 = (dxhat * xhat).mean(axis=-1, keepdims=True)
    dx = inv * (dxhat - m1 - xhat * m2)
    return dx, dg, db


def forward(params, idx, want_cache=True):
    """idx: (B,T) int. Returns logits (B,T,V) and cache for backward/visualization.
    يقرا الابعاد من العالميات وقت الاستدعاء (لا كوسائط افتراضية) كي يعمل فحص التدرج بابعاده المصغرة."""
    n_layer, n_head = N_LAYER, N_HEAD
    B, T = idx.shape
    hd = D_MODEL // n_head
    x = params["tokEmb"][idx] + params["posEmb"][:T]
    mask = np.triu(np.ones((T, T), dtype=bool), k=1)
    cache = {"idx": idx, "T": T, "layers": [], "x0": x}
    for l in range(n_layer):
        p = lambda k: params[f"l{l}.{k}"]
        a, ln1c = layernorm_forward(x, p("ln1g"), p("ln1b"))
        q = a @ p("Wq") + p("bq")
        k_ = a @ p("Wk") + p("bk")
        v = a @ p("Wv") + p("bv")
        qh = q.reshape(B, T, n_head, hd).transpose(0, 2, 1, 3)
        kh = k_.reshape(B, T, n_head, hd).transpose(0, 2, 1, 3)
        vh = v.reshape(B, T, n_head, hd).transpose(0, 2, 1, 3)
        scores = (qh @ kh.transpose(0, 1, 3, 2)) / np.sqrt(hd)
        scores = np.where(mask, -1e9, scores)
        att = softmax_last(scores)
        oh = att @ vh
        o = oh.transpose(0, 2, 1, 3).reshape(B, T, D_MODEL)
        r1 = o @ p("Wo") + p("bo")
        x2 = x + r1
        m, ln2c = layernorm_forward(x2, p("ln2g"), p("ln2b"))
        h1 = m @ p("W1") + p("b1")
        gact = gelu(h1)
        r2 = gact @ p("W2") + p("b2")
        x_next = x2 + r2
        if want_cache:
            cache["layers"].append({"x": x, "a": a, "ln1c": ln1c, "q": qh, "k": kh, "v": vh,
                                    "att": att, "o": o, "x2": x2, "m": m, "ln2c": ln2c,
                                    "h1": h1, "g": gact})
        x = x_next
    f, lnfc = layernorm_forward(x, params["lnfg"], params["lnfb"])
    logits = f @ params["tokEmb"].T
    if want_cache:
        cache["xf"] = x
        cache["f"] = f
        cache["lnfc"] = lnfc
    return logits, cache


def loss_and_grads(params, idx, targets):
    B, T = idx.shape
    V = params["tokEmb"].shape[0]
    n_head = N_HEAD
    hd = D_MODEL // n_head
    logits, c = forward(params, idx)
    probs = softmax_last(logits.astype(np.float64)).astype(logits.dtype)
    loss = -np.log(np.maximum(probs[np.arange(B)[:, None], np.arange(T)[None, :], targets], 1e-12)).mean()

    grads = {k: np.zeros_like(v) for k, v in params.items()}
    dlogits = probs.copy()
    dlogits[np.arange(B)[:, None], np.arange(T)[None, :], targets] -= 1.0
    dlogits /= (B * T)

    grads["tokEmb"] += dlogits.reshape(-1, V).T @ c["f"].reshape(-1, D_MODEL)
    df = dlogits @ params["tokEmb"]
    dx, dg, db = layernorm_backward(df, c["lnfc"])
    grads["lnfg"] += dg
    grads["lnfb"] += db

    for l in reversed(range(N_LAYER)):
        p = lambda k: params[f"l{l}.{k}"]
        g = lambda k: grads[f"l{l}.{k}"]
        L = c["layers"][l]
        # MLP branch
        dr2 = dx
        grads[f"l{l}.W2"] += L["g"].reshape(-1, D_FF).T @ dr2.reshape(-1, D_MODEL)
        grads[f"l{l}.b2"] += dr2.sum(axis=(0, 1))
        dgact = dr2 @ p("W2").T
        dh1 = dgact * gelu_grad(L["h1"])
        grads[f"l{l}.W1"] += L["m"].reshape(-1, D_MODEL).T @ dh1.reshape(-1, D_FF)
        grads[f"l{l}.b1"] += dh1.sum(axis=(0, 1))
        dm = dh1 @ p("W1").T
        dx2_from_ln, dg2, db2 = layernorm_backward(dm, L["ln2c"])
        grads[f"l{l}.ln2g"] += dg2
        grads[f"l{l}.ln2b"] += db2
        dx2 = dx + dx2_from_ln
        # Attention branch
        dr1 = dx2
        grads[f"l{l}.Wo"] += L["o"].reshape(-1, D_MODEL).T @ dr1.reshape(-1, D_MODEL)
        grads[f"l{l}.bo"] += dr1.sum(axis=(0, 1))
        do = (dr1 @ p("Wo").T).reshape(B, T, n_head, hd).transpose(0, 2, 1, 3)
        datt = do @ L["v"].transpose(0, 1, 3, 2)
        dv = L["att"].transpose(0, 1, 3, 2) @ do
        dscores = L["att"] * (datt - (datt * L["att"]).sum(axis=-1, keepdims=True))
        dscores /= np.sqrt(hd)
        dq = dscores @ L["k"]
        dk = dscores.transpose(0, 1, 3, 2) @ L["q"]
        dqf = dq.transpose(0, 2, 1, 3).reshape(B, T, D_MODEL)
        dkf = dk.transpose(0, 2, 1, 3).reshape(B, T, D_MODEL)
        dvf = dv.transpose(0, 2, 1, 3).reshape(B, T, D_MODEL)
        a2 = L["a"].reshape(-1, D_MODEL)
        grads[f"l{l}.Wq"] += a2.T @ dqf.reshape(-1, D_MODEL)
        grads[f"l{l}.bq"] += dqf.sum(axis=(0, 1))
        grads[f"l{l}.Wk"] += a2.T @ dkf.reshape(-1, D_MODEL)
        grads[f"l{l}.bk"] += dkf.sum(axis=(0, 1))
        grads[f"l{l}.Wv"] += a2.T @ dvf.reshape(-1, D_MODEL)
        grads[f"l{l}.bv"] += dvf.sum(axis=(0, 1))
        da = dqf @ p("Wq").T + dkf @ p("Wk").T + dvf @ p("Wv").T
        dx_from_ln1, dg1, db1 = layernorm_backward(da, L["ln1c"])
        grads[f"l{l}.ln1g"] += dg1
        grads[f"l{l}.ln1b"] += db1
        dx = dx2 + dx_from_ln1

    # embeddings — np.add.at بطيء جدا (ufunc غير مخزن)؛ ضرب one-hot اسرع بعشرات المرات
    flat_idx = c["idx"].reshape(-1)
    flat_dx = dx.reshape(-1, D_MODEL)
    one_hot = np.zeros((flat_idx.size, V), dtype=flat_dx.dtype)
    one_hot[np.arange(flat_idx.size), flat_idx] = 1.0
    grads["tokEmb"] += one_hot.T @ flat_dx
    grads["posEmb"][:T] += dx.sum(axis=0)
    return loss, grads


# ---------------------------------------------------------------- gradient check

def gradient_check():
    """Analytic grads must match numerical grads before training may start."""
    global BLOCK, D_MODEL, N_HEAD, N_LAYER, D_FF
    saved = (BLOCK, D_MODEL, N_HEAD, N_LAYER, D_FF)
    BLOCK, D_MODEL, N_HEAD, N_LAYER, D_FF = 8, 8, 2, 2, 16
    rng = np.random.default_rng(7)
    V = 11
    params = {k: v.astype(np.float64) for k, v in init_params(V, rng, dtype=np.float64).items()}
    idx = rng.integers(0, V, size=(2, BLOCK))
    tgt = rng.integers(0, V, size=(2, BLOCK))
    _, grads = loss_and_grads(params, idx, tgt)
    eps = 1e-5
    worst = 0.0
    checked = 0
    check_rng = np.random.default_rng(13)
    for name, tensor in params.items():
        flat = tensor.reshape(-1)
        for _ in range(4):
            i = int(check_rng.integers(0, flat.size))
            old = flat[i]
            flat[i] = old + eps
            lp, _ = loss_and_grads(params, idx, tgt)
            flat[i] = old - eps
            lm, _ = loss_and_grads(params, idx, tgt)
            flat[i] = old
            num = (lp - lm) / (2 * eps)
            ana = grads[name].reshape(-1)[i]
            denom = max(1e-8, abs(num) + abs(ana))
            rel = abs(num - ana) / denom
            worst = max(worst, rel)
            checked += 1
    BLOCK, D_MODEL, N_HEAD, N_LAYER, D_FF = saved
    if worst > 2e-4:
        raise SystemExit(f"GRADIENT CHECK FAILED: worst rel err {worst:.2e} over {checked} probes")
    print(f"gradient check PASSED: {checked} probes, worst rel err {worst:.2e}")


# ---------------------------------------------------------------- training

def decayable(name: str) -> bool:
    return name.endswith(("Wq", "Wk", "Wv", "Wo", "W1", "W2")) or name in ("tokEmb", "posEmb")


def train(corpus: str):
    rng = np.random.default_rng(SEED)
    chars = sorted(set(corpus))
    stoi = {ch: i for i, ch in enumerate(chars)}
    encoded = np.array([stoi[ch] for ch in corpus], dtype=np.int32)
    split = int(len(encoded) * (1 - VAL_FRACTION))
    train_ids, val_ids = encoded[:split], encoded[split:]
    V = len(chars)
    print(f"corpus: {len(corpus):,} chars | vocab: {V} | train: {len(train_ids):,} | val: {len(val_ids):,}")

    params = init_params(V, rng)
    m_state = {k: np.zeros_like(v, dtype=np.float32) for k, v in params.items()}
    v_state = {k: np.zeros_like(v, dtype=np.float32) for k, v in params.items()}
    beta1, beta2, adam_eps = 0.9, 0.95, 1e-8

    def batch(ids):
        starts = rng.integers(0, len(ids) - BLOCK - 1, size=BATCH)
        x = np.stack([ids[s:s + BLOCK] for s in starts]).astype(np.int64)
        y = np.stack([ids[s + 1:s + BLOCK + 1] for s in starts]).astype(np.int64)
        return x, y

    def val_loss(n_batches=12):
        total = 0.0
        for _ in range(n_batches):
            x, y = batch(val_ids)
            logits, _ = forward(params, x, want_cache=True)
            probs = softmax_last(logits.astype(np.float64))
            total += -np.log(np.maximum(probs[np.arange(BATCH)[:, None], np.arange(BLOCK)[None, :], y], 1e-12)).mean()
        return total / n_batches

    t0 = time.time()
    last_loss = None
    for step in range(1, STEPS + 1):
        if step <= WARMUP:
            lr = LR_MAX * step / WARMUP
        else:
            progress = (step - WARMUP) / max(1, STEPS - WARMUP)
            lr = LR_MIN + 0.5 * (LR_MAX - LR_MIN) * (1 + np.cos(np.pi * progress))
        x, y = batch(train_ids)
        loss, grads = loss_and_grads(params, x, y)
        last_loss = float(loss)
        for name in params:
            gr = grads[name]
            if decayable(name):
                gr = gr + WEIGHT_DECAY * params[name]
            m_state[name] = beta1 * m_state[name] + (1 - beta1) * gr
            v_state[name] = beta2 * v_state[name] + (1 - beta2) * gr * gr
            mhat = m_state[name] / (1 - beta1 ** step)
            vhat = v_state[name] / (1 - beta2 ** step)
            params[name] -= (lr * mhat / (np.sqrt(vhat) + adam_eps)).astype(params[name].dtype)
        if step % 250 == 0 or step == 1:
            vl = val_loss()
            ms = (time.time() - t0) / step * 1000
            print(f"step {step:4d}/{STEPS} | lr {lr:.2e} | train {loss:.4f} | val {vl:.4f} | ppl {np.exp(vl):.2f} | {ms:.0f} ms/step", flush=True)
    vl = val_loss(24)
    print(f"FINAL: train {last_loss:.4f} | val {vl:.4f} | val ppl {np.exp(vl):.2f} | total {(time.time()-t0)/60:.1f} min")
    return params, chars, float(last_loss), float(vl)


# ---------------------------------------------------------------- export

def round6(a):
    return np.round(np.asarray(a, dtype=np.float64), 6)


def export(params, chars, train_loss, vloss, corpus_len):
    stoi = {ch: i for i, ch in enumerate(chars)}
    V = len(chars)
    rounded = {k: round6(v) for k, v in params.items()}
    n_params = int(sum(v.size for v in params.values()))

    prompt = PROMPT if all(ch in stoi for ch in PROMPT) else "".join(chars[:16])
    ptoks = [stoi[ch] for ch in prompt]

    def fwd64(tokens):
        idx = np.array([tokens], dtype=np.int64)
        logits, cache = forward(rounded, idx)
        return logits[0], cache

    logits, cache = fwd64(ptoks)
    logits_last = logits[-1]
    att00 = cache["layers"][0]["att"][0, 0]  # (T,T) layer0 head0

    pos = len(ptoks) - 1
    src = int(np.argmax(att00[pos, :pos + 1]))
    hd = D_MODEL // N_HEAD
    pre_score = float((cache["layers"][0]["q"][0, 0, pos] @ cache["layers"][0]["k"][0, 0, src]) / np.sqrt(hd))

    tokens = list(ptoks)
    greedy_chars = []
    step10_logits = None
    for i in range(GEN_LEN):
        window = tokens[-BLOCK:]
        lg, _ = fwd64(window)
        nxt = int(np.argmax(lg[-1]))
        if i == 10:
            step10_logits = lg[-1].copy()
        tokens.append(nxt)
        greedy_chars.append(chars[nxt])

    layers_out = []
    for l in range(N_LAYER):
        layers_out.append({
            "ln1g": rounded[f"l{l}.ln1g"].tolist(), "ln1b": rounded[f"l{l}.ln1b"].tolist(),
            "Wq": rounded[f"l{l}.Wq"].tolist(), "bq": rounded[f"l{l}.bq"].tolist(),
            "Wk": rounded[f"l{l}.Wk"].tolist(), "bk": rounded[f"l{l}.bk"].tolist(),
            "Wv": rounded[f"l{l}.Wv"].tolist(), "bv": rounded[f"l{l}.bv"].tolist(),
            "Wo": rounded[f"l{l}.Wo"].tolist(), "bo": rounded[f"l{l}.bo"].tolist(),
            "ln2g": rounded[f"l{l}.ln2g"].tolist(), "ln2b": rounded[f"l{l}.ln2b"].tolist(),
            "W1": rounded[f"l{l}.W1"].tolist(), "b1": rounded[f"l{l}.b1"].tolist(),
            "W2": rounded[f"l{l}.W2"].tolist(), "b2": rounded[f"l{l}.b2"].tolist(),
        })

    payload = {
        "schema": 1,
        "kind": "tiny-gpt-char",
        "config": {"vocabSize": V, "blockSize": BLOCK, "nLayer": N_LAYER, "nHead": N_HEAD,
                    "dModel": D_MODEL, "dFF": D_FF, "tiedHead": True, "gelu": "tanh", "preLN": True},
        "vocab": chars,
        "weights": {"tokEmb": rounded["tokEmb"].tolist(), "posEmb": rounded["posEmb"].tolist(),
                     "layers": layers_out, "lnfg": rounded["lnfg"].tolist(), "lnfb": rounded["lnfb"].tolist()},
        "meta": {"params": n_params, "corpusChars": corpus_len,
                  "corpusSource": "atlas node descriptions and journey texts (11 content files)",
                  "steps": STEPS, "batch": BATCH, "trainLoss": round(train_loss, 4),
                  "valLoss": round(vloss, 4), "valPpl": round(float(np.exp(vloss)), 2), "seed": SEED},
        "reference": {
            "prompt": prompt,
            "promptTokens": ptoks,
            "logitsLast": round6(logits_last).tolist(),
            "attL0H0": np.round(att00, 5).tolist(),
            "greedy": {"length": GEN_LEN, "text": "".join(greedy_chars)},
            "step10LogitsLast": round6(step10_logits).tolist(),
            "proof": {"layer": 0, "head": 0, "pos": pos, "srcIndex": src,
                       "preScore": round(pre_score, 6),
                       "postWeight": round(float(att00[pos, src]), 6)},
        },
    }
    DATA.mkdir(parents=True, exist_ok=True)
    out = DATA / "tiny-gpt.json"
    out.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size/1e6:.2f} MB) | params {n_params:,}")
    print(f"greedy sample: {prompt}{''.join(greedy_chars[:60])!r}")


def main():
    import sys
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # طرفيات Windows cp1252 تنهار على العربية
    gradient_check()
    corpus = load_corpus()
    params, chars, train_loss, vloss = train(corpus)
    export(params, chars, train_loss, vloss, len(corpus))


if __name__ == "__main__":
    main()
