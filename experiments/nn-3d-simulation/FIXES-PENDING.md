# رقعتان جاهزتان لـ`src/cubes.js` — تُطبَّقان عند استقرار العمل الجاري

> **لماذا هذا الملف؟** الإصلاحان أدناه يسكنان في `cubes.js` وهو قيد تعديل نشط بأداة أخرى،
> فوُثِّقا هنا رقعةً دقيقة (كتبت ضد النسخة المرسّخة في git بتاريخ 2026-07-11) بدل لمس ملف جارٍ.
> عند الاستقرار: طبِّقهما (أو اطلب من كلود تطبيقهما) ثم احذف هذا الملف.

---

## الرقعة أ — سدّ تسريب ذاكرة GPU (3 أسطر، مستقلة)

**المشكلة**: `rebuildLines()` تزيل الأجسام القديمة من المشهد دون `dispose()`،
فتتراكم هندسات الخطوط في ذاكرة GPU مع كل تبديل عينة (جلسة تقليب طويلة = تضخم مطّرد).

**في `rebuildLines()` استبدل**:

```js
  if (weightLines) group.remove(weightLines);
  if (activeLines) group.remove(activeLines);
  if (flowSignalDots) group.remove(flowSignalDots);
```

**بـ**:

```js
  if (weightLines) { group.remove(weightLines); weightLines.geometry.dispose(); weightLines.material.dispose(); }
  if (activeLines) { group.remove(activeLines); activeLines.geometry.dispose(); activeLines.material.dispose(); }
  if (flowSignalDots) { group.remove(flowSignalDots); flowSignalDots.dispose(); }
```

> ملاحظة دقيقة: `flowSignalDots.dispose()` وحدها صحيحة — هندسته (`flowSignalDotGeo`) وخامته
> (`mats.flowSignalDot`) **مشتركتان** معرفتان مرة واحدة، ولا يجوز التخلص منهما.

---

## الرقعة ب — فصل الطوبولوجيا الثابتة عن الإشارات الحية (تتضمن أ)

**المشكلة**: عند كل تبديل عينة تُبنى وتُفرز **80,352** مرشحاً من جديد، رغم أن مجموعة الخطوط
المعروضة **ثابتة** (معيار اختيارها `|w| + tie` لا يتغير بالعينة) — المتغير الوحيد هو
الإسهامات الحية (خطوط النشاط والنقاط النابضة). النتيجة: تخصيص كائنات وفرز ضخمان بلا داعٍ
عند كل نقرة «عينة جديدة» — محسوس على الأجهزة الضعيفة.

**الفكرة**: `rebuildStaticLines()` تُبنى مرة لكل وضع كثافة (وتُعاد فقط عند تغييره)،
و`rebuildDynamicSignals()` تعمل على المجموعة المعروضة فقط O(المعروض) + مرور جمعٍ واحد
بلا تخصيص لحساب كتلة الإسهام الكلية (مقياس الأمانة يبقى صادقاً).

**استبدل الدوال الثلاث** `collectWeightCandidates` و`selectVisibleWeightsByLayer`
و`rebuildLines` **بهذه الكتلة** (بقية الملف كما هي — `selectContributionDotsByLayer`
و`edgeKey` و`withRequiredEdges` تبقى):

```js
let staticShown = [];
let staticLinesMode = -1;

function collectStaticCandidates() {
  const candidates = [];
  for (let l = 0; l < state.model.weights.length; l++) {
    const W = state.model.weights[l];
    for (let j = 0; j < W.length; j++) {
      for (let i = 0; i < W[j].length; i++) {
        const w = W[j][i];
        const tie = (((i * 1103515245 + j * 12345 + l * 97) >>> 0) % 1000) / 100000;
        candidates.push({ l, i, j, w, score: Math.abs(w) + tie });
      }
    }
  }
  return candidates;
}

function rebuildStaticLines() {
  if (staticLinesMode === state.lineMode && weightLines) return; /* ثابتة بين العينات */
  if (weightLines) { group.remove(weightLines); weightLines.geometry.dispose(); weightLines.material.dispose(); }
  const candidates = collectStaticCandidates();
  const ratio = lineRatios[state.lineMode];
  staticShown = [];
  for (let l = 0; l < state.model.weights.length; l++) {
    const layerCandidates = candidates.filter((c) => c.l === l).sort((a, b) => b.score - a.score);
    const count = Math.max(1, Math.floor(layerCandidates.length * ratio));
    staticShown.push(...layerCandidates.slice(0, count));
  }
  state.shownWeights = staticShown.length;
  const positions = [];
  const colors = [];
  for (const c of staticShown) {
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
  staticLinesMode = state.lineMode;
}

function rebuildDynamicSignals() {
  if (activeLines) { group.remove(activeLines); activeLines.geometry.dispose(); activeLines.material.dispose(); }
  if (flowSignalDots) { group.remove(flowSignalDots); flowSignalDots.dispose(); }
  flowSignalDots = null;
  flowSignalData = [];

  /* الاسهامات الحية للمجموعة المعروضة فقط: O(المعروض) لا O(80,352) */
  const live = staticShown.map((c) => {
    const source = state.pass?.activations?.[c.l]?.[c.i] || 0;
    const contribution = source * c.w;
    return { ...c, source, contribution, signal: Math.abs(contribution) };
  });

  /* كتلة الاسهام الكلية: مرور جمع واحد بلا تخصيص كائنات — يبقي مقياس الامانة دقيقا */
  let totalContributionMass = 0;
  for (let l = 0; l < state.model.weights.length; l++) {
    const W = state.model.weights[l];
    const acts = state.pass.activations[l];
    for (let j = 0; j < W.length; j++) {
      const row = W[j];
      for (let i = 0; i < row.length; i++) totalContributionMass += Math.abs((acts[i] || 0) * row[i]);
    }
  }
  const visibleContributionMass = live.reduce((sum, c) => sum + c.signal, 0);

  const active = live
    .filter((c) => c.signal > 0)
    .sort((a, b) => b.signal - a.signal)
    .slice(0, Math.max(80, Math.round(dotBudgets[state.lineMode] * 0.8)));
  const activePos = [];
  const activeCol = [];
  for (const c of active) {
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

  const pulseCandidates = selectContributionDotsByLayer(live);
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

function rebuildLines() {
  rebuildStaticLines();
  rebuildDynamicSignals();
}
```

**لا تغيير على مواضع الاستدعاء**: `updateSample()` وزر الوصلات يستدعيان `rebuildLines()`
كما هما — الحارس داخل `rebuildStaticLines` يجعلها لا-عملية بين العينات.

**تحقق بعد التطبيق**: قلّب عينات عدة — «Weights shown» ثابت لكل وضع، «Mass covered»
يتغير بالعينة ويبقى منطقيا، صفر أخطاء console، والتبديل أسرع ملموسا.

---

*أُعدَّت هاتان الرقعتان بعد تدقيق كامل للكود وتشغيل حي (2026-07-11). ملاحظة: `cubes.html`
اليتيم حُذف في نفس الجولة (لا شيء كان يشير إليه).*
