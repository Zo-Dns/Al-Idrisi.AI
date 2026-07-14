import { readFileSync } from "node:fs";
import { NODES } from "./ai-content.mjs";

let failures = 0;
function check(condition, label, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"} | ${label}${detail ? ` | ${detail}` : ""}`);
  if (!condition) failures++;
}

const byKey = new Map(NODES.map((node) => [node.k, node]));
const keys = (nodes) => nodes.map((node) => node.k).sort();
const sameKeys = (actual, expected) => JSON.stringify(actual) === JSON.stringify([...expected].sort());

/* الحلقات تعني مظلة عابرة للمجالات حصرا، لا مجرد اختلاف أب العرض عن الأب العلمي. */
const expectedUmbrellas = [
  "agents", "robotics", "hci", "ethics", "genai", "creativity", "classic-neurosym"
];
const expectedNavReparented = [
  "vision", "nlp", "agi", "governance", "xai", "multiagent"
];
const umbrellas = NODES.filter((node) => node.rt === "cross");
const navReparented = NODES.filter((node) => node.nav === true);

check(sameKeys(keys(umbrellas), expectedUmbrellas), "الحلقات محصورة في المظلات السبع المعتمدة", keys(umbrellas).join(", "));
check(sameKeys(keys(navReparented), expectedNavReparented), "العقد المنقولة ملاحيا الست معلنة صراحة", keys(navReparented).join(", "));
check(navReparented.every((node) => node.rt !== "cross"), "لا تداخل بين المظلة والنقل الملاحي");
check(navReparented.every((node) => node.sp && node.sp !== node.p && byKey.has(node.sp)), "كل نقل ملاحي يعلن أبا علميا مختلفا صالحا");
check(["vision", "nlp", "multiagent"].every((key) => byKey.get(key).rt === "is"), "الرؤية واللغة والأنظمة متعددة الوكلاء مصنفة فروعًا لا مظلات");
check(["agents", "ethics", "genai"].every((key) => byKey.get(key).rt === "cross"), "المظلات الأم الثلاث تحتفظ بحلقاتها");

const build = readFileSync("atlas-build.mjs", "utf8");
const templates = ["atlas-template.html", "ai-network-template.html"].map((file) => readFileSync(file, "utf8"));
check(build.includes("out.nav = 1") && build.includes("النقل الملاحي يتطلب"), "المصرّف يشحن nav ويرفض استعماله البنيوي الخاطئ");
for (const [index, template] of templates.entries()) {
  const label = index === 0 ? "قالب الأطلس" : "قالب الشبكة";
  check(template.includes("nav: !!r.nav"), `${label} يقرأ وسم النقل الملاحي`);
  check(template.includes("function isDashedParentLink(link) { return !link.x && (isCrossCut(link.b) || isNavReparented(link.b)); }"), `${label} يقطع وصلة أب العرض وحدها`);
  check(template.includes('isCrossCut(n) ? "umbrella" : ""'), `${label} يقصر الحلقات على المظلات`);
  check(!template.includes("isCrossCut(l.a) || isCrossCut(l.b)"), `${label} لا يقطع روابط أبناء المظلة العاديين`);
  check(template.includes('function hasIndependentDiveWorld(nd) { return WORLD === "ai" && nd.key === "rl"; }'), `${label} يقصر علامة العالم المستقل على التعلم المعزز`);
  check(template.includes('ctx.fillText("عالم غوص مستقل"'), `${label} يعرض العبارة المباشرة تحت التعلم المعزز`);
  check(template.includes('ctx.font = (hub ? "11.5px" : "10.5px") + " Consolas, monospace"'), `${label} يكبر المصطلح الانجليزي درجة واحدة للمجموعات والمفاهيم`);
  check(!template.includes("drawDiveCore") && !template.includes('kind === "dive"'), `${label} خال من تجربة نافذة العمق الملغاة`);
}
for (const file of ["ai-how-ai-works.html"]) {
  const output = readFileSync(file, "utf8");
  check(output.includes('"k":"vision"') && output.includes('"nav":1'), `${file} يشحن وسم النقل الملاحي`);
  check(output.includes("function isDashedParentLink(link)"), `${file} يشحن منطق الوصلة المصحح`);
  check(output.includes('ctx.font = (hub ? "11.5px" : "10.5px") + " Consolas, monospace"'), `${file} يشحن حجم المصطلح الانجليزي المقروء`);
  check(!output.includes("isCrossCut(l.a) || isCrossCut(l.b)"), `${file} خال من منطق التقطيع القديم`);
}

if (failures) {
  console.error(`\n${failures} MOTHER-MAP VISUAL SEMANTICS TEST(S) FAILED`);
  process.exit(1);
}
console.log("\nALL MOTHER-MAP VISUAL SEMANTICS TESTS PASSED");
