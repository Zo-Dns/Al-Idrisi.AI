// اختبار صحة رياضيات مختبر الذكاء الاحتمالي (استدلال بايزي دقيق بالتعداد) — مستخرجة من الاطلس المبني، مبرهنة ضد حساب يدوي
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);

const html = readFileSync(new URL("../pages/ai-how-ai-works.html", import.meta.url), "utf8");
const start = html.indexOf("/* ===== PROB LAB MATH:");
const end = html.indexOf("/*__LAB_DOM__*/", start);
if (start < 0 || end < 0) throw new Error("PROB LAB MATH markers not found");
const code = html.slice(start, end) +
  "\nmodule.exports = { PB_VARS, PB_CPT, PB_LABEL, pbJoint, pbAssign, pbMatch, pbMarginal, pbEnumerate };\n";
writeFileSync(new URL("./prob-lab-extracted.cjs", import.meta.url), code);
const M = require2("./prob-lab-extracted.cjs");

let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? "PASS" : "FAIL") + " | " + name + (detail ? " | " + detail : ""));
  if (!ok) failures++;
};
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

/* 1) التوزيع المشترك احتمال صحيح: مجموع الـ16 اسنادا = 1 بالضبط */
{
  let s = 0;
  for (let m = 0; m < 16; m++) s += M.pbJoint(M.pbAssign(m));
  check("joint distribution sums to 1", near(s, 1), "sum=" + s.toFixed(12));
}

/* 2) القبليات الحدية (محسوبة يدويا): P(C)=0.5, P(S)=0.30, P(R)=0.5, P(W)=0.6471 */
{
  const pC = M.pbMarginal({ C: 1 }), pS = M.pbMarginal({ S: 1 }), pR = M.pbMarginal({ R: 1 }), pW = M.pbMarginal({ W: 1 });
  check("priors: P(C)=0.5, P(S)=0.30, P(R)=0.5, P(W)=0.6471",
    near(pC, 0.5) && near(pS, 0.30) && near(pR, 0.5) && near(pW, 0.6471),
    "C=" + pC.toFixed(4) + " S=" + pS.toFixed(4) + " R=" + pR.toFixed(4) + " W=" + pW.toFixed(4));
}

/* 3) التعداد يطابق التهميش المسوّى: pbEnumerate({},W)[1] == P(W) */
{
  const eW = M.pbEnumerate({}, "W")[1], mW = M.pbMarginal({ W: 1 });
  check("enumerate == marginal (P(W))", near(eW, mW) && near(eW, 0.6471), "enum=" + eW.toFixed(6));
}

/* 4) الاستدلال التشخيصي: P(R=صحيح | W=صحيح) = 509/719 = 0.707928 (يدويا 0.4581/0.6471) */
{
  const p = M.pbEnumerate({ W: 1 }, "R")[1];
  check("diagnostic P(R|W=T) = 509/719 ≈ 0.707928", near(p, 509 / 719, 1e-12) && near(p, 0.4581 / 0.6471),
    "P=" + p.toFixed(6) + " prior was 0.5 (raised by wet grass)");
}

/* 5) التفسير المزيح: P(R | W=صحيح, S=صحيح) = 33/103 = 0.320388 < P(R|W) — بصمة بايز */
{
  const pRw = M.pbEnumerate({ W: 1 }, "R")[1];
  const pRws = M.pbEnumerate({ W: 1, S: 1 }, "R")[1];
  check("explaining-away P(R|W,S) = 33/103 ≈ 0.320 and < P(R|W)",
    near(pRws, 33 / 103, 1e-12) && pRws < pRw && near(pRws, 0.0891 / 0.2781),
    "P(R|W,S)=" + pRws.toFixed(6) + " < P(R|W)=" + pRw.toFixed(6));
}

/* 6) الترابط عبر العلة المشتركة: P(S | R=صحيح)=0.18 < P(S)=0.30 (رصد المطر يخفض الرشاش) */
{
  const pS = M.pbMarginal({ S: 1 });
  const pSr = M.pbEnumerate({ R: 1 }, "S")[1];
  check("common-cause dependence: P(S|R)=0.18 < P(S)=0.30", near(pSr, 0.18) && pSr < pS,
    "P(S|R)=" + pSr.toFixed(4) + " P(S)=" + pS.toFixed(4));
}

/* 7) الدليل يقيّد نفسه تماما: P(R=صحيح | R=صحيح) = 1، والتوزيع مسوّى (يجمع 1) */
{
  const d = M.pbEnumerate({ R: 1 }, "R");
  check("evidence clamps: P(R|R=T)=[0,1] and normalized", near(d[0], 0) && near(d[1], 1) && near(d[0] + d[1], 1),
    "[" + d[0].toFixed(3) + "," + d[1].toFixed(3) + "]");
}

/* 8) اتساق قاعدة بايز يدويا: P(W|R=صحيح)·P(R) = P(W,R) = P(R|W)·P(W) */
{
  const pW_given_R = M.pbEnumerate({ R: 1 }, "W")[1], pR = M.pbMarginal({ R: 1 });
  const pR_given_W = M.pbEnumerate({ W: 1 }, "R")[1], pW = M.pbMarginal({ W: 1 });
  const jointA = pW_given_R * pR, jointB = pR_given_W * pW, direct = M.pbMarginal({ W: 1, R: 1 });
  check("Bayes consistency: P(W|R)P(R) = P(R|W)P(W) = P(W,R)", near(jointA, jointB) && near(jointA, direct),
    "A=" + jointA.toFixed(6) + " B=" + jointB.toFixed(6) + " direct=" + direct.toFixed(6));
}

if (failures) { console.log("\n" + failures + " FAILURES"); process.exit(1); }
console.log("\nALL PROB LAB TESTS PASSED");
