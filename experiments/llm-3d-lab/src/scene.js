import * as THREE from "../../nn-3d-simulation/vendor/three/three.module.js";
import { OrbitControls } from "../../nn-3d-simulation/vendor/three/OrbitControls.js";
import { buildModel, encode, decode, forward, softmax, entropy, sampleFrom, argmax, countParams } from "./gpt.js";

const HEAD_COLORS = [0x69c9ff, 0xf7a6d9, 0xffd166, 0x85e89d];
const SHOW_T = 32;          /* اقصى رموز معروضة في المشهد (نافذة على آخر السياق) */
const MAX_GEN = 60;
const PRESETS = ["الذكاء الاصطناعي ", "الشبكات العصبية ", "التعلم العميق "];

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070d19);
scene.fog = new THREE.FogExp2(0x070d19, 0.0011);
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 3000);
camera.position.set(-40, 150, 430);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.3;
controls.minDistance = 120;
controls.maxDistance = 900;
controls.target.set(0, 95, 0);

scene.add(new THREE.AmbientLight(0x9eb4d6, 0.6));
const key = new THREE.PointLight(0xffffff, 80, 1600);
key.position.set(-160, 260, 260);
scene.add(key);

const group = new THREE.Group();
scene.add(group);
const arcGroup = new THREE.Group();
group.add(arcGroup);
const tileGroup = new THREE.Group();
group.add(tileGroup);
const spineGroup = new THREE.Group();
group.add(spineGroup);

const state = {
  model: null, tokens: [], promptLen: 0,
  temperature: 1, headMode: -1, layerMode: -1,
  autoOrbit: true, autoTimer: null,
  lastPass: null, lastLogits: null, lastProbs: null, chosen: -1,
};

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}
window.addEventListener("resize", resize);
resize();

/* ---------- helpers ---------- */
const SPACING = 15;
function xOf(i, count) { return ((count - 1) / 2 - i) * SPACING; }  /* عربي: الموضع 0 يمينا */
const LAYER_Y = [70, 135];
const displayChar = (ch) => ch === " " ? "␣" : (ch === "\n" ? "↵" : ch);

function charSprite(text, color = "#eaf4ff", size = 13) {
  const c = document.createElement("canvas");
  c.width = 96; c.height = 96;
  const ctx = c.getContext("2d");
  ctx.font = "700 60px Segoe UI, Tahoma, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.fillStyle = color;
  ctx.fillText(text, 48, 52);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
  sp.scale.set(size, size, 1);
  return sp;
}

function labelSprite(text, color, width = 512, font = 44, scale = 96) {
  const c = document.createElement("canvas");
  c.width = width; c.height = 110;
  const ctx = c.getContext("2d");
  ctx.font = `700 ${font}px Segoe UI, Tahoma, sans-serif`;
  ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = color; ctx.shadowBlur = 16; ctx.fillStyle = color;
  ctx.fillText(text, width / 2, 55);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
  sp.scale.set(scale, scale * 110 / width, 1);
  return sp;
}

function disposeGroup(g) {
  for (const child of [...g.children]) {
    g.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material) { if (child.material.map) child.material.map.dispose(); child.material.dispose(); }
  }
}

/* ---------- static decor ---------- */
function buildStatic() {
  const mk = (text, y, color) => { const s = labelSprite(text, color, 560, 40, 120); s.position.set(0, y, -60); group.add(s); };
  mk("المدخل: رموز (حرف = رمز)", -26, "#8ba3c2");
  mk("طبقة الانتباه 1 — اربعة رؤوس", LAYER_Y[0] + 26, "#b7d9ff");
  mk("طبقة الانتباه 2 — اربعة رؤوس", LAYER_Y[1] + 26, "#b7d9ff");
  mk("الرمز التالي (توزيع softmax حي)", 205, "#ffd166");
}

/* orb الرمز التالي */
let nextOrb = null, nextOrbLabel = null;
function buildOrb() {
  nextOrb = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.85 }));
  group.add(nextOrb);
  nextOrbLabel = charSprite("؟", "#1a1205", 12);
  nextOrbLabel.renderOrder = 30;
  group.add(nextOrbLabel);
}

/* ---------- dynamic rebuilds ---------- */
function visibleWindow() {
  const total = state.tokens.length;
  const start = Math.max(0, total - SHOW_T);
  return { start, count: total - start };
}

