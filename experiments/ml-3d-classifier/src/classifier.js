import * as THREE from "../../nn-3d-simulation/vendor/three/three.module.js";
import { OrbitControls } from "../../nn-3d-simulation/vendor/three/OrbitControls.js";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07101e);
scene.fog = new THREE.FogExp2(0x07101e, 0.00145);
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 2400);
camera.position.set(260, 140, 310);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.38;
controls.minDistance = 90;
controls.maxDistance = 700;

scene.add(new THREE.AmbientLight(0x9eb4d6, 0.55));
const key = new THREE.PointLight(0xffffff, 90, 1300);
key.position.set(120, 190, 240);
scene.add(key);
const rim = new THREE.PointLight(0x69c9ff, 56, 1000);
rim.position.set(-210, 60, -200);
scene.add(rim);

const group = new THREE.Group();
group.rotation.y = -0.22;
scene.add(group);

const state = { data: null, sampleIndex: 0, autoOrbit: true, pointMesh: null, query: null, queryHalo: null, queryLabel: null, neighbourLines: null, labels: [], scale: 52 };
const temp = new THREE.Object3D();
const tempColor = new THREE.Color();

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}
window.addEventListener("resize", resize);
resize();

function pointOf(item) {
  return new THREE.Vector3(item.point[0] * state.scale, item.point[1] * state.scale, item.point[2] * state.scale);
}

function makeTextSprite(text, color, scale, options = {}) {
  const { width = 512, height = 128, fontSize = 58, direction = "ltr" } = options;
  const c = document.createElement("canvas");
  c.width = width; c.height = height;
  const ctx = c.getContext("2d");
  ctx.font = `700 ${fontSize}px Segoe UI, Tahoma, sans-serif`;
  ctx.direction = direction;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = color; ctx.shadowBlur = 18; ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
  sprite.scale.set(scale, scale * height / width, 1);
  group.add(sprite); state.labels.push(sprite);
  return sprite;
}

function buildAxes() {
  const material = new THREE.LineBasicMaterial({ color: 0x536982, transparent: true, opacity: 0.5 });
  const axis = (to) => new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), to]), material);
  group.add(axis(new THREE.Vector3(150, 0, 0)), axis(new THREE.Vector3(0, 150, 0)), axis(new THREE.Vector3(0, 0, 150)));
  const x = makeTextSprite("PC1", "#c8daed", 36); x.position.set(165, 0, 0);
  const y = makeTextSprite("PC2", "#c8daed", 36); y.position.set(0, 165, 0);
  const z = makeTextSprite("PC3", "#c8daed", 36); z.position.set(0, 0, 165);
}

function classify(sample) {
  const train = state.data.training;
  const dists = train.map((item, index) => {
    let d2 = 0;
    for (let i = 0; i < sample.feature.length; i++) {
      const delta = item.feature[i] - sample.feature[i];
      d2 += delta * delta;
    }
    return { index, d2 };
  }).sort((a, b) => a.d2 - b.d2).slice(0, state.data.classifier.k);
  const votes = Object.fromEntries(Object.keys(state.data.classes).map((key) => [key, 0]));
  for (const item of dists) votes[train[item.index].label] += 1 / Math.max(item.d2, 1e-9);
  const prediction = Number(Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0]);
  return { prediction, votes, neighbours: dists };
}

function drawImage(encoded) {
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const cv = document.getElementById("digit");
  const ctx = cv.getContext("2d");
  const image = ctx.createImageData(28, 28);
  for (let i = 0; i < bytes.length; i++) {
    image.data[i * 4] = bytes[i]; image.data[i * 4 + 1] = bytes[i]; image.data[i * 4 + 2] = bytes[i]; image.data[i * 4 + 3] = 255;
  }
  const buffer = document.createElement("canvas"); buffer.width = 28; buffer.height = 28;
  buffer.getContext("2d").putImageData(image, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, 0, 0, cv.width, cv.height);
}

function updateLines(point, neighbours) {
  const values = [];
  for (const neighbour of neighbours) {
    const to = pointOf(state.data.training[neighbour.index]);
    values.push(point.x, point.y, point.z, to.x, to.y, to.z);
  }
  if (state.neighbourLines) {
    group.remove(state.neighbourLines);
    state.neighbourLines.geometry.dispose();
    state.neighbourLines.material.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(values, 3));
  state.neighbourLines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.84, depthTest: false }));
  state.neighbourLines.renderOrder = 12;
  group.add(state.neighbourLines);
}

