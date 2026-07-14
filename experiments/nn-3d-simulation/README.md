# 3D Neural Network Simulation

Independent scientific 3D neural-network visualization linked from the Atlas
laboratory directory. Its code remains isolated from the main Atlas build, but
the published Atlas expects this directory to remain available.

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
npm run serve
```

Open:

```text
http://127.0.0.1:8087/experiments/nn-3d-simulation/
```

The earlier prototype interface was removed; the directory URL now opens the
current cube-based visualization directly.

## Regenerate Data

Install NumPy in your Python environment, then run:

```powershell
python experiments/nn-3d-simulation/scripts/train_mnist.py
```
