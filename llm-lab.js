/* ==================== مختبرات النماذج اللغوية — توليد حقيقي وترميز حقيقي ==================== */
/* ===== LAB MATH: رياضيات صرفة بلا DOM (تختبر آليا قبل النشر) ===== */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* النص المضمن: عالم صغير متماسك المفردات حتى تتسلسل الثلاثيات جيدا */
const LAB_CORPUS = "كان الصياد يخرج الى البحر كل صباح. كان القارب الصغير ينتظر عند الشاطئ. رمى الصياد الشبكة في الماء الهادئ. عاد الصياد الى البيت قبل الغروب. حمل الصياد سلة مليئة بالسمك الطازج. ذهب الولد الى السوق مع جده. اشترى الولد خبزا ساخنا من الفرن. كانت رائحة الخبز تملأ الطريق الضيق. جلست القطة فوق سور البيت القديم. راقبت القطة العصافير فوق الشجرة العالية. نزلت القطة الى الحديقة الصغيرة بهدوء. شربت القطة الحليب ثم نامت تحت الشجرة. في الصباح فتحت البنت النافذة الكبيرة. دخل ضوء الشمس الى الغرفة الدافئة. سمعت البنت صوت البحر من بعيد. ركضت البنت الى الشاطئ مع صديقتها. جمعت البنت اصدافا ملونة من الرمل. كتبت البنت اسمها على الرمل المبلل. جاءت موجة كبيرة ومسحت الاسم. ضحكت البنت وكتبت الاسم من جديد. ذهب الاولاد الى المدرسة في الصباح الباكر. شرح المعلم درسا جديدا عن النجوم. قال المعلم ان النجوم بعيدة جدا عنا. رسم الولد قمرا كبيرا في دفتره. قرأت البنت قصة جميلة عن البحر. اعطى المعلم الاولاد واجبا قصيرا. عاد الاولاد الى البيوت قبل المساء. في الليل ظهرت النجوم فوق القرية. جلس الجد على الكرسي امام البيت. حكى الجد حكاية قديمة عن البحر. قال الجد ان البحر يحب الصادقين. شرب الجد الشاي الساخن ببطء. نامت القرية الصغيرة تحت ضوء القمر. في الشتاء نزل المطر على القرية. جرى الماء في الطريق الضيق. لبس الاولاد معاطف ثقيلة ودافئة. جلست العائلة حول النار المشتعلة. خبزت الجدة خبزا ساخنا للعائلة. كانت رائحة الخبز تملأ البيت الدافئ. في الربيع فتحت الازهار في الحديقة. زرع الجد نخلة صغيرة قرب البئر. سقى الولد النخلة الصغيرة كل يوم. كبرت النخلة وصارت اعلى من السور. وقفت العصافير فوق النخلة العالية. غنت العصافير للشمس في الصباح. حمل الهواء رائحة الازهار الى البيوت. خرج الناس الى السوق يوم الجمعة. باع الصياد السمك الطازج في السوق. اشترت الجدة سمكا وخضارا من السوق. طبخت الجدة عشاء لذيذا للعائلة. اجتمعت العائلة حول المائدة الكبيرة. شكر الجد البحر على الرزق الطيب. في المساء مشى الصياد على الشاطئ. راى الصياد قاربا جديدا عند الميناء. حلم الصياد برحلة طويلة بعيدة. قال الصياد ان البحر صديق قديم. علم الصياد ابنه رمي الشبكة. تعلم الولد الصبر من البحر الواسع. صار الولد صيادا ماهرا مثل ابيه. في الصيف سبح الاولاد في الماء البارد. بنى الاولاد قلعة من الرمل الذهبي. جاء الموج وهدم نصف القلعة. بنى الاولاد القلعة من جديد وضحكوا. طارت طيور بيضاء فوق الموج العالي. غابت الشمس خلف الجبل البعيد. اضاء القمر طريق العائدين الى البيوت. حملت الريح صوت البحر الى القرية. نام الولد وهو يحلم بالقارب. في الحلم كان القارب يطير فوق الموج. استيقظ الولد وضحك من الحلم الجميل. حكى الولد الحلم لجده في الصباح. قال الجد ان الاحلام مثل النجوم. كتب الولد الحكاية في دفتره الصغير. قرا المعلم الحكاية امام الصف كله. صفق الاولاد للحكاية الجميلة طويلا. علقت المعلمة الحكاية على جدار الصف. فرح الولد وركض الى البيت ليخبر جدته. عانقت الجدة الولد واعطته خبزا ساخنا. في العيد لبس الاولاد ثيابا جديدة. زار الناس بعضهم في البيوت. حمل الولد حلوى الى بيت جيرانه. لعب الاولاد قرب الشاطئ حتى المساء. اطلق الصيادون فوانيس مضيئة فوق الماء. بدت الفوانيس مثل نجوم قريبة. وقفت القرية كلها تنظر الى الضوء. قالت البنت ان البحر يلبس عقدا من النور. ضحك الجد وقال ان البحر عريس الليلة. عاد الجميع الى البيوت والقلوب فرحة. هذه حكاية قرية صغيرة تحب البحر. وكل صباح تبدا الحكاية من جديد.";