function updateSample() {
  const sample = state.data.testing[state.sampleIndex];
  const result = classify(sample);
  const classes = state.data.classes;
  const predicted = classes[String(result.prediction)];
  const truth = classes[String(sample.label)];
  const total = Object.values(result.votes).reduce((a, b) => a + b, 0);
  const agreeing = result.neighbours.filter((n) => state.data.training[n.index].label === result.prediction).length;
  const p = pointOf(sample);
  state.query.position.copy(p);
  state.queryHalo.position.copy(p);
  state.query.material.color.set(predicted.color);
  state.queryHalo.material.color.set(predicted.color);
  state.queryLabel.position.copy(p).add(new THREE.Vector3(0, 20, 0));
  state.queryLabel.material.color.set(predicted.color);
  updateLines(p, result.neighbours);
  drawImage(sample.imageGray);
  document.getElementById("truth").textContent = truth.ar;
  document.getElementById("prediction").textContent = predicted.ar;
  document.getElementById("prediction").style.color = predicted.color;
  document.getElementById("agreement").textContent = `${agreeing} / ${state.data.classifier.k}`;
  document.getElementById("votes").innerHTML = Object.entries(classes).map(([label, info]) => {
    const share = 100 * result.votes[label] / total;
    return `<div class="vote"><span>${label}</span><span class="voteTrack"><span class="voteFill" style="width:${share.toFixed(1)}%;background:${info.color}"></span></span><span>${share.toFixed(0)}%</span></div>`;
  }).join("");
  document.getElementById("neighbours").textContent = `nearest: ${result.neighbours.map((n) => `${state.data.training[n.index].label} (d²=${n.d2.toFixed(2)})`).join(" · ")}`;
}

function buildScene() {
  buildAxes();
  const train = state.data.training;
  const geometry = new THREE.SphereGeometry(3.2, 14, 10);
  state.pointMesh = [];
  for (const [label, info] of Object.entries(state.data.classes)) {
    const items = train.filter((item) => String(item.label) === label);
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshBasicMaterial({ color: info.color, transparent: true, opacity: 0.94 }),
      items.length
    );
    for (let i = 0; i < items.length; i++) {
      temp.position.copy(pointOf(items[i]));
      temp.scale.setScalar(0.72 + ((i * 37) % 19) / 50);
      temp.updateMatrix();
      mesh.setMatrixAt(i, temp.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    state.pointMesh.push(mesh);
    group.add(mesh);
  }
  state.query = new THREE.Mesh(new THREE.SphereGeometry(6.4, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  state.queryHalo = new THREE.Mesh(new THREE.SphereGeometry(10, 22, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.23, depthWrite: false, blending: THREE.AdditiveBlending }));
  state.queryLabel = makeTextSprite("عينة الاختبار", "#eef8ff", 66, { width: 512, height: 128, fontSize: 48, direction: "rtl" });
  state.queryLabel.renderOrder = 14;
  state.queryHalo.renderOrder = 10;
  group.add(state.query, state.queryHalo);
  const testing = state.data.testing;
  const correct = testing.filter((s) => s.exportedPrediction === s.label).length;
  document.getElementById("accuracy").textContent = `${correct}/${testing.length} = ${(state.data.testAccuracy * 100).toFixed(1)}%`;
  document.getElementById("trainCount").textContent = String(train.length);
  renderConfusion();
  state.missIndexes = testing.map((s, i) => (s.exportedPrediction !== s.label ? i : -1)).filter((i) => i >= 0);
  document.getElementById("nextMiss").textContent = `أخطاء النموذج (${state.missIndexes.length})`;
  updateSample();
}

function renderConfusion() {
  const classes = state.data.classes;
  const labels = Object.keys(classes);
  const c = state.data.confusion;
  let html = '<div class="confRow confHead"><span></span>' + labels.map((l) => `<span style="color:${classes[l].color}">${l}</span>`).join("") + "</div>";
  for (const truth of labels) {
    html += `<div class="confRow"><span style="color:${classes[truth].color}">${truth}</span>` +
      labels.map((pred) => `<span class="${truth === pred ? "confDiag" : (c[truth][pred] ? "confMiss" : "")}">${c[truth][pred]}</span>`).join("") + "</div>";
  }
  document.getElementById("confusion").innerHTML = html;
}

async function load() {
  state.data = await fetch("./data/mnist-knn.json").then((r) => r.json());
  /* نبدا بالعينة 0 كما هي ولو كانت خاطئة التصنيف — الخطا لحظة تعليمية لا تخفى (فلسفة البرهان لا الادعاء) */
  state.sampleIndex = 0;
  buildScene();
  document.getElementById("loading").classList.add("hide");
}

document.getElementById("next").addEventListener("click", () => { state.sampleIndex = (state.sampleIndex + 1) % state.data.testing.length; updateSample(); });
document.getElementById("previous").addEventListener("click", () => { state.sampleIndex = (state.sampleIndex + state.data.testing.length - 1) % state.data.testing.length; updateSample(); });
document.getElementById("orbit").addEventListener("click", (event) => { state.autoOrbit = !state.autoOrbit; event.currentTarget.textContent = state.autoOrbit ? "إيقاف الدوران" : "تشغيل الدوران"; });
document.getElementById("nextMiss").addEventListener("click", () => {
  if (!state.missIndexes || !state.missIndexes.length) return;
  const next = state.missIndexes.find((i) => i > state.sampleIndex);
  state.sampleIndex = next === undefined ? state.missIndexes[0] : next;
  updateSample();
});

function animate(time) {
  controls.autoRotate = state.autoOrbit;
  controls.update();
  if (state.queryHalo) state.queryHalo.scale.setScalar(1 + 0.09 * Math.sin(time * 0.002));
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
load();
animate(0);