function rebuildTiles() {
  disposeGroup(tileGroup);
  const { start, count } = visibleWindow();
  const geo = new THREE.BoxGeometry(11, 11, 4);
  for (let i = 0; i < count; i++) {
    const tokenIndex = start + i;
    const isPrompt = tokenIndex < state.promptLen;
    const mat = new THREE.MeshBasicMaterial({ color: isPrompt ? 0x14263e : 0x143024, transparent: true, opacity: 0.9 });
    const box = new THREE.Mesh(geo, mat);
    box.position.set(xOf(i, count), 0, 0);
    tileGroup.add(box);
    const ch = displayChar(state.model.vocab[state.tokens[tokenIndex]]);
    const sp = charSprite(ch, isPrompt ? "#9fc6ec" : "#c9f3d9", 12);
    sp.position.set(xOf(i, count), 0, 4);
    sp.renderOrder = 20;
    tileGroup.add(sp);
  }
}

function rebuildArcs() {
  disposeGroup(arcGroup);
  if (!state.lastPass) return;
  const { start, count } = visibleWindow();
  const pass = state.lastPass;
  const T = pass.T;
  const last = T - 1;
  const lastVisible = count - 1;
  const heads = state.headMode === -1 ? [0, 1, 2, 3] : [state.headMode];
  const layers = state.layerMode === -1 ? [0, 1] : [state.layerMode];
  for (const l of layers) {
    for (const h of heads) {
      const att = pass.attention[l][h][last];   /* اوزان انتباه الموضع الاخير — حقيقية من التمريرة */
      for (let src = 0; src < T; src++) {
        const w = att[src];
        if (w < 0.02) continue;
        const sv = src - (T - count);            /* الى احداثيات النافذة المعروضة */
        if (sv < 0) continue;
        const from = new THREE.Vector3(xOf(sv, count), 8, 0);
        const to = new THREE.Vector3(xOf(lastVisible, count), LAYER_Y[l], 0);
        const mid = new THREE.Vector3((from.x + to.x) / 2, LAYER_Y[l] * 0.62, (h - 1.5) * 7);
        const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(20));
        const mat = new THREE.LineBasicMaterial({ color: HEAD_COLORS[h], transparent: true,
          opacity: Math.min(0.95, 0.1 + w * 1.5), blending: THREE.AdditiveBlending, depthWrite: false });
        arcGroup.add(new THREE.Line(geo, mat));
      }
    }
  }
}

function rebuildSpines() {
  disposeGroup(spineGroup);
  if (!state.lastPass) return;
  const { count } = visibleWindow();
  const norms = state.lastPass.hiddenNorms[state.lastPass.hiddenNorms.length - 1];
  const T = norms.length;
  const maxN = Math.max(...norms);
  for (let i = 0; i < count; i++) {
    const src = T - count + i;
    const a = Math.max(0.05, norms[src] / maxN);
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xOf(i, count), 7, -2), new THREE.Vector3(xOf(i, count), LAYER_Y[1] + 8, -2)]);
    const mat = new THREE.LineBasicMaterial({ color: 0x9eb4d6, transparent: true, opacity: 0.06 + a * 0.22 });
    spineGroup.add(new THREE.Line(geo, mat));
  }
}

/* ---------- UI ---------- */
const el = (id) => document.getElementById(id);

function updateGenText() {
  const text = decode(state.model, state.tokens);
  const p = text.slice(0, state.promptLen);
  const g = text.slice(state.promptLen);
  el("genText").innerHTML = `<span class="prompt">${p}</span><span class="gen">${g}</span><span class="cursor">▌</span>`;
  el("genText").scrollTop = el("genText").scrollHeight;
}

function updateBars() {
  const probs = state.lastProbs;
  const idxs = [...probs.keys()].sort((a, b) => probs[b] - probs[a]).slice(0, 8);
  el("topBars").innerHTML = idxs.map((i) => `
    <div class="tbar ${i === state.chosen ? "chosen" : ""}">
      <span class="tk">${displayChar(state.model.vocab[i])}</span>
      <span class="track"><span class="fill" style="width:${(probs[i] * 100).toFixed(1)}%"></span></span>
      <span class="pv">${(probs[i] * 100).toFixed(1)}%</span>
    </div>`).join("");
  el("entropyVal").textContent = entropy(probs).toFixed(2);
}

