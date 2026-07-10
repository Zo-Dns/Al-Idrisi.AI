import * as THREE from "../vendor/three/three.module.js";
import { OrbitControls } from "../vendor/three/OrbitControls.js";
import { argmax, crossEntropy, formatInt, forward } from "./network.js";

const state = {
  model: null,
  samples: [],
  sampleIndex: 0,
  pass: null,
  autoOrbit: true,
  lineMode: 0,
  shownWeights: 0,
};

const lineRatios = [0.08, 0.22, 0.45];
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
let flowSignalLines = null;
let flowSignalData = [];
let inputSignalMesh = null;
let inputDigitCanvas = null;
let inputDigitTexture = null;
let inputDigitMesh = null;
let inputDigitBackMesh = null;

const cubeGeo = new THREE.BoxGeometry(8.5, 8.5, 8.5);
const inputPanelGeo = new THREE.BoxGeometry(9.5, 9.5, 3.2);
const inputSignalGeo = new THREE.BoxGeometry(12.6, 12.6, 2.4);
const outputCubeGeo = new THREE.BoxGeometry(10.5, 10.5, 10.5);
const outputGlowGeo = new THREE.SphereGeometry(16, 24, 16);
const tempObj = new THREE.Object3D();
const tempColor = new THREE.Color();

const mats = {
  input: new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.9 }),
  inputSignal: new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 1, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
  hidden: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, emissive: 0x050505, roughness: 0.58 }),
  output: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, emissive: 0x2d2200, roughness: 0.32 }),
  outputGlow: new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.62, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
};

function getInputSide() {
  return Math.round(Math.sqrt(state.model?.architecture?.[0] || 64));
}

function weightFormula(arch) {
  return arch.slice(0, -1).map((n, i) => `${n}x${arch[i + 1]}`).join(" + ");
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
    const spacing = side > 8 ? 4.8 : 18;
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
  flowSignalLines = null;
  flowSignalData = [];
  inputSignalMesh = null;
  inputDigitMesh = null;
  inputDigitBackMesh = null;
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
  group.add(outputGlowMesh);

  addInputDigitPlane();

  addLabels();
  rebuildLines();
}

