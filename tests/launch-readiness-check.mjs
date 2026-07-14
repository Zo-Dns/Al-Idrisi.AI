import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (name) => readFileSync(join(ROOT, name), "utf8");
const required = [
  "LICENSE",
  "docs/legal/CONTENT_LICENSE.md",
  "docs/legal/THIRD_PARTY_NOTICES.md",
  ".github/CONTRIBUTING.md",
  ".github/CODE_OF_CONDUCT.md",
  ".github/SECURITY.md",
  "docs/legal/PRIVACY.md",
  "CITATION.cff",
  "docs/CHANGELOG.md",
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml",
  "pages/ai-how-ai-works.html",
  "experiments/nn-3d-simulation/index.html",
  "experiments/ml-3d-classifier/index.html",
  "experiments/llm-3d-lab/standalone.html",
  "experiments/loss-landscape-3d/index.html",
];

for (const name of required) {
  if (!existsSync(join(ROOT, name))) throw new Error(`launch file missing: ${name}`);
}

const html = read("pages/ai-how-ai-works.html");
const build = read("scripts/atlas-build.mjs");
const redirect = read("pages/llm-how-llms-work.html");
const server = read("scripts/dev-server.mjs");
const pages = read(".github/workflows/pages.yml");

const checks = [
  [html.includes('<html lang="ar" dir="rtl">'), "Arabic document direction"],
  [html.includes('name="description"'), "page description metadata"],
  [html.includes('property="og:title"'), "Open Graph metadata"],
  [html.includes('rel="canonical"'), "canonical URL"],
  [html.includes("Al-Idrisi.AI"), "Al-Idrisi.AI project identity"],
  [html.includes("https://zo-dns.github.io/Al-Idrisi.AI/"), "renamed canonical URL"],
  [!build.includes("claude.ai/code/artifact"), "no Claude Artifact redirect in builder"],
  [!redirect.includes("claude.ai/code/artifact"), "no Claude Artifact redirect in legacy page"],
  [redirect.includes("ai-how-ai-works.html#llm"), "legacy LLM link stays local"],
  [server.includes("fileURLToPath(import.meta.url)"), "portable development root"],
  [!/(?:^|[\s"'(=])[A-Za-z]:[\\/]/m.test(server), "no machine-specific server path"],
  [pages.includes("npm run verify"), "Pages waits for verification"],
  [pages.includes("cp pages/ai-how-ai-works.html _site/index.html"), "Pages entry point"],
  [pages.includes("--exclude='**/raw/**'"), "raw training data excluded from Pages"],
  [!existsSync(join(ROOT, "pages/ai-how-ai-works-standalone.html")), "no duplicate standalone atlas"],
];

for (const [ok, label] of checks) {
  if (!ok) throw new Error(`launch readiness failed: ${label}`);
  console.log(`PASS | ${label}`);
}

console.log("\nLAUNCH READINESS CHECK PASSED");