function refreshDistribution() {
  state.lastProbs = softmax(state.lastLogits, state.temperature);
  updateBars();
  if (nextOrbLabel) {
    const top = argmax(state.lastProbs);
    const { count } = visibleWindow();
    nextOrb.position.set(xOf(count - 1, count), 190, 0);
    nextOrbLabel.position.set(xOf(count - 1, count), 190, 6);
    swapOrbChar(displayChar(state.model.vocab[top]));
  }
}

let orbCanvasCtx = null;
function swapOrbChar(ch) {
  if (!orbCanvasCtx) {
    const c = document.createElement("canvas");
    c.width = 96; c.height = 96;
    orbCanvasCtx = c.getContext("2d");
    nextOrbLabel.material.map = new THREE.CanvasTexture(c);
  }
  const ctx = orbCanvasCtx;
  ctx.clearRect(0, 0, 96, 96);
  ctx.font = "700 58px Segoe UI, Tahoma, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#241a04";
  ctx.fillText(ch, 48, 52);
  nextOrbLabel.material.map.needsUpdate = true;
}

function runForward() {
  const window_ = state.tokens.slice(-state.model.config.blockSize);
  state.lastPass = forward(state.model, window_);
  state.lastLogits = state.lastPass.logits[state.lastPass.T - 1];
  refreshDistribution();
  rebuildTiles();
  rebuildArcs();
  rebuildSpines();
  updateGenText();
}

function step() {
  if (state.tokens.length - state.promptLen >= MAX_GEN) { stopAuto(); return; }
  const pick = state.temperature <= 0.001 ? argmax(state.lastProbs) : sampleFrom(state.lastProbs);
  state.tokens.push(pick);
  /* لا تمييز للمختار في اعمدة التوزيع الجديد — التمييز هناك كان سيضلل: الاعمدة صارت توزيع الرمز التالي */
  state.chosen = -1;
  runForward();
}

function stopAuto() {
  if (state.autoTimer) { clearInterval(state.autoTimer); state.autoTimer = null; el("autoBtn").textContent = "توليد تلقائي"; }
}

function resetTo(promptText) {
  stopAuto();
  state.tokens = encode(state.model, promptText);
  state.promptLen = state.tokens.length;
  state.chosen = -1;
  runForward();
}

/* ---------- البرهان الحي ---------- */
function runProofs() {
  const m = state.model;
  const ref = m.reference;
  const pass = forward(m, ref.promptTokens);
  const logits = pass.logits[pass.T - 1];
  let maxDiff = 0;
  for (let i = 0; i < logits.length; i++) maxDiff = Math.max(maxDiff, Math.abs(logits[i] - ref.logitsLast[i]));
  el("prLogits").textContent = `Δ الاقصى ${maxDiff.toExponential(1)} ${maxDiff < 1e-4 ? "✓" : "✗"}`;

  const pos = ref.proof.pos;
  const row = pass.attention[0][0][pos];
  let rowSum = 0;
  for (let j = 0; j <= pos; j++) rowSum += row[j];
  el("prRowSum").textContent = `${rowSum.toFixed(6)} ✓`;

  const hd = m.config.dModel / m.config.nHead;
  const q = pass.qk[0].q[pos], k = pass.qk[0].k[ref.proof.srcIndex];
  let s = 0;
  for (let d = 0; d < hd; d++) s += q[d] * k[d];
  s /= Math.sqrt(hd);
  const ok = Math.abs(s - ref.proof.preScore) < 1e-4;
  el("prQK").textContent = `${s.toFixed(4)} = ${ref.proof.preScore.toFixed(4)} ${ok ? "✓" : "✗"}`;

  let future = 0;
  for (const layer of pass.attention) for (const head of layer)
    for (let i = 0; i < pass.T; i++) for (let j = i + 1; j < pass.T; j++) future = Math.max(future, head[i][j]);
  el("prCausal").textContent = `${future} (بنية سببية) ✓`;

  const h05 = entropy(softmax(logits, 0.5)), h1 = entropy(softmax(logits, 1)), h2 = entropy(softmax(logits, 2));
  const mono = h05 < h1 && h1 < h2;
  el("prEntropy").textContent = `${h05.toFixed(2)} < ${h1.toFixed(2)} < ${h2.toFixed(2)} بت ${mono ? "✓" : "✗"}`;
}