/* ---------- نموذج ثلاثي الكلمات (trigram) مع مزج رجوعي ---------- */
const LM_BOS = "<s>", LM_EOS = "</s>";
const LM_SEP = ""; /* فاصل مفاتيح صريح لا يظهر في اي نص */
function lmBuild(corpus) {
  const sents = corpus.split(".").map(s => s.trim()).filter(Boolean)
    .map(s => s.replace(/[،,]/g, " ").split(/\s+/).filter(Boolean));
  const uni = new Map();
  const biFollow = new Map(), triFollow = new Map();
  const biCtxTotal = new Map(), triCtxTotal = new Map();
  let total = 0;
  for (const words of sents) {
    const seq = [LM_BOS, LM_BOS, ...words, LM_EOS];
    for (let i = 2; i < seq.length; i++) {
      const w = seq[i];
      const c1 = seq[i - 1];
      const c2 = seq[i - 2] + LM_SEP + seq[i - 1];
      uni.set(w, (uni.get(w) || 0) + 1);
      total++;
      if (!biFollow.has(c1)) biFollow.set(c1, new Map());
      const bf = biFollow.get(c1);
      bf.set(w, (bf.get(w) || 0) + 1);
      biCtxTotal.set(c1, (biCtxTotal.get(c1) || 0) + 1);
      if (!triFollow.has(c2)) triFollow.set(c2, new Map());
      const tf = triFollow.get(c2);
      tf.set(w, (tf.get(w) || 0) + 1);
      triCtxTotal.set(c2, (triCtxTotal.get(c2) || 0) + 1);
    }
  }
  const vocab = [...uni.keys()];
  return { uni, total, biFollow, biCtxTotal, triFollow, triCtxTotal, vocab, sentences: sents.length };
}

/* توزيع الرمز التالي: مزج ثلاثي/ثنائي/احادي، ثم حرارة، ثم قص top-k — نفس ترتيب النماذج الكبيرة */
function lmNextDist(lm, w1, w2, temperature, topK) {
  const L3 = 0.72, L2 = 0.2, L1 = 0.08;
  const triF = lm.triFollow.get(w1 + LM_SEP + w2);
  const triT = lm.triCtxTotal.get(w1 + LM_SEP + w2) || 0;
  const biF = lm.biFollow.get(w2);
  const biT = lm.biCtxTotal.get(w2) || 0;
  let items = [];
  let sum = 0;
  for (const w of lm.vocab) {
    if (w === LM_BOS) continue;
    let p = L1 * (lm.uni.get(w) || 0) / lm.total;
    if (biT && biF && biF.has(w)) p += L2 * biF.get(w) / biT;
    if (triT && triF && triF.has(w)) p += L3 * triF.get(w) / triT;
    if (p > 0) { items.push({ w, p }); sum += p; }
  }
  for (const it of items) it.p /= sum; /* توزيع سليم قبل الحرارة */
  /* الحرارة: p^(1/T) ثم اعادة تطبيع — تكافئ softmax(log p / T) */
  const T = Math.max(0.01, temperature);
  let s2 = 0;
  for (const it of items) { it.q = Math.pow(it.p, 1 / T); s2 += it.q; }
  for (const it of items) it.q /= s2;
  items.sort((a, b) => b.q - a.q);
  /* قص top-k ثم اعادة تطبيع */
  if (topK > 0 && topK < items.length) {
    items = items.slice(0, topK);
    let s3 = 0;
    for (const it of items) s3 += it.q;
    for (const it of items) it.q /= s3;
  }
  return items; /* مرتبة تنازليا؛ q هي احتمالات السحب النهائية */
}
function lmSample(items, rng) {
  let r = rng(), acc = 0;
  for (const it of items) { acc += it.q; if (r <= acc) return it.w; }
  return items[items.length - 1].w;
}

