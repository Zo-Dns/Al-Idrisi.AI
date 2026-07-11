# 3D LLM Lab — a real miniature GPT, trained on the Atlas itself

Interactive 3D visualization of how a language model works, driven by a REAL
transformer whose full forward pass (attention, causal masking, softmax,
autoregressive sampling) is recomputed live in the browser — no mockups.

It reuses the Three.js vendor bundle of the neighbouring `nn-3d-simulation`
project (documented coupling — copy the vendor if that project is removed).

## The model (faithful GPT-2-style architecture, miniaturized)

- **Corpus:** the Atlas's own Arabic node texts (`d:` and journey `t:` strings
  extracted from the 11 content files) — ~173k characters, char-level vocab.
- **Architecture:** 2 pre-LN transformer blocks, 4 attention heads, d_model 64,
  d_ff 256, context 64, tied embedding head, tanh-GELU, causal mask.
- **Training:** pure-numpy AdamW (warmup + cosine), residual-scaled init,
  and a **mandatory numerical gradient check** that must pass before training
  starts (144 probes; run aborts otherwise).
- **Honesty:** the equations are exactly GPT's; the scale is millions of times
  smaller, so expect Arabic-looking atlas-flavoured text, not intelligence.
  The lab's UI says this explicitly.

## What the browser recomputes (nothing is played back)

Every generation step runs the full forward pass in JavaScript from the
exported weights: token+positional embeddings, per-head q·kᵀ/√d, causal
softmax, value mixing, MLP, tied-head logits, temperature sampling. The
attention arcs you see are the actual weights of the current pass.

## Verify

```powershell
node experiments\llm-3d-lab\tiny-gpt-test.mjs
```

Eight checks: parameter count recomputed from dimensions, tokenizer roundtrip,
last-position logits vs training reference (computed from the same rounded
weights, so the match is ~1e-6), attention matrix vs reference + rows sum to 1
+ zero weight to the future, a by-hand q·k/√d recomputation, greedy generation
reproducing the reference text character-for-character (including a step-10
logits checkpoint), and entropy rising monotonically with temperature.

## Regenerate (train from scratch)

```powershell
& "C:\Users\larjo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" experiments\llm-3d-lab\scripts\train_tiny_gpt.py
```

Fixed seed; the gradient check runs first and aborts on failure. References in
the exported JSON are computed from the rounded weights, so the browser can be
held to a strict tolerance.

## Sources

1. A. Vaswani et al. (2017), *Attention Is All You Need*, NeurIPS.
   https://arxiv.org/abs/1706.03762
2. A. Radford et al. (2019), *Language Models are Unsupervised Multitask
   Learners* (GPT-2) — architecture conventions (pre-LN placement per the
   released code, tied embeddings, GELU).
3. D. Hendrycks and K. Gimpel (2016), *Gaussian Error Linear Units (GELUs)*.
   https://arxiv.org/abs/1606.08415
