import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SKIP_DIRS = new Set([".git", "node_modules", "archive", "_site"]);

function findTests(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...findTests(join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith("-test.mjs")) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const tests = findTests(ROOT).sort((a, b) => a.localeCompare(b, "en"));
if (!tests.length) throw new Error("لم يعثر مشغل الاختبارات على أي ملف *-test.mjs");

for (const file of tests) {
  const label = relative(ROOT, file).replaceAll("\\", "/");
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [file], {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`\nFAILED: ${label} (exit ${result.status})`);
    process.exit(result.status || 1);
  }
}

console.log(`\nALL ${tests.length} TEST FILES PASSED`);
