import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const TARGETS = ["atlas-template.html", "ai-how-ai-works.html"];

function extractLibrary(file) {
  const source = fs.readFileSync(file, "utf8");
  const baseMatch = source.match(/\/\*ACADEMIC_SOURCES_START\*\/(.*?)\/\*ACADEMIC_SOURCES_END\*\//s);
  const additionsMatch = source.match(/const ACADEMIC_SOURCE_ADDITIONS = (\{.*?\n\});\nfor \(const \[label, additions\]/s);
  const normalizeMatch = source.match(/\/\*ACADEMIC_LIBRARY_NORMALIZE_START\*\/(.*?)\/\*ACADEMIC_LIBRARY_NORMALIZE_END\*\//s);
  assert(baseMatch && additionsMatch && normalizeMatch, `${file}: academic-library markers are incomplete`);

  const library = JSON.parse(baseMatch[1]);
  const additions = vm.runInNewContext(`(${additionsMatch[1]})`);
  for (const [label, items] of Object.entries(additions)) {
    const section = library.sections.find((candidate) => candidate.label === label);
    assert(section, `${file}: missing section ${label}`);
    const existing = new Set(section.items.map((item) => item.t));
    for (const item of items) if (!existing.has(item.t)) section.items.push(item);
  }

  const context = { ACADEMIC_SOURCES: library };
  vm.createContext(context);
  vm.runInContext(normalizeMatch[1], context, { filename: file });
  return JSON.parse(JSON.stringify(context.ACADEMIC_SOURCES));
}

function assertOne(catalog, predicate, message) {
  const matches = catalog.filter(predicate);
  assert.equal(matches.length, 1, message);
  return matches[0];
}

function verify(file) {
  const source = fs.readFileSync(file, "utf8");
  assert(source.includes("المصادر الرسمية والأكاديمية"), `${file}: official-and-academic library label`);
  const library = extractLibrary(file);
  const catalog = library.catalog;
  const displayed = library.foundations.length + library.sections.reduce((sum, section) => sum + section.items.length, 0);

  assert.equal(catalog.length, 389, `${file}: canonical source count`);
  assert.equal(displayed, 389, `${file}: displayed source count`);
  assert.equal(new Set(catalog.map((item) => item.id)).size, 389, `${file}: stable source IDs`);
  assert(catalog.every((item) => Array.isArray(item.u) && item.u.length > 0), `${file}: every source needs usage tags`);
  assert(catalog.every((item) => item.url?.startsWith("https://")), `${file}: every live source needs an accepted HTTPS evidence URL`);

  assert.deepEqual(
    library.archived.map((item) => item.t).sort(),
    ["Introducing GitHub Copilot: Your AI Pair Programmer", "Klarna AI Assistant Handles Two-Thirds of Customer Service Chats in Its First Month"].sort(),
    `${file}: provenance archive`
  );
  assert(library.archived.every((item) => item.archivedReason && item.previousGroup), `${file}: archived records need reasons and prior groups`);
  assert(catalog.every((item) => !library.archived.some((archived) => archived.t === item.t)), `${file}: archived entries must not remain displayed`);

  const aiAct = assertOne(catalog, (item) => item.t.includes("Artificial Intelligence Act"), `${file}: EU AI Act must be one canonical record`);
  assert.equal(aiAct.u.length, 3, `${file}: EU AI Act usage tags`);
  assert.equal(aiAct.url, "https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=en");

  const oecd = assertOne(catalog, (item) => item.t === "Recommendation of the Council on Artificial Intelligence", `${file}: OECD living instrument`);
  assert.equal(oecd.u.length, 2, `${file}: OECD usage tags`);
  assert.match(oecd.v, /adopted 2019; amended May 2024/);

  const datasheets = assertOne(catalog, (item) => item.t === "Datasheets for Datasets", `${file}: Datasheets metadata`);
  assert.equal(datasheets.y, 2021);
  assert.equal(datasheets.doi, "10.1145/3458723");

  const alpac = assertOne(catalog, (item) => item.t === "Language and Machines: Computers in Translation and Linguistics", `${file}: ALPAC title`);
  assert.equal(alpac.a, "National Research Council (ALPAC)");
  assert.equal(alpac.doi, "10.17226/9547");
  assert.equal(catalog.filter((item) => item.t.startsWith("Languages and Machines")).length, 0, `${file}: stale plural ALPAC title`);

  const faiss = assertOne(catalog, (item) => item.t.startsWith("Billion-Scale Similarity Search with GPUs"), `${file}: FAISS metadata`);
  assert.equal(faiss.y, 2021);
  assert.equal(faiss.doi, "10.1109/TBDATA.2019.2921572");

  const lovelace = assertOne(catalog, (item) => item.t.startsWith("Sketch of the Analytical Engine Invented by Charles Babbage"), `${file}: Lovelace/Menabrea title`);
  assert.equal(lovelace.id, "src-d909e10c", `${file}: Lovelace stable ID`);
  assert.equal(lovelace.a, "Menabrea; translated and annotated by Lovelace");
  assert.match(lovelace.v, /Scientific Memoirs, vol\. 3: 666-731/);
  assert.equal(catalog.filter((item) => item.t.startsWith("Notes on the Analytical Engine")).length, 0, `${file}: stale abbreviated Lovelace title`);

  const rsp = assertOne(catalog, (item) => item.t === "Responsible Scaling Policy, Version 3.3", `${file}: current Anthropic RSP`);
  assert.equal(rsp.y, 2026);
  assert.match(rsp.v, /May 26, 2026/);

  const alphaProof = assertOne(catalog, (item) => item.t === "Olympiad-Level Formal Mathematical Reasoning with Reinforcement Learning", `${file}: AlphaProof paper`);
  assert.equal(alphaProof.y, 2026);
  assert.equal(alphaProof.doi, "10.1038/s41586-025-09833-y");

  const deepSeek = assertOne(catalog, (item) => item.t.startsWith("DeepSeek-R1 incentivizes"), `${file}: DeepSeek Nature paper`);
  assert.equal(deepSeek.a, "Guo et al.");
  assert.equal(deepSeek.doi, "10.1038/s41586-025-09422-z");

  assertOne(catalog, (item) => item.t === "Content Credentials Technical Specification, Version 2.3", `${file}: C2PA 2.3`);
  assertOne(catalog, (item) => item.t === "OWASP Top 10 for LLM Applications, Version 2.0 (2025)", `${file}: OWASP v2`);
  assertOne(catalog, (item) => item.t === "Speech and Language Processing (3rd ed. online manuscript)" && item.y === 2026, `${file}: SLP3 date`);
  assertOne(catalog, (item) => item.t === "Preparedness Framework, Version 2" && item.y === 2025, `${file}: OpenAI Preparedness v2`);
  assertOne(catalog, (item) => item.t === "Preparedness Framework (initial version)" && item.y === 2023, `${file}: OpenAI Preparedness initial version`);

  assert.equal(catalog.filter((item) => item.t.startsWith("Fast Planning Through Planning Graph Analysis")).length, 2, `${file}: preserve Graphplan 1995/1997`);
  assert.equal(catalog.filter((item) => /dropout/i.test(`${item.t} ${item.v}`)).length, 2, `${file}: preserve Dropout draft and publication`);
  assert.equal(catalog.filter((item) => /Playing Atari with Deep Reinforcement Learning|Human-Level Control through Deep Reinforcement Learning/.test(item.t)).length, 2, `${file}: preserve DQN preliminary and final papers`);

  const stale = catalog.filter((item) => /Shmitchell|Version 3\.4|C2PA Technical Specification|Large Language Model Applications$|the standard AI textbook/.test(`${item.a} ${item.t} ${item.v}`));
  assert.deepEqual(stale, [], `${file}: stale metadata must be absent from the live catalog`);
  return library;
}

const [templateLibrary, builtLibrary] = TARGETS.map(verify);
assert.deepEqual(
  builtLibrary.catalog.map(({ id, t, u }) => ({ id, t, u })),
  templateLibrary.catalog.map(({ id, t, u }) => ({ id, t, u })),
  "built atlas must preserve the canonical academic catalog"
);

console.log("academic source library: 389 canonical records, 2 provenance-only archives — OK");