/* ---------- خوارزمية BPE حقيقية: تدريب وترميز وفك ---------- */
const BPE_EOW = "▁"; /* ▁ علامة نهاية الكلمة */
function bpeTrain(corpus, numMerges) {
  const words = corpus.replace(/[.،,]/g, " ").split(/\s+/).filter(Boolean);
  const wordFreq = new Map();
  for (const w of words) wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
  let seqs = [...wordFreq.entries()].map(([w, f]) => ({ sym: [...w, BPE_EOW], f }));
  const merges = [];
  for (let m = 0; m < numMerges; m++) {
    const pairCount = new Map();
    for (const { sym, f } of seqs) {
      for (let i = 0; i < sym.length - 1; i++) {
        const key = sym[i] + LM_SEP + sym[i + 1];
        pairCount.set(key, (pairCount.get(key) || 0) + f);
      }
    }
    let bestKey = null, bestC = 1; /* لا ندمج زوجا لم يتكرر */
    for (const [k, c] of pairCount) if (c > bestC) { bestKey = k; bestC = c; }
    if (!bestKey) break;
    const sepIdx = bestKey.indexOf(LM_SEP);
    const a = bestKey.slice(0, sepIdx), b = bestKey.slice(sepIdx + 1);
    merges.push([a, b]);
    const ab = a + b;
    for (const s of seqs) {
      const out = [];
      let i = 0;
      while (i < s.sym.length) {
        if (i < s.sym.length - 1 && s.sym[i] === a && s.sym[i + 1] === b) { out.push(ab); i += 2; }
        else { out.push(s.sym[i]); i += 1; }
      }
      s.sym = out;
    }
  }
  /* المفردات: الرموز الظاهرة بعد الدمج + الحروف الاساس */
  const tokSet = new Set();
  for (const { sym } of seqs) for (const t of sym) tokSet.add(t);
  for (const w of wordFreq.keys()) { for (const ch of w) tokSet.add(ch); }
  tokSet.add(BPE_EOW);
  const id = new Map([...tokSet].sort().map((t, i) => [t, i]));
  return { merges, id };
}
function bpeEncodeWord(bpe, word) {
  let sym = [...word, BPE_EOW];
  for (const [a, b] of bpe.merges) {
    const ab = a + b;
    let i = 0;
    while (i < sym.length - 1) {
      if (sym[i] === a && sym[i + 1] === b) {
        sym = sym.slice(0, i).concat([ab], sym.slice(i + 2));
        if (i > 0) i--; /* الدمج قد يخلق زوجا جديدا مع السابق */
      } else i++;
    }
  }
  return sym;
}
function bpeEncode(bpe, text) {
  const words = text.replace(/[.،,]/g, " ").split(/\s+/).filter(Boolean);
  const out = [];
  for (const w of words) out.push(...bpeEncodeWord(bpe, w));
  return out;
}
function bpeDecode(tokens) {
  return tokens.join("").split(BPE_EOW).join(" ").trim();
}
/*__LAB_DOM__*/

const LAB_MAP = {
  nexttoken: 0, probability: 0, autoregressive: 0, temp2: 0, topp: 0,
  softmax2: 0, logits: 0, hallu2: 0, stoptoken: 0, what: 0,
  token2: 1, bpe: 1, vocab: 1,
};
const LAB_BTN_TEXT = ["🔬 جرب التوليد كلمة كلمة حيا", "🔬 قطع اي نص الى رموز حيا"];
let labOpen = false;
let labMode = 0;
const labEl = document.getElementById("lab");

