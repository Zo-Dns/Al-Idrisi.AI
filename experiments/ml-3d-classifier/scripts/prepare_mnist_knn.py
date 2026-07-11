"""Prepare a reproducible MNIST subset for the 3D k-NN lab.

The browser receives real images, real 49-dimensional visual features and the
official train/test split. It recomputes every distance and vote itself.
"""

from __future__ import annotations

import base64
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
LABELS = {
    1: {"ar": "الرقم 1", "color": "#69c9ff"},
    4: {"ar": "الرقم 4", "color": "#f7a6d9"},
    7: {"ar": "الرقم 7", "color": "#ffd166"},
}
TRAIN_PER_CLASS = 70
TEST_PER_CLASS = 30
K = 5
SEED = 20260711


def download(name: str) -> Path:
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / FILES[name]
    if not path.exists():
        url = f"{BASE_URL}/{path.name}"
        print(f"downloading {url}")
        with urllib.request.urlopen(url, timeout=60) as response:
            path.write_bytes(response.read())
    return path


def load_images(path: Path) -> np.ndarray:
    with gzip.open(path, "rb") as f:
        magic, count, rows, cols = struct.unpack(">IIII", f.read(16))
        if (magic, rows, cols) != (2051, 28, 28):
            raise ValueError("unexpected MNIST image header")
        return np.frombuffer(f.read(), dtype=np.uint8).reshape(count, rows, cols)


def load_labels(path: Path) -> np.ndarray:
    with gzip.open(path, "rb") as f:
        magic, count = struct.unpack(">II", f.read(8))
        if magic != 2049:
            raise ValueError("unexpected MNIST label header")
        labels = np.frombuffer(f.read(), dtype=np.uint8)
    if len(labels) != count:
        raise ValueError("MNIST label count mismatch")
    return labels.astype(np.int64)


def choose(images: np.ndarray, labels: np.ndarray, count: int, rng: np.random.Generator):
    selected = []
    for label in LABELS:
        candidates = np.flatnonzero(labels == label)
        selected.extend(rng.choice(candidates, count, replace=False).tolist())
    selected = np.asarray(selected, dtype=np.int64)
    rng.shuffle(selected)
    return images[selected], labels[selected]


def pooled(images: np.ndarray) -> np.ndarray:
    """Average-pool 28x28 images to 7x7 feature vectors."""
    return images.reshape(-1, 7, 4, 7, 4).mean(axis=(2, 4)).reshape(len(images), -1) / 255.0


def knn_predict(train_x: np.ndarray, train_y: np.ndarray, query: np.ndarray):
    squared_distances = ((train_x - query) ** 2).sum(axis=1)
    nearest = np.argsort(squared_distances)[:K]
    weights = 1.0 / np.maximum(squared_distances[nearest], 1e-9)
    votes = {int(label): 0.0 for label in LABELS}
    for index, weight in zip(nearest, weights):
        votes[int(train_y[index])] += float(weight)
    return max(votes, key=votes.get), nearest, squared_distances[nearest]


def encode_image(image: np.ndarray) -> str:
    return base64.b64encode(image.astype(np.uint8).tobytes()).decode("ascii")


def export_item(image, label, feature, point, **extra):
    item = {
        "label": int(label),
        "imageGray": encode_image(image),
        "feature": np.round(feature, 6).tolist(),
        "point": np.round(point, 6).tolist(),
    }
    item.update(extra)
    return item


def main():
    rng = np.random.default_rng(SEED)
    train_images = load_images(download("train_images"))
    train_labels = load_labels(download("train_labels"))
    test_images = load_images(download("test_images"))
    test_labels = load_labels(download("test_labels"))
    chosen_train_images, chosen_train_labels = choose(train_images, train_labels, TRAIN_PER_CLASS, rng)
    chosen_test_images, chosen_test_labels = choose(test_images, test_labels, TEST_PER_CLASS, rng)

    raw_train = pooled(chosen_train_images)
    raw_test = pooled(chosen_test_images)
    mean = raw_train.mean(axis=0)
    std = np.maximum(raw_train.std(axis=0), 1e-6)
    x_train = (raw_train - mean) / std
    x_test = (raw_test - mean) / std

    # PCA is fit only on training features; k-NN still uses all 49 dimensions.
    _, _, vt = np.linalg.svd(x_train, full_matrices=False)
    components = vt[:3]
    train_points = x_train @ components.T
    test_points = x_test @ components.T
    point_scale = np.maximum(train_points.std(axis=0), 1e-6)
    train_points /= point_scale
    test_points /= point_scale

    predictions = []
    confusion = {str(label): {str(other): 0 for other in LABELS} for label in LABELS}
    for query, truth in zip(x_test, chosen_test_labels):
        prediction, neighbours, distances = knn_predict(x_train, chosen_train_labels, query)
        confusion[str(int(truth))][str(prediction)] += 1
        predictions.append((prediction, neighbours, distances))
    accuracy = float(np.mean([prediction[0] == int(truth) for prediction, truth in zip(predictions, chosen_test_labels)]))

    training = [
        export_item(image, label, feature, point, id=index)
        for index, (image, label, feature, point) in enumerate(zip(chosen_train_images, chosen_train_labels, x_train, train_points))
    ]
    testing = [
        export_item(image, label, feature, point, id=index, exportedPrediction=int(prediction), neighbourIndexes=[int(index) for index in neighbours])
        for index, (image, label, feature, point, (prediction, neighbours, _)) in enumerate(zip(chosen_test_images, chosen_test_labels, x_test, test_points, predictions))
    ]
    payload = {
        "schema": 1,
        "dataset": "MNIST handwritten digits",
        "datasetSource": BASE_URL,
        "classes": {str(label): value for label, value in LABELS.items()},
        "featureMethod": "28x28 grayscale → 7x7 average pooling → training-set standardization (49 features)",
        "classifier": {"name": "distance-weighted k-nearest neighbours", "k": K, "decisionSpace": "all 49 standardized features"},
        "projection": {"name": "PCA", "fit": "training features only", "dimensions": 3, "note": "3D coordinates are explanatory only; they are not used for k-NN distances."},
        "split": {"trainPerClass": TRAIN_PER_CLASS, "testPerClass": TEST_PER_CLASS, "seed": SEED},
        "testAccuracy": round(accuracy, 6),
        "confusion": confusion,
        "training": training,
        "testing": testing,
    }
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "mnist-knn.json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    correct = sum(prediction[0] == int(truth) for prediction, truth in zip(predictions, chosen_test_labels))
    print(f"wrote {DATA / 'mnist-knn.json'}")
    print(f"test accuracy={accuracy:.4f} ({correct}/{len(chosen_test_labels)})")


if __name__ == "__main__":
    main()
