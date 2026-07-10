import * as THREE from "../vendor/three/three.module.js";
import { OrbitControls } from "../vendor/three/OrbitControls.js";
import { argmax, crossEntropy, formatInt, forward } from "./network.js";

const state = {
  model: null,
  samples: [],
  sampleIndex: 0,
  pass: null,
  autoOrbit: true,
  shownRatio: 0.025,
  visibleSynapses: 0,
  particles: [],
};

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03050b);
scene.fog = new THREE.FogExp2(0x03050b, 0.0015);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 5000);
camera.position.set(0, 180, 760);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.55;
controls.enablePan = false;
controls.minDistance = 360;
controls.maxDistance = 1150;

scene.add(new THREE.AmbientLight(0x7f9fc8, 0.55));
const keyLight = new THREE.PointLight(0x4fc8f8, 28, 1600);
keyLight.position.set(260, 220, 280);
scene.add(keyLight);
const rimLight = new THREE.PointLight(0xffd166, 16, 1200);
rimLight.position.set(-360, -80, -320);
scene.add(rimLight);

const group = new THREE.Group();
scene.add(group);

const nodeMeshes = [];
const endpointGlowMeshes = [];
let synapseLines = null;
let pulseMesh = null;
let pulseData = [];
let layerPositions = [];

const nodeGeo = new THREE.SphereGeometry(4.2, 12, 8);
const endpointGlowGeo = new THREE.SphereGeometry(7.8, 16, 10);
const nodeMats = {
  input: new THREE.MeshStandardMaterial({ color: 0xe8f7ff, emissive: 0x365f78, roughness: 0.35 }),
  hidden: new THREE.MeshStandardMaterial({ color: 0xd9e4f5, emissive: 0x182436, roughness: 0.42 }),
  output: new THREE.MeshStandardMaterial({ color: 0xffe2a3, emissive: 0x7a4a00, roughness: 0.3 }),
};
const endpointGlowMats = {
  input: new THREE.MeshBasicMaterial({
    color: 0xe9fbff,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  }),
  output: new THREE.MeshBasicMaterial({
    color: 0xffd166,
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  }),
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

async function loadData() {
  const [model, samples] = await Promise.all([
    fetch("./data/model.json").then((r) => r.json()),
    fetch("./data/samples.json").then((r) => r.json()),
  ]);
  state.model = model;
  state.samples = samples.samples;
  state.pass = forward(model, state.samples[0].pixels);
  buildNetwork();
  updateHud();
  updateSample();
  document.getElementById("loading").classList.add("hide");
}

function layerPoint(layer, index, count) {
  const x = (layer - 1.5) * 230;
  const rows = Math.ceil(Math.sqrt(count));
  const cols = Math.ceil(count / rows);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const y = (row - (rows - 1) / 2) * 22;
  const z = (col - (cols - 1) / 2) * 22;
  return new THREE.Vector3(x, y, z);
}

function makeTextSprite(text, options = {}) {
  const {
    color = "#dff6ff",
    fontSize = 42,
    width = 512,
    height = 128,
    scale = [92, 23],
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
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
  );
  sprite.scale.set(scale[0], scale[1], 1);
  sprite.renderOrder = 5;
  return sprite;
}

function addLayerLabels() {
  const inputSide = getInputSide();
  const labels = [
    { layer: 0, text: `INPUT ${inputSide}x${inputSide}`, color: "#dff8ff" },
    { layer: 1, text: `HIDDEN ${state.model.architecture[1]}`, color: "#9ccfff" },
    { layer: 2, text: `HIDDEN ${state.model.architecture[2]}`, color: "#9ccfff" },
    { layer: 3, text: "OUTPUT 0-9", color: "#ffd166" },
  ];

  for (const item of labels) {
    const positions = layerPositions[item.layer];
    const topY = Math.max(...positions.map((p) => p.y));
    const bottomY = Math.min(...positions.map((p) => p.y));
    const avgZ = positions.reduce((sum, p) => sum + p.z, 0) / positions.length;
    const sprite = makeTextSprite(item.text, { color: item.color, fontSize: 52, scale: [150, 38] });
    const labelY = item.layer === 0 || item.layer === layerPositions.length - 1 ? bottomY - 48 : topY + 62;
    sprite.position.set(positions[0].x, labelY, avgZ);
    group.add(sprite);
  }

  const outputPositions = layerPositions[layerPositions.length - 1];
  for (let i = 0; i < outputPositions.length; i++) {
    const p = outputPositions[i];
    const sprite = makeTextSprite(String(i), {
      color: "#ffe39b",
      fontSize: 72,
      width: 128,
      height: 128,
      scale: [26, 26],
    });
    sprite.position.set(p.x + 44, p.y, p.z);
    group.add(sprite);
  }
}

function addEndpointOutline(layer, color) {
  const positions = layerPositions[layer];
  const x = positions[0].x;
  const ys = positions.map((p) => p.y);
  const zs = positions.map((p) => p.z);
  const minY = Math.min(...ys) - 18;
  const maxY = Math.max(...ys) + 18;
  const minZ = Math.min(...zs) - 18;
  const maxZ = Math.max(...zs) + 18;
  const corners = [
    [x, minY, minZ], [x, maxY, minZ],
    [x, maxY, minZ], [x, maxY, maxZ],
    [x, maxY, maxZ], [x, minY, maxZ],
    [x, minY, maxZ], [x, minY, minZ],
  ];
  const outlineGeo = new THREE.BufferGeometry();
  outlineGeo.setAttribute("position", new THREE.Float32BufferAttribute(corners.flat(), 3));
  const outline = new THREE.LineSegments(
    outlineGeo,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    })
  );
  outline.renderOrder = 4;
  group.add(outline);
}