/* بناء النموذج والمرمز عند التحميل (نص صغير — لحظي) */
const LM = lmBuild(LAB_CORPUS);
const BPE = bpeTrain(LAB_CORPUS, 200);
const CORPUS_WORDS = LAB_CORPUS.replace(/[.،]/g, " ").split(/\s+/).filter(Boolean).length;
document.getElementById("labParams").textContent =
  "نموذج ثلاثي الكلمات (trigram) + مرمز BPE بـ" + BPE.merges.length + " دمجة — تدربا الان في متصفحك على نص مضمن من " + CORPUS_WORDS + " كلمة (" + LM.vocab.length + " مفردة)";

const genRng = mulberry32(20260707);

/* ---------- مشهد التوليد ---------- */
let ctxWords = [LM_BOS, LM_BOS];
let genText = [];
let curDist = [];
let autoGen = null;
let genEnded = false;

const genOut = document.getElementById("genOut");
const distEl = document.getElementById("genDist");
const tempSlider = document.getElementById("genTemp");
const tempVal = document.getElementById("genTempVal");
const topkSlider = document.getElementById("genTopk");
const topkVal = document.getElementById("genTopkVal");

function curTemp() { return tempSlider.value / 100; }
function curTopk() { return parseInt(topkSlider.value, 10); }
tempVal.textContent = curTemp().toFixed(2);
topkVal.textContent = curTopk();
tempSlider.addEventListener("input", () => { tempVal.textContent = curTemp().toFixed(2); refreshDist(); });
topkSlider.addEventListener("input", () => { topkVal.textContent = curTopk(); refreshDist(); });

function refreshDist() {
  if (genEnded) {
    distEl.innerHTML = '<div class="labNote">وصل النموذج الى رمز التوقف فتوقفت الحلقة — اضغط «مسح» او غير البذرة لتبدأ من جديد.</div>';
    return;
  }
  curDist = lmNextDist(LM, ctxWords[ctxWords.length - 2], ctxWords[ctxWords.length - 1], curTemp(), curTopk());
  const top = curDist.slice(0, 10);
  let html = "";
  for (const it of top) {
    const label = it.w === LM_EOS ? "⏹ رمز التوقف EOS" : it.w;
    html += '<div class="distRow"><span class="dw">' + escapeHtml(label) + '</span>' +
      '<span class="dbar"><span class="dfill" style="width:' + (it.q * 100).toFixed(1) + '%"></span></span>' +
      '<span class="dp">' + (it.q * 100).toFixed(1) + "%</span></div>";
  }
  const restMass = curDist.slice(10).reduce((s, o) => s + o.q, 0);
  if (restMass > 0.0005) html += '<div class="labNote">و' + (curDist.length - 10) + " مرشحا اخر مجموع احتمالها " + (restMass * 100).toFixed(1) + "%</div>";
  distEl.innerHTML = html;
}
function renderGenText() {
  if (!genText.length) {
    genOut.innerHTML = '<span style="color:var(--muted)">اختر بذرة او اضغط «رمز واحد» ليبدأ النص هنا...</span>';
    return;
  }
  const parts = genText.map((w, i) =>
    i >= genText.length - 2 ? '<span class="ctxHi">' + escapeHtml(w) + "</span>" : escapeHtml(w));
  genOut.innerHTML = parts.join(" ") + (genEnded ? ' <span class="eosMark">⏹</span>' : "");
}
function genStep() {
  if (genEnded || !curDist.length) return;
  const w = lmSample(curDist, genRng);
  if (w === LM_EOS) {
    genEnded = true;
    stopAutoGen();
  } else {
    genText.push(w);
    ctxWords.push(w);
  }
  renderGenText();
  refreshDist();
  document.getElementById("genCount").textContent = genText.length;
}
function resetGen(seedWords) {
  stopAutoGen();
  genEnded = false;
  ctxWords = [LM_BOS, LM_BOS];
  genText = [];
  if (seedWords) for (const w of seedWords) { genText.push(w); ctxWords.push(w); }
  renderGenText();
  refreshDist();
  document.getElementById("genCount").textContent = genText.length;
}
function stopAutoGen() {
  if (autoGen) {
    clearInterval(autoGen);
    autoGen = null;
    document.getElementById("genAuto").innerHTML = '▶ توليد تلقائي <span class="hen">Generate</span>';
  }
}
document.getElementById("genStep").addEventListener("click", () => { stopAutoGen(); genStep(); });
document.getElementById("genAuto").addEventListener("click", () => {
  if (autoGen) { stopAutoGen(); return; }
  if (genEnded) resetGen(currentSeed());
  document.getElementById("genAuto").innerHTML = '⏸ ايقاف <span class="hen">Pause</span>';
  autoGen = setInterval(() => { genStep(); if (genEnded || genText.length > 120) stopAutoGen(); }, 260);
});
document.getElementById("genClear").addEventListener("click", () => resetGen(currentSeed()));
const seedSel = document.getElementById("genSeed");
function currentSeed() {
  const v = seedSel.value;
  return v ? v.split(" ") : [];
}
seedSel.addEventListener("change", () => resetGen(currentSeed()));