function addInputDigitPlane() {
  const side = getInputSide();
  inputDigitCanvas = document.createElement("canvas");
  inputDigitCanvas.width = side;
  inputDigitCanvas.height = side;
  inputDigitTexture = new THREE.CanvasTexture(inputDigitCanvas);
  inputDigitTexture.magFilter = THREE.NearestFilter;
  inputDigitTexture.minFilter = THREE.NearestFilter;
  inputDigitTexture.generateMipmaps = false;

  const backMaterial = new THREE.MeshBasicMaterial({
    color: 0x06101d,
    transparent: true,
    opacity: 0.72,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const backPlane = new THREE.Mesh(new THREE.PlaneGeometry(128, 128), backMaterial);
  backPlane.rotation.y = -Math.PI / 2;
  backPlane.position.set(positionsByLayer[0][0].x - 34, 0, 0);
  backPlane.renderOrder = 28;
  inputDigitBackMesh = backPlane;
  group.add(backPlane);

  const material = new THREE.MeshBasicMaterial({
    map: inputDigitTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const digitPlane = new THREE.Mesh(new THREE.PlaneGeometry(118, 118), material);
  digitPlane.rotation.y = -Math.PI / 2;
  digitPlane.position.set(positionsByLayer[0][0].x - 37, 0, 0);
  digitPlane.renderOrder = 30;
  inputDigitMesh = digitPlane;
  group.add(digitPlane);
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
    const sprite = makeTextSprite(String(i), { color: "#ffffff", fontSize: 82, width: 128, height: 128, scale: [28, 28] });
    sprite.position.set(p.x + 92, p.y, p.z);
    sprite.renderOrder = 36;
    sprite.userData.baseScale = 28;
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
        const source = Math.abs(state.pass?.activations?.[l]?.[i] || 0);
        const signal = source * Math.abs(w);
        const tie = (((i * 1103515245 + j * 12345 + l * 97) >>> 0) % 1000) / 100000;
        candidates.push({ l, i, j, w, signal, score: Math.abs(w) + tie });
      }
    }
  }
  return candidates;
}

function rebuildLines() {
  if (weightLines) group.remove(weightLines);
  if (activeLines) group.remove(activeLines);
  if (flowSignalLines) group.remove(flowSignalLines);
  flowSignalLines = null;
  flowSignalData = [];

  const totalWeights = state.model.weights.reduce((s, W) => s + W.length * W[0].length, 0);
  const candidates = collectWeightCandidates().sort((a, b) => b.score - a.score);
  const shown = candidates.slice(0, Math.max(500, Math.floor(totalWeights * lineRatios[state.lineMode])));
  state.shownWeights = shown.length;

  const positions = [];
  const colors = [];
  for (const c of shown) {
    const a = positionsByLayer[c.l][c.i];
    const b = positionsByLayer[c.l + 1][c.j];
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const weightBrightness = Math.min(1, 0.05 + Math.abs(c.w) * 0.22);
    const signTint = c.w >= 0 ? [0.045, 0.07, 0.09] : [0.09, 0.055, 0.045];
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
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.56, depthWrite: false })
  );
  group.add(weightLines);

  const bySignal = collectWeightCandidates().sort((a, b) => b.signal - a.signal);
  const active = bySignal.slice(0, 360);
  const activePos = [];
  const activeCol = [];
  for (const c of active) {
    if (c.signal <= 0) continue;
    const a = positionsByLayer[c.l][c.i];
    const b = positionsByLayer[c.l + 1][c.j];
    activePos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const bright = Math.min(1, 0.05 + c.signal * 1.1);
    activeCol.push(bright * 0.05, bright * 0.075, bright * 0.1, bright * 0.05, bright * 0.075, bright * 0.1);
  }
  const activeGeo = new THREE.BufferGeometry();
  activeGeo.setAttribute("position", new THREE.Float32BufferAttribute(activePos, 3));
  activeGeo.setAttribute("color", new THREE.Float32BufferAttribute(activeCol, 3));
  activeLines = new THREE.LineSegments(
    activeGeo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false })
  );
  group.add(activeLines);

  const pulseCandidates = [];
  const layerLimits = [520, 320, 180];
  for (let l = 0; l < state.model.weights.length; l++) {
    const layerActive = bySignal
      .filter((c) => c.l === l && c.signal > 0)
      .slice(0, layerLimits[l] || 180);
    pulseCandidates.push(...layerActive);
  }

  flowSignalData = pulseCandidates.map((c, idx) => ({
    ...c,
    phase: ((idx * 37) % 113) / 113,
  }));

  const flowGeo = new THREE.BufferGeometry();
  flowGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(Math.max(1, flowSignalData.length) * 6), 3));
  flowGeo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(Math.max(1, flowSignalData.length) * 6), 3));
  flowSignalLines = new THREE.LineSegments(
    flowGeo,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  flowSignalLines.renderOrder = 18;
  group.add(flowSignalLines);
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
        tempColor.setRGB(0.025 + shaped * 0.92, 0.055 + shaped * 0.92, 0.07 + shaped * 0.9);
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

    tempColor.setRGB(0.02 + lit * 0.78, 0.10 + lit * 0.9, 0.14 + lit * 0.86);
    inputSignalMesh.setColorAt(i, tempColor);
  }
  inputSignalMesh.instanceMatrix.needsUpdate = true;
  inputSignalMesh.instanceColor.needsUpdate = true;
}

function updateOutputHighlights(time = 0) {
  if (!state.pass || !outputGlowMesh) return;
  const probs = state.pass.probs;
  const pred = argmax(probs);
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.005);

  for (let i = 0; i < probs.length; i++) {
    const p = positionsByLayer[3][i];
    const prob = Math.max(0, Math.min(1, probs[i] || 0));
    const isPred = i === pred;
    const glowScale = isPred ? 2.3 + pulse * 0.55 : 0.22 + Math.pow(prob, 0.42) * 1.1;
    tempObj.position.copy(p);
    tempObj.scale.setScalar(glowScale);
    tempObj.updateMatrix();
    outputGlowMesh.setMatrixAt(i, tempObj.matrix);

    if (isPred) {
      tempColor.setRGB(1.0, 0.78 + pulse * 0.2, 0.18);
    } else {
      const dim = 0.08 + Math.pow(prob, 0.5) * 0.34;
      tempColor.setRGB(dim, dim * 0.95, dim * 0.7);
    }
    outputGlowMesh.setColorAt(i, tempColor);

    const sprite = outputDigitSprites[i];
    if (sprite) {
      const labelScale = isPred ? 39 + pulse * 4 : 24 + Math.pow(prob, 0.45) * 12;
      sprite.scale.set(labelScale, labelScale, 1);
      sprite.material.opacity = isPred ? 1 : 0.28 + Math.pow(prob, 0.5) * 0.35;
      sprite.material.color.set(isPred ? 0xffd166 : 0xd7e2f1);
    }
  }
  outputGlowMesh.instanceMatrix.needsUpdate = true;
  outputGlowMesh.instanceColor.needsUpdate = true;
}

