import * as THREE from "../vendor/three/three.module.js";
import { OrbitControls } from "../vendor/three/OrbitControls.js";
import { argmax, crossEntropy, formatInt, forward } from "./network.js";

const state = {
  model: null,
  samples: [],
  sampleIndex: 0,
  pass: null,
  autoOrbit: true,
  signalsPlaying: true,
  signalStartTime: 0,
  lineMode: 0,
  shownWeights: 0,
  contributionDots: 0,
  contributionMassCoverage: 0,
  visibleMassCoverage: 0,
};

const lineRatios = [0.08, 0.22, 0.45];
const dotBudgets = [260, 560, 980];
const OUTPUT_DIGIT_OFFSET = 24;
const OUTPUT_SELECTED_BLUE = 0x2f76d2;
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x081021);
scene.fog = new THREE.FogExp2(0x081021, 0.0009);

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 6000);
camera.position.set(560, 185, 455);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.36;
controls.enablePan = false;
controls.minDistance = 330;
controls.maxDistance = 1200;

scene.add(new THREE.AmbientLight(0x9eb4d6, 0.34));
const keyLight = new THREE.PointLight(0xffffff, 42, 1800);
keyLight.position.set(-420, 260, 360);
scene.add(keyLight);
const rimLight = new THREE.PointLight(0x9ecfff, 30, 1700);
rimLight.position.set(420, 120, -380);
scene.add(rimLight);

const group = new THREE.Group();
group.rotation.y = -0.18;
scene.add(group);

let cubeMeshes = [];
let positionsByLayer = [];
let weightLines = null;
let activeLines = null;
let labelSprites = [];
let outputDigitSprites = [];
let outputGlowMesh = null;
let flowSignalDots = null;
let flowSignalData = [];
let inputSignalMesh = null;

const cubeGeo = new THREE.BoxGeometry(8.5, 8.5, 8.5);
const inputPanelGeo = new THREE.BoxGeometry(9.5, 9.5, 3.2);
const inputSignalGeo = new THREE.BoxGeometry(12.6, 12.6, 2.4);
const outputCubeGeo = new THREE.BoxGeometry(10.5, 10.5, 10.5);
const outputGlowGeo = new THREE.SphereGeometry(16, 24, 16);
const flowSignalDotGeo = new THREE.SphereGeometry(2.4, 12, 8);
const tempObj = new THREE.Object3D();
const tempColor = new THREE.Color();

const mats = {
  input: new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.58, depthWrite: false, side: THREE.DoubleSide }),
  inputSignal: new THREE.MeshBasicMaterial({ color: 0x4aa3ff, vertexColors: true, transparent: true, opacity: 1, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
  hidden: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, emissive: 0x050505, roughness: 0.58 }),
  output: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, emissive: 0x2d2200, roughness: 0.32 }),
  outputGlow: new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.62, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
  flowSignalDot: new THREE.MeshBasicMaterial({ color: 0x010101, transparent: true, opacity: 0.94, depthTest: false, depthWrite: false }),
};

function getInputSide() {
  return Math.round(Math.sqrt(state.model?.architecture?.[0] || 64));
}

function weightFormula(arch) {
  return arch.slice(0, -1).map((n, i) => `${n}x${arch[i + 1]}`).join(" + ");
}

function fmt(n, digits = 3) {
  if (!Number.isFinite(n)) return "0";
  const v = Math.abs(n);
  if (v >= 100) return n.toFixed(1);
  if (v >= 10) return n.toFixed(2);
  return n.toFixed(digits);
}

function vectorNorm(values) {
  return Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
}

function countPositive(values) {
  return values.reduce((sum, v) => sum + (v > 0 ? 1 : 0), 0);
}