/* ---------- مشهد الترميز ---------- */
const tokInput = document.getElementById("tokInput");
const tokOut = document.getElementById("tokOut");
const tokStats = document.getElementById("tokStats");
const CHIP_COLORS = ["#4fc8f8", "#ffb259", "#7ce38b", "#ff7fa8", "#a78bfa", "#d8c98b", "#8ca3c3", "#f87171"];
function renderTokens() {
  const text = tokInput.value.trim();
  if (!text) {
    tokOut.innerHTML = '<span style="color:var(--muted)">اكتب اي نص في الاعلى...</span>';
    tokStats.textContent = "";
    return;
  }
  const tokens = bpeEncode(BPE, text);
  let html = "";
  tokens.forEach((t, i) => {
    const col = CHIP_COLORS[i % CHIP_COLORS.length];
    const shown = t.split(BPE_EOW).join("");
    const isEow = t.includes(BPE_EOW);
    const tid = BPE.id.has(t) ? BPE.id.get(t) : "خارج المفردات";
    html += '<span class="tokChip" style="border-color:' + col + '88; color:' + col + '" title="id: ' + tid + '">' +
      escapeHtml(shown || " ") + (isEow ? '<span class="eow">▁</span>' : "") + "</span>";
  });
  tokOut.innerHTML = html;
  const chars = text.replace(/\s+/g, "").length;
  tokStats.innerHTML = "الحروف: <b>" + chars + "</b> · الرموز: <b>" + tokens.length + "</b> · متوسط <b>" +
    (chars / tokens.length).toFixed(1) + "</b> حرف/رمز — مرر على اي رمز لترى رقمه في المفردات";
  document.getElementById("tokMerges").innerHTML = BPE.merges.slice(0, 8).map(([a, b]) =>
    '<span class="mergeChip">' + escapeHtml(a) + " + " + escapeHtml(b) + " ← " + escapeHtml(a + b) + "</span>").join(" ");
}
tokInput.addEventListener("input", renderTokens);

/* ---------- ادارة المشاهد والفتح والاغلاق ---------- */
function setMode(m) {
  labMode = m;
  for (let i = 0; i < 2; i++) document.getElementById("labTab" + i).classList.toggle("on", i === m);
  document.getElementById("labScene0").classList.toggle("on", m === 0);
  document.getElementById("labScene1").classList.toggle("on", m === 1);
  if (m === 0) { renderGenText(); refreshDist(); }
  else renderTokens();
}
[0, 1].forEach((i) => document.getElementById("labTab" + i).addEventListener("click", () => setMode(i)));

function openLab(mode) {
  closeCard();
  labOpen = true;
  labEl.classList.add("open");
  setMode(mode);
}
function closeLab() {
  labOpen = false;
  labEl.classList.remove("open");
  stopAutoGen();
}
document.getElementById("labClose").addEventListener("click", closeLab);

/* تهيئة */
resetGen(["كان", "الصياد"]);
renderTokens();
