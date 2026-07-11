import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("./data/mnist-knn.json", import.meta.url), "utf8"));
const fail = (name, detail) => { console.error(`FAIL | ${name} | ${detail}`); process.exitCode = 1; };
const pass = (name, detail) => console.log(`PASS | ${name} | ${detail}`);

const labels = Object.keys(data.classes).map(Number);
const k = data.classifier.k;
if (data.training.length === 210 && data.testing.length === 90) pass("official-split-subset-size", "train=210 test=90");
else fail("official-split-subset-size", `train=${data.training.length} test=${data.testing.length}`);

const all = [...data.training, ...data.testing];
if (all.every((item) => item.feature.length === 49 && item.point.length === 3 && labels.includes(item.label))) pass("feature-and-projection-shapes", "49 features, 3D PCA points");
else fail("feature-and-projection-shapes", "malformed item");

function classify(sample) {
  const nearest = data.training.map((candidate, index) => {
    let d2 = 0;
    for (let i = 0; i < 49; i++) d2 += (candidate.feature[i] - sample.feature[i]) ** 2;
    return { index, d2 };
  }).sort((a, b) => a.d2 - b.d2).slice(0, k);
  const votes = Object.fromEntries(labels.map((label) => [label, 0]));
  for (const item of nearest) votes[data.training[item.index].label] += 1 / Math.max(item.d2, 1e-9);
  const prediction = Number(Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0]);
  return { prediction, nearest };
}

let exact = 0;
let correct = 0;
for (const sample of data.testing) {
  const result = classify(sample);
  if (result.prediction === sample.exportedPrediction) exact++;
  if (result.prediction === sample.label) correct++;
}
if (exact === data.testing.length) pass("browser-knn-matches-export", `${exact}/${data.testing.length}`);
else fail("browser-knn-matches-export", `${exact}/${data.testing.length}`);

const accuracy = correct / data.testing.length;
if (Math.abs(accuracy - data.testAccuracy) < 1e-6) pass("reported-test-accuracy", `${correct}/${data.testing.length} = ${(accuracy * 100).toFixed(2)}%`);
else fail("reported-test-accuracy", `computed=${accuracy} exported=${data.testAccuracy}`);

const rows = labels.map(String);
const rowSums = rows.map((truth) => rows.reduce((sum, pred) => sum + data.confusion[truth][pred], 0));
const diagonal = rows.reduce((sum, label) => sum + data.confusion[label][label], 0);
if (rowSums.every((v) => v === 30) && diagonal === correct) pass("confusion-matrix-consistent", `rows=${rowSums.join("/")} diagonal=${diagonal}`);
else fail("confusion-matrix-consistent", `rowSums=${rowSums} diagonal=${diagonal} correct=${correct}`);

if (!process.exitCode) console.log("\nALL ML 3D CLASSIFIER TESTS PASSED");