function buildNetwork() {
  group.clear();
  nodeMeshes.length = 0;
  endpointGlowMeshes.length = 0;
  pulseData = [];
  layerPositions = state.model.architecture.map((count, layer) =>
    Array.from({ length: count }, (_, i) => layerPoint(layer, i, count))
  );

  for (let l = 0; l < layerPositions.length; l++) {
    const mat = l === 0 ? nodeMats.input : (l === layerPositions.length - 1 ? nodeMats.output : nodeMats.hidden);
    const mesh = new THREE.InstancedMesh(nodeGeo, mat, layerPositions[l].length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
    nodeMeshes.push(mesh);

    if (l === 0 || l === layerPositions.length - 1) {
      const glowMat = l === 0 ? endpointGlowMats.input : endpointGlowMats.output;
      const glow = new THREE.InstancedMesh(endpointGlowGeo, glowMat, layerPositions[l].length);
      glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      glow.renderOrder = 3;
      group.add(glow);
      endpointGlowMeshes.push({ layer: l, mesh: glow });
    }
  }
  addEndpointOutline(0, 0x9befff);
  addEndpointOutline(layerPositions.length - 1, 0xffd166);
  addLayerLabels();

  const linePositions = [];
  const lineColors = [];
  const synapses = state.model.weights.reduce((s, W) => s + W.length * W[0].length, 0);
  const targetShown = Math.max(300, Math.floor(synapses * state.shownRatio));
  const candidates = [];
  for (let l = 0; l < state.model.weights.length; l++) {
    const W = state.model.weights[l];
    for (let j = 0; j < W.length; j++) {
      for (let i = 0; i < W[j].length; i++) {
        const w = W[j][i];
        const score = Math.abs(w) + (((i * 1103515245 + j * 12345 + l * 97) >>> 0) % 1000) / 50000;
        candidates.push({ l, i, j, w, score });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const shown = candidates.slice(0, targetShown);
  state.visibleSynapses = shown.length;
  for (const c of shown) {
    const a = layerPositions[c.l][c.i];
    const b = layerPositions[c.l + 1][c.j];
    linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const col = c.w >= 0 ? new THREE.Color(0x4fc8f8) : new THREE.Color(0xff7b5c);
    const intensity = Math.min(1, 0.18 + Math.abs(c.w) * 1.7);
    lineColors.push(col.r * intensity, col.g * intensity, col.b * intensity, col.r * intensity, col.g * intensity, col.b * intensity);
  }

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
  lineGeo.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 3));
  synapseLines = new THREE.LineSegments(
    lineGeo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending })
  );
  group.add(synapseLines);

  pulseData = shown.slice(0, Math.min(900, shown.length)).map((c, idx) => ({ ...c, phase: (idx % 113) / 113 }));
  pulseMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(2.2, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9 }),
    pulseData.length
  );
  group.add(pulseMesh);
}

