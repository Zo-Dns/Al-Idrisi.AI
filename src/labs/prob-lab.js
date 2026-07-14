/* ==================== مختبر الذكاء الاحتمالي — استدلال بايزي دقيق حي ==================== */
/* ===== PROB LAB MATH: الاستدلال الدقيق بالتعداد على شبكة الرشاش البايزية (بلا DOM؛ يختبر آليا) ===== */
/* شبكة راسل-نورفيغ الكلاسيكية: غائم -> رشاش، غائم -> مطر، (رشاش، مطر) -> عشب مبلل.
   نحسب اي توزيع بعدي بالتعداد الدقيق للتوزيع المشترك (16 اسنادا) — لا اعتيان ولا تقريب. */

const PB_VARS = ["C", "S", "R", "W"];             /* غائم، رشاش، مطر، عشب مبلل */
const PB_LABEL = { C: "غائم", S: "رشاش", R: "مطر", W: "عشب مبلل" };

/* جداول الاحتمال الشرطي (القيم القياسية من راسل ونورفيغ، فصل الاستدلال الاحتمالي) */
const PB_CPT = {
  C: 0.5,                                         /* P(C=صحيح) */
  S: { 1: 0.1, 0: 0.5 },                          /* P(S=صحيح | C) */
  R: { 1: 0.8, 0: 0.2 },                          /* P(R=صحيح | C) */
  W: { "1,1": 0.99, "1,0": 0.9, "0,1": 0.9, "0,0": 0.0 },  /* P(W=صحيح | S,R) */
};

/* احتمال اسناد كامل: P(C,S,R,W) = P(C)·P(S|C)·P(R|C)·P(W|S,R) — تحليل الشبكة العاملي */
function pbJoint(a) {
  const pC = a.C ? PB_CPT.C : 1 - PB_CPT.C;
  const pS = a.S ? PB_CPT.S[a.C] : 1 - PB_CPT.S[a.C];
  const pR = a.R ? PB_CPT.R[a.C] : 1 - PB_CPT.R[a.C];
  const pWt = PB_CPT.W[a.S + "," + a.R];
  const pW = a.W ? pWt : 1 - pWt;
  return pC * pS * pR * pW;
}
/* يفك رقما 0..15 الى اسناد ثنائي للمتغيرات الاربعة */
function pbAssign(m) { return { C: (m >> 0) & 1, S: (m >> 1) & 1, R: (m >> 2) & 1, W: (m >> 3) & 1 }; }
/* هل يوافق الاسناد كل الادلة؟ */
function pbMatch(a, ev) { for (const v in ev) if (a[v] !== ev[v]) return false; return true; }

/* الاحتمال (المشترك) لاسناد جزئي: مجموع المشترك على المتغيرات الحرة — تهميش */
function pbMarginal(assign) {
  let p = 0;
  for (let m = 0; m < 16; m++) { const a = pbAssign(m); if (pbMatch(a, assign)) p += pbJoint(a); }
  return p;
}

/* التعداد الدقيق: بمعرفة الادلة، يعيد التوزيع البعدي للاستعلام [P(خطأ), P(صحيح)] مسويا */
function pbEnumerate(evidence, query) {
  const dist = [0, 0];
  for (let m = 0; m < 16; m++) {
    const a = pbAssign(m);
    if (!pbMatch(a, evidence)) continue;
    dist[a[query]] += pbJoint(a);
  }
  const z = dist[0] + dist[1];
  return z > 0 ? [dist[0] / z, dist[1] / z] : [0, 0];
}
/*__LAB_DOM__*/

const LAB_MAP = {
  "prob-foundations": 0, "bayes-rule": 0, "bayes-net": 0, "dag-cpt": 0, "bn-factorization": 0,
  "conditional-independence": 0, "conditional-prob": 0, "marginalization": 0, "base-rate": 0,
  "exact-inference": 0, "enumeration-inference": 0, "variable-elimination": 0, "d-separation": 0,
};
const LAB_BTN_TEXT = ["🔬 جرب الاستدلال حيا: شبكة بايزية تحدث كل الاحتمالات بقاعدة بايز"];
let labOpen = false;
const labEl = document.getElementById("lab");

const PB_EV = {};                                  /* الادلة الحالية: var -> 0/1، والغياب = مجهول */

