"""Train a small MLP on the UCI Optdigits dataset using only Python stdlib.

Outputs:
  ../data/model.json
  ../data/samples.json
"""

from __future__ import annotations

import csv
import json
import math
import random
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw"
TRAIN_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/optdigits/optdigits.tra"
TEST_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/optdigits/optdigits.tes"


def download(url: str, path: Path) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"downloading {url}")
    with urllib.request.urlopen(url, timeout=30) as r:
        path.write_bytes(r.read())


def load_csv(path: Path):
    xs, ys = [], []
    with path.open(newline="") as f:
        for row in csv.reader(f):
            vals = [int(v) for v in row]
            xs.append([v / 16.0 for v in vals[:64]])
            ys.append(vals[64])
    return xs, ys


def zeros(rows: int, cols: int):
    return [[0.0 for _ in range(cols)] for _ in range(rows)]


def make_model(sizes, rng: random.Random):
    weights, biases = [], []
    for fan_in, fan_out in zip(sizes, sizes[1:]):
        scale = math.sqrt(2.0 / fan_in)
        weights.append([[rng.gauss(0.0, scale) for _ in range(fan_in)] for _ in range(fan_out)])
        biases.append([0.0 for _ in range(fan_out)])
    return weights, biases


def relu(x: float) -> float:
    return x if x > 0 else 0.0


def softmax(z):
    m = max(z)
    ex = [math.exp(v - m) for v in z]
    s = sum(ex)
    return [v / s for v in ex]


def forward(weights, biases, x):
    activations = [x]
    preacts = []
    a = x
    for li, (W, B) in enumerate(zip(weights, biases)):
        z = []
        for row, b in zip(W, B):
            z.append(b + sum(w * av for w, av in zip(row, a)))
        preacts.append(z)
        a = softmax(z) if li == len(weights) - 1 else [relu(v) for v in z]
        activations.append(a)
    return activations, preacts


def train_epoch(weights, biases, xs, ys, lr, rng):
    order = list(range(len(xs)))
    rng.shuffle(order)
    loss = 0.0
    for idx in order:
        x, y = xs[idx], ys[idx]
        acts, zs = forward(weights, biases, x)
        probs = acts[-1]
        loss -= math.log(max(1e-9, probs[y]))

        deltas = [None for _ in weights]
        out = probs[:]
        out[y] -= 1.0
        deltas[-1] = out
        for li in range(len(weights) - 2, -1, -1):
            next_delta = deltas[li + 1]
            next_W = weights[li + 1]
            cur = []
            for i, z in enumerate(zs[li]):
                s = 0.0
                for j in range(len(next_delta)):
                    s += next_W[j][i] * next_delta[j]
                cur.append(s if z > 0 else 0.0)
            deltas[li] = cur

        for li in range(len(weights)):
            prev = acts[li]
            for j in range(len(weights[li])):
                d = deltas[li][j]
                biases[li][j] -= lr * d
                row = weights[li][j]
                for i in range(len(row)):
                    row[i] -= lr * d * prev[i]
    return loss / len(xs)


def accuracy(weights, biases, xs, ys):
    ok = 0
    for x, y in zip(xs, ys):
        probs = forward(weights, biases, x)[0][-1]
        pred = max(range(len(probs)), key=lambda i: probs[i])
        ok += int(pred == y)
    return ok / len(xs)


def quantize_matrix(matrix, places=4):
    return [[round(v, places) for v in row] for row in matrix]


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    download(TRAIN_URL, RAW / "optdigits.tra")
    download(TEST_URL, RAW / "optdigits.tes")
    train_x, train_y = load_csv(RAW / "optdigits.tra")
    test_x, test_y = load_csv(RAW / "optdigits.tes")

    rng = random.Random(42)
    sizes = [64, 96, 48, 10]
    weights, biases = make_model(sizes, rng)
    # A compact real training run. Full accuracy is less important than real weights
    # and real activations for the visualization prototype.
    for epoch in range(7):
        loss = train_epoch(weights, biases, train_x, train_y, 0.012, rng)
        acc = accuracy(weights, biases, test_x[:600], test_y[:600])
        print(f"epoch={epoch + 1} loss={loss:.4f} acc600={acc:.3f}")

    test_acc = accuracy(weights, biases, test_x, test_y)
    model = {
        "dataset": "UCI Optical Recognition of Handwritten Digits",
        "source": TRAIN_URL,
        "architecture": sizes,
        "learning": "MLP + ReLU + Softmax + SGD",
        "testAccuracy": round(test_acc, 4),
        "weights": [quantize_matrix(w) for w in weights],
        "biases": [[round(v, 4) for v in b] for b in biases],
    }
    (DATA / "model.json").write_text(json.dumps(model, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    samples = []
    by_digit = {i: 0 for i in range(10)}
    for x, y in zip(test_x, test_y):
        if by_digit[y] < 3:
            samples.append({"label": y, "pixels": [round(v, 4) for v in x]})
            by_digit[y] += 1
        if all(v >= 3 for v in by_digit.values()):
            break
    (DATA / "samples.json").write_text(json.dumps({"samples": samples}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {DATA / 'model.json'}")
    print(f"wrote {DATA / 'samples.json'}")
    print(f"test accuracy={test_acc:.3f}")


if __name__ == "__main__":
    main()

