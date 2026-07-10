# 3D Neural Network Simulation

Independent side experiment for a scientific 3D neural-network visualization.
It is isolated from the Atlas code and can be removed without touching the main
project.

## Current Model

- Dataset: real MNIST handwritten digits.
- Input: `28 x 28 = 784` pixels.
- Architecture: `784 -> 96 -> 48 -> 10`.
- Learning: `MLP + ReLU + Softmax + mini-batch SGD`.
- Test accuracy: about `96.57%`.
- Total weights: `784x96 + 96x48 + 48x10 = 80,352`.
- Biases: `96 + 48 + 10 = 154`.
- Total parameters: `80,352 + 154 = 80,506`.

The "more/less connections" control changes only how many trained weights are
drawn in the 3D scene. It does not change the trained model, the input size, or
the output probabilities.

## Run

From the project root:

```powershell
cd E:\AI-Atlas-Project
python -m http.server 8765 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:8765/experiments/nn-3d-simulation/
```

The earlier prototype interface was removed; the directory URL now opens the
current cube-based visualization directly.

## Regenerate Data

Use the bundled Codex Python if NumPy is not installed in the system Python:

```powershell
& "C:\Users\larjo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" experiments\nn-3d-simulation\scripts\train_mnist.py
```