function updateHud() {
  const arch = state.model.architecture;
  const synapses = state.model.weights.reduce((s, W) => s + W.length * W[0].length, 0);
  const biases = state.model.biases.reduce((s, b) => s + b.length, 0);
  const visibleRatio = state.visibleSynapses / synapses;
  document.getElementById("stInput").textContent = formatInt(arch[0]);
  document.getElementById("stHidden").textContent = arch.slice(1, -1).join(" + ");
  document.getElementById("stOutput").textContent = formatInt(arch[arch.length - 1]);
  document.getElementById("stSynapses").textContent = formatInt(synapses);
  document.getElementById("stShown").textContent = `${formatInt(state.visibleSynapses)} / ${formatInt(synapses)} (${(visibleRatio * 100).toFixed(1)}%)`;
  document.getElementById("stLearning").textContent = state.model.learning || "MLP";
  document.getElementById("mathNote").textContent =
    `W = ${weightFormula(arch)} = ${formatInt(synapses)}; b = ${formatInt(biases)}; parameters = ${formatInt(synapses + biases)}`;
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
}

function drawDigit(pixels) {
  const side = getInputSide();
  const cv = document.getElementById("digit");
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);
  const cell = cv.width / side;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const v = pixels[y * side + x] || 0;
      const c = Math.round(v * 255);
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

function updateNodeActivations() {
  const temp = new THREE.Object3D();
  for (let l = 0; l < nodeMeshes.length; l++) {
    const mesh = nodeMeshes[l];
    const acts = state.pass.activations[l];
    for (let i = 0; i < layerPositions[l].length; i++) {
      const p = layerPositions[l][i];
      const a = Math.min(1, Math.abs(acts[i] || 0));
      const s = 0.65 + a * 1.7;
      temp.position.copy(p);
      temp.scale.setScalar(s);
      temp.updateMatrix();
      mesh.setMatrixAt(i, temp.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  for (const glowLayer of endpointGlowMeshes) {
    const { layer, mesh } = glowLayer;
    const acts = state.pass.activations[layer];
    const isOutput = layer === layerPositions.length - 1;
    for (let i = 0; i < layerPositions[layer].length; i++) {
      const p = layerPositions[layer][i];
      const a = Math.min(1, Math.abs(acts[i] || 0));
      const s = isOutput ? 0.16 + Math.pow(a, 0.42) * 2.25 : 0.025 + Math.pow(a, 0.58) * 1.55;
      temp.position.copy(p);
      temp.scale.setScalar(s);
      temp.updateMatrix();
      mesh.setMatrixAt(i, temp.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}

function updatePulses(time) {
  if (!pulseMesh) return;
  const temp = new THREE.Object3D();
  for (let k = 0; k < pulseData.length; k++) {
    const c = pulseData[k];
    const local = (time * 0.00042 + c.phase) % 1;
    const wave = local * (state.model.weights.length + 0.8) - c.l;
    const visible = wave >= 0 && wave <= 1;
    const a = layerPositions[c.l][c.i];
    const b = layerPositions[c.l + 1][c.j];
    const u = visible ? wave : 0;
    temp.position.lerpVectors(a, b, u);
    const energy = Math.abs((state.pass.activations[c.l][c.i] || 0) * c.w);
    const s = visible ? 0.7 + Math.min(1.8, energy * 7) : 0.001;
    temp.scale.setScalar(s);
    temp.updateMatrix();
    pulseMesh.setMatrixAt(k, temp.matrix);
  }
  pulseMesh.instanceMatrix.needsUpdate = true;
}

function animate(time) {
  controls.autoRotate = state.autoOrbit;
  controls.update();
  updateNodeActivations();
  updatePulses(time);
  group.rotation.y = Math.sin(time * 0.00012) * 0.05;
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

document.getElementById("toggleSynapses").addEventListener("click", (event) => {
  state.shownRatio = state.shownRatio < 0.06 ? state.shownRatio * 2 : 0.015;
  buildNetwork();
  updateHud();
  event.currentTarget.textContent = state.shownRatio > 0.03 ? "وصلات أقل" : "وصلات أكثر";
});

loadData().then(() => requestAnimationFrame(animate));
