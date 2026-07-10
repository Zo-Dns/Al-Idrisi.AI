export function relu(x) {
  return x > 0 ? x : 0;
}

export function softmax(logits) {
  const m = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

export function forward(model, input) {
  const activations = [input.slice()];
  const preacts = [];
  let a = input;
  for (let l = 0; l < model.weights.length; l++) {
    const W = model.weights[l];
    const B = model.biases[l];
    const z = W.map((row, j) => {
      let s = B[j];
      for (let i = 0; i < row.length; i++) s += row[i] * a[i];
      return s;
    });
    preacts.push(z);
    a = l === model.weights.length - 1 ? softmax(z) : z.map(relu);
    activations.push(a);
  }
  return { activations, preacts, probs: activations[activations.length - 1] };
}

export function crossEntropy(probs, label) {
  return -Math.log(Math.max(1e-9, probs[label]));
}

export function argmax(values) {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return best;
}

export function formatInt(n) {
  return Math.round(n).toLocaleString("en-US");
}