function topIndexes(values, limit = 2) {
  return values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener("resize", resize);
resize();

function jitter(seed, amplitude) {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return (v - Math.floor(v) - 0.5) * amplitude;
}

function layerPoint(layer, index, count) {
  const xs = [-285, -95, 90, 270];
  if (layer === 0) {
    const side = getInputSide();
    const spacing = side > 8 ? 6.4 : 18;
    const col = index % side;
    const row = Math.floor(index / side);
    return new THREE.Vector3(xs[layer], ((side - 1) / 2 - row) * spacing, (col - (side - 1) / 2) * spacing);
  }
  if (layer === 3) {
    return new THREE.Vector3(xs[layer], (index - 4.5) * 19, 0);
  }

  const rows = layer === 1 ? 12 : 8;
  const cols = Math.ceil(count / rows);
  const col = index % cols;
  const row = Math.floor(index / cols);
  return new THREE.Vector3(
    xs[layer] + jitter(index + layer * 100, 30),
    (row - (rows - 1) / 2) * 18 + jitter(index + layer * 200, 12),
    (col - (cols - 1) / 2) * 18 + jitter(index + layer * 300, 46)
  );
}

function makeTextSprite(text, options = {}) {
  const {
    color = "#ffffff",
    fontSize = 56,
    width = 512,
    height = 128,
    scale = [95, 24],
  } = options;
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = width;
  labelCanvas.height = height;
  const ctx = labelCanvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.font = `700 ${fontSize}px Segoe UI, Tahoma, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(labelCanvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
  sprite.scale.set(scale[0], scale[1], 1);
  sprite.renderOrder = 5;
  labelSprites.push(sprite);
  return sprite;
}

async function loadData() {
  const [model, samples] = await Promise.all([
    fetch("./data/model.json").then((r) => r.json()),
    fetch("./data/samples.json").then((r) => r.json()),
  ]);
  state.model = model;
  state.samples = samples.samples;
  state.pass = forward(model, state.samples[0].pixels);
  buildScene();
  updateSample();
  updateHud();
  document.getElementById("loading").classList.add("hide");
}

function buildScene() {
  group.clear();
  cubeMeshes = [];
  labelSprites = [];
  outputDigitSprites = [];
  outputGlowMesh = null;
  flowSignalDots = null;
  flowSignalData = [];
  inputSignalMesh = null;
  positionsByLayer = state.model.architecture.map((count, layer) =>
    Array.from({ length: count }, (_, i) => layerPoint(layer, i, count))
  );

  for (let layer = 0; layer < positionsByLayer.length; layer++) {
    const geo = layer === 0 ? inputPanelGeo : (layer === positionsByLayer.length - 1 ? outputCubeGeo : cubeGeo);
    const mat = layer === 0 ? mats.input : (layer === positionsByLayer.length - 1 ? mats.output : mats.hidden);
    const mesh = new THREE.InstancedMesh(geo, mat, positionsByLayer[layer].length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(positionsByLayer[layer].length * 3), 3);
    group.add(mesh);
    cubeMeshes.push(mesh);
  }

  inputSignalMesh = new THREE.InstancedMesh(inputSignalGeo, mats.inputSignal, positionsByLayer[0].length);
  inputSignalMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inputSignalMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(positionsByLayer[0].length * 3), 3);
  inputSignalMesh.renderOrder = 9;
  group.add(inputSignalMesh);

  outputGlowMesh = new THREE.InstancedMesh(outputGlowGeo, mats.outputGlow, positionsByLayer[3].length);
  outputGlowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  outputGlowMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(positionsByLayer[3].length * 3), 3);
  outputGlowMesh.renderOrder = 24;
  outputGlowMesh.visible = false;
  group.add(outputGlowMesh);

  addLabels();
  rebuildLines();
}

function addLabels() {
  const inputSide = getInputSide();
  const layerLabels = [
    [`INPUT ${inputSide}x${inputSide}`, 0, "#e7fbff"],
    [`HIDDEN ${state.model.architecture[1]}`, 1, "#b7d9ff"],
    [`HIDDEN ${state.model.architecture[2]}`, 2, "#b7d9ff"],
    ["OUTPUT 0-9", 3, "#ffd166"],
  ];
  for (const [text, layer, color] of layerLabels) {
    const pts = positionsByLayer[layer];
    const maxY = Math.max(...pts.map((p) => p.y));
    const sprite = makeTextSprite(text, { color, fontSize: 54, scale: [126, 31] });
    sprite.position.set(pts[0].x, maxY + 52, 0);
    group.add(sprite);
  }

  for (let i = 0; i < 10; i++) {
    const p = positionsByLayer[3][i];
    const sprite = makeTextSprite(String(i), { color: "#ffffff", fontSize: 82, width: 128, height: 128, scale: [22, 22] });
    sprite.position.set(p.x + OUTPUT_DIGIT_OFFSET, p.y, p.z);
    sprite.renderOrder = 36;
    sprite.userData.baseScale = 22;
    outputDigitSprites.push(sprite);
    group.add(sprite);
  }
}

function collectWeightCandidates() {
  const candidates = [];
  for (let l = 0; l < state.model.weights.length; l++) {
    const W = state.model.weights[l];
    for (let j = 0; j < W.length; j++) {
      for (let i = 0; i < W[j].length; i++) {
        const w = W[j][i];
        const source = state.pass?.activations?.[l]?.[i] || 0;
        const contribution = source * w;
        const signal = Math.abs(contribution);
        const tie = (((i * 1103515245 + j * 12345 + l * 97) >>> 0) % 1000) / 100000;
        candidates.push({ l, i, j, w, source, contribution, signal, score: Math.abs(w) + tie });
      }
    }
  }
  return candidates;
}

function selectVisibleWeightsByLayer(candidates) {
  const shown = [];
  const ratio = lineRatios[state.lineMode];
  for (let l = 0; l < state.model.weights.length; l++) {
    const layerCandidates = candidates
      .filter((c) => c.l === l)
      .sort((a, b) => b.score - a.score);
    const count = Math.max(1, Math.floor(layerCandidates.length * ratio));
    shown.push(...layerCandidates.slice(0, count));
  }
  return shown;
}

function edgeKey(c) {
  return `${c.l}:${c.i}:${c.j}`;
}

function withRequiredEdges(base, required) {
  const seen = new Set(base.map(edgeKey));
  const merged = base.slice();
  for (const c of required) {
    const key = edgeKey(c);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(c);
    }
  }
  return merged;
}

function selectContributionDotsByLayer(visibleCandidates) {
  const byContribution = visibleCandidates
    .filter((c) => c.signal > 0)
    .sort((a, b) => b.signal - a.signal);
  const totalVisibleMass = byContribution.reduce((sum, c) => sum + c.signal, 0);
  const totalBudget = dotBudgets[state.lineMode];
  const dots = [];
  if (totalVisibleMass <= 0) return dots;

  for (let l = 0; l < state.model.weights.length; l++) {
    const layerCandidates = byContribution.filter((c) => c.l === l);
    const layerMass = layerCandidates.reduce((sum, c) => sum + c.signal, 0);
    if (layerMass <= 0) continue;
    const layerBudget = Math.max(6, Math.round(totalBudget * layerMass / totalVisibleMass));
    dots.push(...layerCandidates.slice(0, Math.min(layerBudget, layerCandidates.length)));
  }
  return dots.sort((a, b) => b.signal - a.signal);
}

function rebuildLines() {
  if (weightLines) group.remove(weightLines);
  if (activeLines) group.remove(activeLines);
  if (flowSignalDots) group.remove(flowSignalDots);
  flowSignalDots = null;
  flowSignalData = [];

  const totalWeights = state.model.weights.reduce((s, W) => s + W.length * W[0].length, 0);
  const candidates = collectWeightCandidates();
  const shown = selectVisibleWeightsByLayer(candidates);
  state.shownWeights = shown.length;
  const totalContributionMass = candidates.reduce((sum, c) => sum + c.signal, 0);
  const visibleContributionMass = shown.reduce((sum, c) => sum + c.signal, 0);

  const positions = [];
  const colors = [];
  for (const c of shown) {
    const a = positionsByLayer[c.l][c.i];
    const b = positionsByLayer[c.l + 1][c.j];
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const weightBrightness = Math.min(1, 0.1 + Math.abs(c.w) * 0.82);
    const signTint = c.w >= 0 ? [0.72, 0.82, 1.0] : [1.0, 0.74, 0.66];
    colors.push(
      signTint[0] * weightBrightness, signTint[1] * weightBrightness, signTint[2] * weightBrightness,
      signTint[0] * weightBrightness, signTint[1] * weightBrightness, signTint[2] * weightBrightness
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  weightLines = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.105, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  group.add(weightLines);

  const active = shown
    .filter((c) => c.signal > 0)
    .sort((a, b) => b.signal - a.signal)
    .slice(0, Math.max(80, Math.round(dotBudgets[state.lineMode] * 0.8)));
  const activePos = [];
  const activeCol = [];
  for (const c of active) {
    if (c.signal <= 0) continue;
    const a = positionsByLayer[c.l][c.i];
    const b = positionsByLayer[c.l + 1][c.j];
    activePos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const bright = Math.min(1, 0.28 + c.signal * 3.2);
    activeCol.push(bright, bright, bright, bright, bright, bright);
  }
  const activeGeo = new THREE.BufferGeometry();
  activeGeo.setAttribute("position", new THREE.Float32BufferAttribute(activePos, 3));
  activeGeo.setAttribute("color", new THREE.Float32BufferAttribute(activeCol, 3));
  activeLines = new THREE.LineSegments(
    activeGeo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  group.add(activeLines);

  const pulseCandidates = selectContributionDotsByLayer(shown);
  const maxPulseSignal = Math.max(1e-9, ...pulseCandidates.map((c) => c.signal));
  const pulseMass = pulseCandidates.reduce((sum, c) => sum + c.signal, 0);
  state.contributionDots = pulseCandidates.length;
  state.visibleMassCoverage = totalContributionMass > 0 ? visibleContributionMass / totalContributionMass : 0;
  state.contributionMassCoverage = totalContributionMass > 0 ? pulseMass / totalContributionMass : 0;
  flowSignalData = pulseCandidates.map((c, idx) => ({
    ...c,
    normSignal: c.signal / maxPulseSignal,
    phase: ((idx * 37) % 113) / 113,
  }));

  flowSignalDots = new THREE.InstancedMesh(flowSignalDotGeo, mats.flowSignalDot, Math.max(1, flowSignalData.length));
  flowSignalDots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  flowSignalDots.renderOrder = 42;
  group.add(flowSignalDots);
}

function updateCubes() {
  for (let layer = 0; layer < cubeMeshes.length; layer++) {
    const mesh = cubeMeshes[layer];
    const acts = state.pass.activations[layer];
    const maxAct = Math.max(0.001, ...acts.map((v) => Math.abs(v || 0)));
    for (let i = 0; i < positionsByLayer[layer].length; i++) {
      const p = positionsByLayer[layer][i];
      const raw = Math.abs(acts[i] || 0);
      const a = Math.min(1, raw / maxAct);
      const shaped = Math.pow(a, layer === 0 ? 0.95 : 0.45);
      const scale = layer === 0 ? 0.78 + shaped * 0.74 : (layer === 3 ? 0.5 + shaped * 0.82 : 0.56 + shaped * 1.05);
      tempObj.position.copy(p);
      tempObj.scale.setScalar(scale);
      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);

      if (layer === 0) {
        tempColor.setRGB(0.015 + shaped * 0.10, 0.055 + shaped * 0.38, 0.12 + shaped * 1.05);
      } else if (layer === 3) {
        tempColor.setRGB(0.08 + shaped * 1.0, 0.07 + shaped * 0.72, 0.025 + shaped * 0.18);
      } else {
        tempColor.setRGB(0.01 + shaped * 0.62, 0.01 + shaped * 0.62, 0.012 + shaped * 0.68);
      }
      mesh.setColorAt(i, tempColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  const inputActs = state.pass.activations[0];
  for (let i = 0; i < positionsByLayer[0].length; i++) {
    const p = positionsByLayer[0][i];
    const v = Math.max(0, Math.min(1, inputActs[i] || 0));
    const lit = Math.pow(v, 0.58);
    tempObj.position.copy(p);
    tempObj.scale.setScalar(0.18 + lit * 1.18);
    tempObj.updateMatrix();
    inputSignalMesh.setMatrixAt(i, tempObj.matrix);

    tempColor.setRGB(0.02 + lit * 0.12, 0.10 + lit * 0.42, 0.22 + lit * 1.12);
    inputSignalMesh.setColorAt(i, tempColor);
  }
  inputSignalMesh.instanceMatrix.needsUpdate = true;
  inputSignalMesh.instanceColor.needsUpdate = true;
}

function updateOutputHighlights(time = 0) {
  if (!state.pass) return;
  const probs = state.pass.probs;
  const pred = argmax(probs);
  const flash = 0.5 + 0.5 * Math.sin(time * 0.006);
  const flashLift = Math.pow(flash, 1.8);

  for (let i = 0; i < probs.length; i++) {
    const p = positionsByLayer[3][i];
    const prob = Math.max(0, Math.min(1, probs[i] || 0));
    const isPred = i === pred;

    const sprite = outputDigitSprites[i];
    if (sprite) {
      const labelScale = isPred ? 30 + flashLift * 7 : 21;
      sprite.position.copy(p).add(new THREE.Vector3(OUTPUT_DIGIT_OFFSET, 0, 0));
      sprite.scale.set(labelScale, labelScale, 1);
      sprite.material.opacity = isPred ? 0.72 + flashLift * 0.28 : 0.72 + Math.pow(prob, 0.5) * 0.08;
      sprite.material.color.set(isPred ? OUTPUT_SELECTED_BLUE : 0xffffff);
    }
  }
}

function updateFlowSignals(time = 0) {
  if (!flowSignalDots || flowSignalData.length === 0) return;
  flowSignalDots.visible = state.signalsPlaying;
  if (!state.signalsPlaying) return;
  const elapsed = Math.max(0, time - state.signalStartTime) / 1000;
  const travelSeconds = 0.92;
  const streamPeriod = 1.18;
  const launchSpread = 1.05;
  const layerLag = travelSeconds + 0.08;
  for (let k = 0; k < flowSignalData.length; k++) {
    const c = flowSignalData[k];
    const firstLaunch = c.phase * launchSpread + c.l * layerLag;
    const localElapsed = elapsed - firstLaunch;
    const cycleElapsed = localElapsed >= 0 ? localElapsed % streamPeriod : -1;
    const visible = cycleElapsed >= 0 && cycleElapsed <= travelSeconds;
    const a = positionsByLayer[c.l][c.i];
    const b = positionsByLayer[c.l + 1][c.j];
    const energy = Math.sqrt(Math.max(0, c.normSignal || 0));
    const head = visible ? cycleElapsed / travelSeconds : 0;
    const x = a.x + (b.x - a.x) * head;
    const y = a.y + (b.y - a.y) * head;
    const z = a.z + (b.z - a.z) * head;

    if (visible) {
      tempObj.position.set(x, y, z);
      tempObj.scale.setScalar(0.45 + energy * 1.05);
    } else {
      tempObj.position.copy(a);
      tempObj.scale.setScalar(0);
    }
    tempObj.updateMatrix();
    flowSignalDots.setMatrixAt(k, tempObj.matrix);
  }
  flowSignalDots.instanceMatrix.needsUpdate = true;
}

function updateProof() {
  if (!state.model || !state.pass) return;
  const sample = state.samples[state.sampleIndex];
  const arch = state.model.architecture;
  const input = sample.pixels;
  const activations = state.pass.activations;
  const preacts = state.pass.preacts;
  const probs = state.pass.probs;
  const pred = argmax(probs);
  const top = topIndexes(probs, 2);
  const margin = top.length > 1 ? probs[top[0].index] - probs[top[1].index] : probs[pred];
  const activePixels = input.reduce((sum, v) => sum + (v > 0.05 ? 1 : 0), 0);
  const inputEnergy = input.reduce((sum, v) => sum + v, 0);
  const z1 = preacts[0] || [];
  const z2 = preacts[1] || [];
  const logits = preacts[preacts.length - 1] || [];
  const a1 = activations[1] || [];
  const a2 = activations[2] || [];
  const lastLayer = state.model.weights.length - 1;
  const lastWeights = state.model.weights[lastLayer][pred] || [];
  const lastBias = state.model.biases[lastLayer][pred] || 0;
  const dot = lastWeights.reduce((sum, w, i) => sum + w * (a2[i] || 0), 0);
  const logit = lastBias + dot;
  const contributors = lastWeights
    .map((w, i) => ({
      i,
      w,
      a: a2[i] || 0,
      c: w * (a2[i] || 0),
    }))
    .sort((a, b) => Math.abs(b.c) - Math.abs(a.c))
    .slice(0, 3)
    .map((item) => `h2[${item.i}]: ${fmt(item.a, 2)}*${fmt(item.w, 2)}=${fmt(item.c, 2)}`)
    .join(" | ");

  document.getElementById("proofInput").textContent =
    `x in R^${arch[0]} | lit=${activePixels} | sum=${fmt(inputEnergy, 2)} | ||x||2=${fmt(vectorNorm(input), 2)}`;
  document.getElementById("proofLayer1").textContent =
    `z1=W1*x+b1 | ReLU active=${countPositive(a1)}/${arch[1]} | max z=${fmt(Math.max(...z1), 2)}`;
  document.getElementById("proofLayer2").textContent =
    `z2=W2*a1+b2 | ReLU active=${countPositive(a2)}/${arch[2]} | max z=${fmt(Math.max(...z2), 2)}`;
  document.getElementById("proofOutput").textContent =
    `argmax p=${pred} | p=${fmt(probs[pred] * 100, 2)}% | margin=${fmt(margin * 100, 2)}%`;
  document.getElementById("proofEquation").textContent =
    `a1=ReLU(W1*x+b1); a2=ReLU(W2*a1+b2); p=softmax(W3*a2+b3)`;
  document.getElementById("proofLogit").textContent =
    `z_${pred}=b_${pred}+sum(a2_i*W3_${pred},i) = ${fmt(lastBias, 3)} + ${fmt(dot, 3)} = ${fmt(logit, 3)}; stored=${fmt(logits[pred], 3)}`;
  document.getElementById("proofContrib").textContent = `top evidence: ${contributors}`;
}

function updateHud() {
  const arch = state.model.architecture;
  const weights = state.model.weights.reduce((s, W) => s + W.length * W[0].length, 0);
  const biases = state.model.biases.reduce((s, b) => s + b.length, 0);
  document.getElementById("stArch").textContent = arch.join(" -> ");
  document.getElementById("stWeights").textContent = formatInt(weights);
  document.getElementById("stShown").textContent = `${formatInt(state.shownWeights)} / ${formatInt(weights)} (${(state.shownWeights / weights * 100).toFixed(1)}%)`;
  document.getElementById("stParams").textContent = formatInt(weights + biases);
  document.getElementById("stLearning").textContent = state.model.learning || "MLP";
  document.getElementById("stSample").textContent = `${state.sampleIndex + 1} / ${state.samples.length}`;
  document.getElementById("stDots").textContent = formatInt(state.contributionDots);
  document.getElementById("stMass").textContent = `${(state.contributionMassCoverage * 100).toFixed(1)}% dots / ${(state.visibleMassCoverage * 100).toFixed(1)}% lines`;
  document.getElementById("mathNote").textContent = `forward pass: all output logits z_k = b_k + sum_i a_i*W_k,i are computed; dots show visible |a_i*W_ji| terms`;
}

function updateSample() {
  const sample = state.samples[state.sampleIndex];
  state.pass = forward(state.model, sample.pixels);
  const probs = state.pass.probs;
  const pred = argmax(probs);
  const loss = crossEntropy(probs, sample.label);

  document.getElementById("trueLabel").textContent = sample.label;
  document.getElementById("predLabel").textContent = `${pred} (${Math.round(probs[pred] * 100)}%)`;
  document.getElementById("lossVal").textContent = loss.toFixed(3);
  drawDigit(sample.pixels);
  drawBars(probs, pred);
  updateCubes();
  updateOutputHighlights();
  rebuildLines();
  updateHud();
  updateProof();
}

function drawDigit(pixels) {
  const side = getInputSide();
  const cv = document.getElementById("digit");
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);
  const cell = cv.width / side;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const c = Math.round((pixels[y * side + x] || 0) * 255);
      ctx.fillStyle = `rgb(${c},${c},${c})`;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
}

function drawBars(probs, pred) {
  document.getElementById("bars").innerHTML = probs.map((p, i) => `
    <div class="bar">
      <span>${i}</span>
      <span class="barTrack"><span class="barFill" style="width:${Math.round(p * 100)}%; ${i === pred ? "background:linear-gradient(90deg,#ffd166,#ffffff)" : ""}"></span></span>
      <span>${Math.round(p * 100)}%</span>
    </div>
  `).join("");
}

function animate(time) {
  controls.autoRotate = state.autoOrbit;
  controls.update();
  group.rotation.y = -0.18 + Math.sin(time * 0.00008) * 0.035;
  updateFlowSignals(time);
  updateOutputHighlights(time);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

document.getElementById("nextSample").addEventListener("click", () => {
  state.sampleIndex = (state.sampleIndex + 1) % state.samples.length;
  updateSample();
});

document.getElementById("prevSample").addEventListener("click", () => {
  state.sampleIndex = (state.sampleIndex + state.samples.length - 1) % state.samples.length;
  updateSample();
});

document.getElementById("toggleOrbit").addEventListener("click", (event) => {
  state.autoOrbit = !state.autoOrbit;
  event.currentTarget.textContent = state.autoOrbit ? "إيقاف الدوران" : "تشغيل الدوران";
});

document.getElementById("toggleSignals").addEventListener("click", (event) => {
  state.signalsPlaying = !state.signalsPlaying;
  if (state.signalsPlaying) state.signalStartTime = performance.now();
  if (flowSignalDots) flowSignalDots.visible = state.signalsPlaying;
  event.currentTarget.textContent = state.signalsPlaying ? "إيقاف الإرسال" : "تشغيل الإرسال";
});

document.getElementById("toggleLines").addEventListener("click", (event) => {
  state.lineMode = (state.lineMode + 1) % lineRatios.length;
  rebuildLines();
  updateHud();
  event.currentTarget.textContent = state.lineMode === lineRatios.length - 1 ? "وصلات أقل" : "وصلات أكثر";
});

loadData().then(() => {
  state.signalStartTime = performance.now();
  requestAnimationFrame(animate);
});