function pbRender() {
  for (const v of PB_VARS) {
    const g = document.querySelector('.pbNode[data-var="' + v + '"]');
    const bar = document.getElementById("pbBar-" + v);
    const lab = document.getElementById("pbProb-" + v);
    g.classList.remove("evT", "evF");
    if (v in PB_EV) {
      g.classList.add(PB_EV[v] ? "evT" : "evF");
      bar.setAttribute("width", PB_EV[v] ? 104 : 0);
      lab.textContent = "◆ مثبت: " + (PB_EV[v] ? "صحيح" : "خطأ");
    } else {
      const p = pbEnumerate(PB_EV, v)[1];
      bar.setAttribute("width", Math.round(104 * p));
      lab.textContent = "P(صحيح) = " + p.toFixed(3);
    }
  }
  pbReadout();
}

function pbReadout() {
  const evVars = PB_VARS.filter((v) => v in PB_EV);
  const evTxt = evVars.length ? evVars.map((v) => PB_LABEL[v] + "=" + (PB_EV[v] ? "صحيح" : "خطأ")).join("، ") : "لا ادلة (التوزيعات القبلية)";
  const pR = ("R" in PB_EV) ? PB_EV.R : pbEnumerate(PB_EV, "R")[1];
  const pS = ("S" in PB_EV) ? PB_EV.S : pbEnumerate(PB_EV, "S")[1];
  document.getElementById("pbReadout").innerHTML =
    "الادلة المثبتة: <b>" + evTxt + "</b><br>" +
    "احتمال المطر البعدي P(مطر) = <b>" + pR.toFixed(3) + "</b> &nbsp;·&nbsp; احتمال الرشاش P(رشاش) = <b>" + pS.toFixed(3) + "</b>";
  let note = "";
  if (PB_EV.W === 1) {
    const pRw = pbEnumerate({ W: 1 }, "R")[1];
    const pRws = pbEnumerate({ W: 1, S: 1 }, "R")[1];
    if (PB_EV.S === 1)
      note = "التفسير المزيح (explaining away): العشب مبلل والرشاش يعمل، فهبط احتمال المطر من " + pRw.toFixed(3) + " (بالبلل وحده) الى " + pRws.toFixed(3) + " — سبب معروف «ازاح» الحاجة الى السبب الآخر رغم بقاء الدليل.";
    else
      note = "استدلال تشخيصي: العشب مبلل رفع احتمال المطر من قبليه 0.500 الى " + pRw.toFixed(3) + " (من المعلول الى العلة بقاعدة بايز). ثبت الآن الرشاش=صحيح لترى التفسير المزيح.";
  } else if (PB_EV.C === 1) {
    note = "استدلال سببي: الجو غائم، فارتفع احتمال المطر وانخفض احتمال الرشاش (الغيم يمنع الري).";
  }
  document.getElementById("pbNote").textContent = note;
}

for (const g of document.querySelectorAll(".pbNode")) {
  g.addEventListener("click", () => {
    const v = g.getAttribute("data-var");
    if (!(v in PB_EV)) PB_EV[v] = 1;              /* مجهول -> صحيح -> خطأ -> مجهول */
    else if (PB_EV[v] === 1) PB_EV[v] = 0;
    else delete PB_EV[v];
    pbRender();
  });
}
function pbClear() { for (const k in PB_EV) delete PB_EV[k]; }
document.getElementById("pbWet").addEventListener("click", () => { pbClear(); PB_EV.W = 1; pbRender(); });
document.getElementById("pbExplain").addEventListener("click", () => { pbClear(); PB_EV.W = 1; PB_EV.S = 1; pbRender(); });
document.getElementById("pbReset").addEventListener("click", () => { pbClear(); pbRender(); });

document.getElementById("pbQuery").innerHTML =
  "<div class='labNote' style='line-height:1.7'>نتائج مرجعية دقيقة (مبرهنة آليا):<br>" +
  "P(عشب مبلل) = <b>0.647</b><br>P(مطر | عشب مبلل) = <b>0.708</b><br>P(مطر | مبلل، رشاش) = <b>0.320</b></div>";

function openLab(mode) { closeCard(); labOpen = true; labEl.classList.add("open"); pbRender(); }
function closeLab() { labOpen = false; labEl.classList.remove("open"); }
document.getElementById("labClose").addEventListener("click", closeLab);

pbRender();
