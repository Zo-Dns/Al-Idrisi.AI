"""Train a compact MLP on real MNIST 28x28 digits.

Outputs:
  ../data/model.json
  ../data/samples.json

This script uses NumPy for a reproducible mini-batch SGD run, but the exported
model is plain JSON consumed directly by the browser visualization.
"""

from __future__ import annotations

import gzip
import json
import struct
import urllib.request
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw" / "mnist"
BASE_URL = "https://storage.googleapis.com/cvdf-datasets/mnist"
FILES = {
    "train_images": "train-images-idx3-ubyte.gz",
    "train_labels": "train-labels-idx1-ubyte.gz",
    "test_images": "t10k-images-idx3-ubyte.gz",
    "test_labels": "t10k-labels-idx1-ubyte.gz",
}


def download(name: str) -> Path:
    RAW.mkdir(parents=True, exist_ok=True)
    filename = FILES[name]
    path = RAW / filename
    if not path.exists():
        url = f"{BASE_URL}/{filename}"
        print(f"downloading {url}")
        with urllib.request.urlopen(url, timeout=60) as response:
            path.write_bytes(response.read())
    return path


def load_images(path: Path) -> np.ndarray:
    with gzip.open(path, "rb") as f:
        magic, count, rows, cols = struct.unpack(">IIII", f.read(16))
        if magic != 2051 or rows != 28 or cols != 28:
            raise ValueError(f"unexpected image file header: {magic}, {rows}x{cols}")
        data = np.frombuffer(f.read(), dtype=np.uint8).reshape(count, rows * cols)
    return data.astype(np.float32) / 255.0


def load_labels(path: Path) -> np.ndarray:
    with gzip.open(path, "rb") as f:
        magic, count = struct.unpack(">II", f.read(8))
        if magic != 2049:
            raise ValueError(f"unexpected label file header: {magic}")
        data = np.frombuffer(f.read(), dtype=np.uint8)
    if len(data) != count:
        raise ValueError("label count mismatch")
    return data.astype(np.int64)


def relu(x: np.ndarray) -> np.ndarray:
    return np.maximum(x, 0.0)


def softmax(logits: np.ndarray) -> np.ndarray:
    logits = logits - logits.max(axis=1, keepdims=True)
    exps = np.exp(logits)
    return exps / exps.sum(axis=1, keepdims=True)


def forward(weights, biases, x: np.ndarray):
    z1 = x @ weights[0].T + biases[0]
    a1 = relu(z1)
    z2 = a1 @ weights[1].T + biases[1]
    a2 = relu(z2)
    logits = a2 @ weights[2].T + biases[2]
    probs = softmax(logits)
    return z1, a1, z2, a2, probs


def accuracy(weights, biases, x: np.ndarray, y: np.ndarray) -> float:
    probs = forward(weights, biases, x)[-1]
    return float((probs.argmax(axis=1) == y).mean())


def train():
    train_x = load_images(download("train_images"))
    train_y = load_labels(download("train_labels"))
    test_x = load_images(download("test_images"))
    test_y = load_labels(download("test_labels"))

    rng = np.random.default_rng(42)
    sizes = [784, 96, 48, 10]
    weights = [
        (rng.normal(0.0, np.sqrt(2.0 / fan_in), size=(fan_out, fan_in))).astype(np.float32)
        for fan_in, fan_out in zip(sizes, sizes[1:])
    ]
    biases = [np.zeros(fan_out, dtype=np.float32) for fan_out in sizes[1:]]

    batch_size = 128
    lr = 0.075
    epochs = 8
    n = len(train_x)

    for epoch in range(epochs):
        order = rng.permutation(n)
        total_loss = 0.0
        for start in range(0, n, batch_size):
            idx = order[start:start + batch_size]
            x = train_x[idx]
            y = train_y[idx]
            z1, a1, z2, a2, probs = forward(weights, biases, x)
            total_loss -= float(np.log(np.maximum(probs[np.arange(len(y)), y], 1e-9)).sum())

            dz3 = probs
            dz3[np.arange(len(y)), y] -= 1.0
            dz3 /= len(y)
            dW3 = dz3.T @ a2
            db3 = dz3.sum(axis=0)

            da2 = dz3 @ weights[2]
            dz2 = da2 * (z2 > 0)
            dW2 = dz2.T @ a1
            db2 = dz2.sum(axis=0)

            da1 = dz2 @ weights[1]
            dz1 = da1 * (z1 > 0)
            dW1 = dz1.T @ x
            db1 = dz1.sum(axis=0)

            weights[2] -= lr * dW3.astype(np.float32)
            biases[2] -= lr * db3.astype(np.float32)
            weights[1] -= lr * dW2.astype(np.float32)
            biases[1] -= lr * db2.astype(np.float32)
            weights[0] -= lr * dW1.astype(np.float32)
            biases[0] -= lr * db1.astype(np.float32)

        lr *= 0.86
        acc = accuracy(weights, biases, test_x[:3000], test_y[:3000])
        print(f"epoch={epoch + 1} loss={total_loss / n:.4f} acc3000={acc:.4f}")

    test_acc = accuracy(weights, biases, test_x, test_y)
    DATA.mkdir(parents=True, exist_ok=True)
    model = {
        "dataset": "MNIST handwritten digits",
        "source": f"{BASE_URL}/{FILES['train_images']}",
        "architecture": sizes,
        "learning": "MLP + ReLU + Softmax + mini-batch SGD",
        "testAccuracy": round(test_acc, 4),
        "inputShape": [28, 28],
        "weights": [np.round(w, 4).tolist() for w in weights],
        "biases": [np.round(b, 4).tolist() for b in biases],
    }
    (DATA / "model.json").write_text(
        json.dumps(model, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    samples = []
    per_digit = {i: 0 for i in range(10)}
    for x, y in zip(test_x, test_y):
        digit = int(y)
        if per_digit[digit] < 3:
            samples.append({
                "label": digit,
                "pixels": np.round(x, 4).tolist(),
            })
            per_digit[digit] += 1
        if all(v >= 3 for v in per_digit.values()):
            break

    (DATA / "samples.json").write_text(
        json.dumps({"samples": samples}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"wrote {DATA / 'model.json'}")
    print(f"wrote {DATA / 'samples.json'}")
    print(f"test accuracy={test_acc:.4f}")


if __name__ == "__main__":
    train()