function updateFlowSignals(time = 0) {
  if (!flowSignalLines || flowSignalData.length === 0) return;
  const layers = state.model.weights.length;
  const pos = flowSignalLines.geometry.attributes.position.array;
  const col = flowSignalLines.geometry.attributes.color.array;
  for (let k = 0; k < flowSignalData.length; k++) {
    const c = flowSignalData[k];
    const local = (time * 0.00036 + c.phase) % 1;
    const wave = local * (layers + 0.82) - c.l;
    const visible = wave >= 0 && wave <= 1;
    const a = positionsByLayer[c.l][c.i];
    const b = positionsByLayer[c.l + 1][c.j];
    const energy = Math.min(1, Math.sqrt(Math.max(0, c.signal)) * 1.9);
    const trail = 0.10 + energy * 0.08;
    const head = visible ? wave : 0;
    const tail = Math.max(0, head - trail);
    const p0x = a.x + (b.x - a.x) * tail;
    const p0y = a.y + (b.y - a.y) * tail;
    const p0z = a.z + (b.z - a.z) * tail;
    const p1x = a.x + (b.x - a.x) * head;
    const p1y = a.y + (b.y - a.y) * head;
    const p1z = a.z + (b.z - a.z) * head;

    const base = k * 6;
    if (visible) {
      pos[base] = p0x;
      pos[base + 1] = p0y;
      pos[base + 2] = p0z;
      pos[base + 3] = p1x;
      pos[base + 4] = p1y;
      pos[base + 5] = p1z;
    } else {
      pos[base] = a.x;
      pos[base + 1] = a.y;
      pos[base + 2] = a.z;
      pos[base + 3] = a.x;
      pos[base + 4] = a.y;
      pos[base + 5] = a.z;
    }

    let r;
    let g;
    let bl;
    if (c.l === layers - 1) {
      r = 1.0; g = 0.82; bl = 0.22;
    } else if (c.w >= 0) {
      r = 0.45; g = 0.92; bl = 1.0;
    } else {
      r = 1.0; g = 0.36; bl = 0.22;
    }
    const brightness = visible ? 0.35 + energy * 0.95 : 0;
    col[base] = r * brightness * 0.28;
    col[base + 1] = g * brightness * 0.28;
    col[base + 2] = bl * brightness * 0.28;
    col[base + 3] = r * brightness;
    col[base + 4] = g * brightness;
    col[base + 5] = bl * brightness;
  }
  flowSignalLines.geometry.attributes.position.needsUpdate = true;
  flowSignalLines.geometry.attributes.color.needsUpdate = true;
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
  document.getElementById("mathNote").textContent = `W = ${weightFormula(arch)} = ${formatInt(weights)}; b = ${formatInt(biases)}; output = softmax(Wx + b)`;
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
  updateInputDigitPlane(sample.pixels);
  drawBars(probs, pred);
  updateCubes();
  updateOutputHighlights();
  rebuildLines();
  updateHud();
}

function updateInputDigitPlane(pixels) {
  const side = getInputSide();
  const ctx = inputDigitCanvas.getContext("2d");
  const img = ctx.createImageData(side, side);
  for (let i = 0; i < pixels.length; i++) {
    const v = Math.max(0, Math.min(1, pixels[i] || 0));
    const lit = Math.pow(v, 0.52);
    const offset = i * 4;
    img.data[offset] = Math.round(45 + lit * 210);
    img.data[offset + 1] = Math.round(120 + lit * 135);
    img.data[offset + 2] = Math.round(155 + lit * 100);
    img.data[offset + 3] = Math.round(lit * 255);
  }
  ctx.putImageData(img, 0, 0);
  inputDigitTexture.needsUpdate = true;
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

document.getElementById("toggleLines").addEventListener("click", (event) => {
  state.lineMode = (state.lineMode + 1) % lineRatios.length;
  rebuildLines();
  updateHud();
  event.currentTarget.textContent = state.lineMode === lineRatios.length - 1 ? "وصلات أقل" : "وصلات أكثر";
});

loadData().then(() => requestAnimationFrame(animate));
