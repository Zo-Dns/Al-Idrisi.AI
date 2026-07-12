# 3D Loss-Landscape Lab — real surfaces, published optimizers, live proofs

Interactive 3D visualization of how gradient-based optimization actually
works. Every surface height is the true function value computed at load time
(no baked meshes), and every optimizer executes its published update rule
verbatim — nothing is a recorded animation.

## The three surfaces (each honestly labeled in the UI)

1. **Hubble 1929 — a real model's loss (convex MSE).** Linear regression
   `v = w·r + b` on the 24 nebulae of Table 1 from Hubble's 1929 paper.
   The surface is the exact mean-squared-error `J(w, b)`: a convex paraboloid
   with a single minimum at the least-squares solution — the slope at the
   bottom *is* the Hubble constant in km/s per Mpc. A gold pin marks the
   closed-form normal-equations solution. **Historical honesty:** 1929
   distances carry a known systematic calibration error, so the fitted
   `H₀ ≈ 454` is ~6-7× the modern value (≈70); the correctness of the fit
   itself is independent of that data error — and that distinction is itself
   one of the lab's lessons. No local minima are claimed on this surface:
   a quadratic loss has none.
2. **Rosenbrock 1960 — standard optimizer test function** (explicitly labeled
   *not* a model's loss): `f = (1−x)² + 100(y−x²)²`, the classic narrow
   curved valley with the global minimum at (1, 1). Lesson: plain gradient
   descent zigzags and crawls; momentum accumulates velocity along the valley.
3. **Himmelblau 1972 — standard test function** (same explicit label):
   `f = (x²+y−11)² + (x+y²−7)²` with four equal global minima (all `f = 0`).
   (3, 2) is an exact integer root; the other three are refined to machine
   precision by Newton's method at load. Lesson: which basin you land in is
   decided by initialization — click anywhere on the surface to move the
   starting point.

## What is real

- Surface heights: direct evaluation of the loss/test function on a 121×121
  grid (verified grid-equals-function in the test suite). Display height is
  log-compressed (`log1p`) for readability — the UI discloses this and all
  numeric readouts are raw values.
- Gradients: exact analytic formulas, verified against central finite
  differences (worst relative error ~1e-9 across all three surfaces).
- Optimizers, verbatim from the sources:
  - Gradient descent (Cauchy 1847): `θ ← θ − lr·∇J`.
  - Momentum / heavy ball (Polyak 1964; implemented as Goodfellow et al.
    2016, Algorithm 8.2): `v ← α·v − lr·∇J; θ ← θ + v`.
  - Adam (Kingma & Ba 2015, Algorithm 1, including bias correction):
    `m̂ = m/(1−β₁ᵗ)`, `v̂ = v/(1−β₂ᵗ)`, `θ ← θ − lr·m̂/(√v̂+ε)`.
- Convergence theory made tangible: for the quadratic Hubble surface the
  exact stability threshold `lr < 2/λmax(H)` is computed from the Hessian's
  closed-form eigenvalues and marked on the learning-rate slider — cross it
  and watch divergence begin, exactly where theory predicts.

## Live proofs (recomputed in the browser at every load)

Gradient check across all three surfaces · OLS matches the literature values
for Hubble's Table 1 (slope ≈ 454.16, intercept ≈ −40.78) · gradient descent
converges to the closed-form solution (Δ ~ 1e-13) · Adam's step-1 identity
`m̂₁ = g` · monotone descent below `2/λmax` and divergence above it.

## Verify

```powershell
node experiments\loss-landscape-3d\loss-landscape-test.mjs
```

13 checks: Hubble table shape; OLS vs literature; stationarity of the
closed form; GD→closed-form convergence; gradient checks; exact Rosenbrock
minimum; Himmelblau's four minima at machine precision; Newton refinement;
Adam step-1 identity; momentum vs hand recurrence; both sides of the 2/λmax
threshold; surface-grid consistency.

It reuses the Three.js vendor bundle of the neighbouring `nn-3d-simulation`
project (same documented coupling as the other labs — copy the vendor if
that project is removed). `src/math.js` is dependency-free and imported by
both the browser scene and the node test suite, so the tests exercise the
shipped math itself.

## Sources

1. E. Hubble (1929), *A relation between distance and radial velocity among
   extra-galactic nebulae*, PNAS 15(3):168–173 (Table 1).
2. A. Cauchy (1847), *Méthode générale pour la résolution des systèmes
   d'équations simultanées*, C. R. Acad. Sci. Paris 25:536–538.
3. B. T. Polyak (1964), *Some methods of speeding up the convergence of
   iteration methods*, USSR Comput. Math. & Math. Phys. 4(5):1–17.
4. D. P. Kingma & J. Ba (2015), *Adam: A Method for Stochastic
   Optimization*, ICLR. https://arxiv.org/abs/1412.6980
5. H. H. Rosenbrock (1960), *An automatic method for finding the greatest
   or least value of a function*, The Computer Journal 3(3):175–184.
6. D. M. Himmelblau (1972), *Applied Nonlinear Programming*, McGraw-Hill.
7. I. Goodfellow, Y. Bengio & A. Courville (2016), *Deep Learning*,
   MIT Press — ch. 4 (numerical optimization, quadratic analysis) and
   ch. 8 (Algorithm 8.2, optimizer families).
8. H. Li et al. (2018), *Visualizing the Loss Landscape of Neural Nets*,
   NeurIPS — context for loss-surface visualization practice.

Note on scope: every optimizer here is **full-batch** (deterministic) — the
gradient is computed over all data points each step. Stochastic / minibatch
gradient descent (Robbins & Monro 1951) is deliberately not implemented, so
it is not cited as a basis; the UI and wiring name plain "gradient descent",
never "SGD".
