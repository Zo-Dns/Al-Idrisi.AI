// اختبار صحة الالتفاف الثنائي — يستخرج نوى المختبر المنشورة نفسها من الاطلس ويقارن بحساب يدوي
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./ai-how-ai-works.html", import.meta.url), "utf8");
const m = html.match(/const CONV_KERNELS = (\{[\s\S]*?\});/);
if (!m) throw new Error("CONV_KERNELS not found in built file");
const CONV_KERNELS = eval("(" + m[1] + ")");

let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? "PASS" : "FAIL") + " | " + name + (detail ? " | " + detail : ""));
  if (!ok) failures++;
};

/* نفس صيغة convApply المنشورة: التفاف (cross-correlation) مع حشو صفري وتطبيع بالمعامل */
function conv(grid, N, K) {
  const out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let s = 0;
    for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) {
      const yy = y + ky, xx = x + kx;
      const v = (yy >= 0 && yy < N && xx >= 0 && xx < N) ? grid[yy * N + xx] : 0;
      s += v * K.m[ky + 1][kx + 1];
    }
    out[y * N + x] = s / K.norm;
  }
  return out;
}

/* 1) النوى المتوقعة موجودة وصحيحة الابعاد ومعاملات التطبيع منطقية */
const expected = { vedge: 4, hedge: 4, lap: 8, sharpen: 1, blur: 9 };
let kernelsOk = true;
for (const [k, norm] of Object.entries(expected)) {
  const K = CONV_KERNELS[k];
  if (!K || K.norm !== norm || K.m.length !== 3 || K.m.some(r => r.length !== 3)) kernelsOk = false;
}
check("kernels-present-and-shaped", kernelsOk, "keys=" + Object.keys(CONV_KERNELS).join(","));

/* 2) حساب يدوي: حافة عمودية (العمود الايمن = 1) مع كاشف الحواف العمودية → المركز = -1.0 */
const g1 = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
const o1 = conv(g1, 3, CONV_KERNELS.vedge);
check("vedge-center-hand-computed", Math.abs(o1[4] - (-1)) < 1e-6, "center=" + o1[4].toFixed(3) + " (متوقع -1.000)");

/* 3) كاشف الحواف الافقية على نفس الحافة العمودية → المركز = 0 (لا يكشف هذا الاتجاه) */
const o2 = conv(g1, 3, CONV_KERNELS.hedge);
check("hedge-on-vertical-edge-is-zero", Math.abs(o2[4]) < 1e-6, "center=" + o2[4].toFixed(3));

/* 4) التنعيم على صورة موحدة يحافظ على القيمة (مجموع النواة/المعامل = 1) */
const N = 6, gu = new Float32Array(N * N).fill(1);
const ob = conv(gu, N, CONV_KERNELS.blur);
check("blur-preserves-uniform-interior", Math.abs(ob[N * 3 + 3] - 1) < 1e-6, "interior=" + ob[N * 3 + 3].toFixed(3));

/* 5) مجاميع النوى: كواشف الحواف مجموعها صفر (لا تستجيب للمناطق المصمتة)، والتنعيم مجموعه 1 */
const ksum = (K) => K.m.flat().reduce((a, b) => a + b, 0);
check("edge-kernels-sum-zero", ksum(CONV_KERNELS.vedge) === 0 && ksum(CONV_KERNELS.hedge) === 0 && ksum(CONV_KERNELS.lap) === 0);
check("blur-sum-equals-norm", ksum(CONV_KERNELS.blur) === CONV_KERNELS.blur.norm);

/* 6) التحديد على صورة موحدة يحافظ على القيمة داخليا (مجموع=1) */
const os = conv(gu, N, CONV_KERNELS.sharpen);
check("sharpen-preserves-uniform-interior", Math.abs(os[N * 3 + 3] - 1) < 1e-6, "interior=" + os[N * 3 + 3].toFixed(3));

if (failures) { console.log("\n" + failures + " FAILURES"); process.exit(1); }
console.log("\nALL CONVOLUTION TESTS PASSED");