/* ---------- تحميل وتوصيل ---------- */
function showFatal(err) {
  const box = document.getElementById("loading");
  box.classList.remove("hide");
  box.innerHTML = `تعذر تحميل المختبر: <b style="color:#ffb3b3">${String((err && err.message) || err)}</b>
    <br><span style="font-size:12px;color:#8ba3c2">تاكد ان الخادم المحلي يعمل (node dev-server.mjs) ثم اعد المحاولة</span>
    <br><button id="retryBtn" style="margin-top:12px;background:rgba(105,201,255,.15);border:1px solid rgba(105,201,255,.5);color:#cfeaff;border-radius:9px;padding:8px 16px;cursor:pointer;font-family:inherit">اعادة المحاولة</button>`;
  box.style.flexDirection = "column";
  box.style.textAlign = "center";
  document.getElementById("retryBtn").onclick = () => location.reload();
}
window.addEventListener("error", (e) => {
  if (state.model) return;
  const src = e && e.target && (e.target.src || e.target.href);
  showFatal((e && e.message) || (src ? "تعذر تحميل: " + src : "خطا في تحميل وحدة"));
}, true);
window.addEventListener("unhandledrejection", (e) => { if (!state.model) showFatal(e.reason); });

async function load() {
  /* النسخة المنفردة (standalone) تضمن البيانات داخل الملف — لا شبكة اطلاقا */
  const embedded = typeof window !== "undefined" ? window.__TINY_GPT_DATA__ : null;
  const json = embedded || await fetch("./data/tiny-gpt.json").then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status} عند جلب النموذج`);
    return r.json();
  });
  state.model = buildModel(json);
  const cfg = state.model.config;
  el("stArch").textContent = `${cfg.nLayer} طبقة × ${cfg.nHead} رؤوس × ${cfg.dModel} بعدا`;
  el("stParams").textContent = countParams(state.model).toLocaleString("en-US") + (countParams(state.model) === json.meta.params ? " ✓" : " ✗");
  el("stBlock").textContent = `${cfg.blockSize} رمزا`;
  el("stVocab").textContent = String(cfg.vocabSize);
  el("stCorpus").textContent = `${(json.meta.corpusChars / 1000).toFixed(0)} الف حرف من نصوص الاطلس`;
  el("stPpl").textContent = String(json.meta.valPpl);

  const sel = el("promptSelect");
  for (const p of PRESETS) {
    const o = document.createElement("option");
    o.value = p; o.textContent = p.trim();
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => resetTo(sel.value));

  buildStatic();
  buildOrb();
  runProofs();
  resetTo(PRESETS[0]);
  el("loading").classList.add("hide");
}

el("stepBtn").addEventListener("click", () => step());
el("autoBtn").addEventListener("click", (e) => {
  if (state.autoTimer) { stopAuto(); return; }
  state.autoTimer = setInterval(step, 600);
  e.currentTarget.textContent = "ايقاف التوليد";
});
el("resetBtn").addEventListener("click", () => resetTo(el("promptSelect").value));
el("temp").addEventListener("input", (e) => {
  state.temperature = Number(e.target.value);
  el("tempVal").textContent = state.temperature.toFixed(2);
  refreshDistribution();
});
el("headBtn").addEventListener("click", (e) => {
  state.headMode = state.headMode === 3 ? -1 : state.headMode + 1;
  e.currentTarget.textContent = state.headMode === -1 ? "كل الرؤوس" : `رأس ${state.headMode + 1}`;
  rebuildArcs();
});
el("layerBtn").addEventListener("click", (e) => {
  state.layerMode = state.layerMode === 1 ? -1 : state.layerMode + 1;
  e.currentTarget.textContent = state.layerMode === -1 ? "الطبقة 1+2" : `الطبقة ${state.layerMode + 1}`;
  rebuildArcs();
});
el("orbitBtn").addEventListener("click", (e) => {
  state.autoOrbit = !state.autoOrbit;
  e.currentTarget.textContent = state.autoOrbit ? "ايقاف الدوران" : "تشغيل الدوران";
});

function animate(time) {
  controls.autoRotate = state.autoOrbit;
  controls.update();
  if (nextOrb) nextOrb.scale.setScalar(1 + 0.08 * Math.sin(time * 0.003));
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

load().catch(showFatal);
animate(0);
