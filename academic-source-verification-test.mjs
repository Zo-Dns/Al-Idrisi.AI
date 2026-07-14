import assert from "node:assert/strict";
import fs from "node:fs";

const audit = JSON.parse(fs.readFileSync("academic-source-verification.json", "utf8"));
const report = fs.readFileSync("ACADEMIC_SOURCE_AUDIT.md", "utf8");

assert.equal(audit.total, 389, "the finalized audit must cover all 389 canonical records");
assert.equal(audit.results.length, 389, "the audit result count must match its total");
assert.equal(new Set(audit.results.map((item) => item.id)).size, 389, "every audited record needs a unique stable ID");
assert.equal(Object.values(audit.counts).reduce((sum, count) => sum + count, 0), 389, "status counts must cover the complete audit");

const acceptedStatuses = new Set(["verified", "verified-original", "verified-web", "verified-manual"]);
for (const item of audit.results) {
  assert(item.audit?.checked, `${item.id}: audit must be explicitly closed`);
  assert(acceptedStatuses.has(item.audit.status), `${item.id}: unresolved audit status ${item.audit.status}`);
  assert(item.audit.basis, `${item.id}: verification basis is missing`);
  assert(item.audit.evidence?.some((entry) => entry?.ok), `${item.id}: at least one accepted evidence item is required`);
  assert(report.includes(`| ${item.id} |`), `${item.id}: missing from the human-readable audit report`);
}

assert.equal((report.match(/^\| src-/gm) || []).length, 389, "the human-readable report must contain one row per source");
assert(report.includes("مكتبة المصادر الرسمية والأكاديمية"), "the report must use the final library description");
assert(report.includes("لا تعني نتيجة «موجود» أن المصدر محكم"), "the report must preserve the peer-review limitation");

console.log("academic source verification: 389/389 closed with accepted evidence — OK");
