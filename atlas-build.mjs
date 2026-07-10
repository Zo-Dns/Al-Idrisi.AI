// يبني الاطلس الموحد (عالمان في ملف واحد) + ملفات اعادة التوجيه للرابط القديم
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as AI from "./ai-content.mjs";
import * as LLM from "./llm-content.mjs";
import * as DL from "./dl-content.mjs";
import * as ML from "./ml-content.mjs";
import * as DATA from "./data-content.mjs";
import * as ETHICS from "./ethics-content.mjs";
import * as APPS from "./apps-content.mjs";
import * as CLASSIC from "./classic-content.mjs";
import * as RL from "./rl-content.mjs";
import * as PROB from "./prob-content.mjs";
import * as HISTORY from "./history-content.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const HARAKAT = /[ً-ْٰ]/;

const XLINKS_AI = [
  ["rlhf", "rl"], ["transformer", "llm"], ["gpu", "pretraining"], ["databias", "bias"],
  ["embeddings", "tokens"], ["vision", "cnn"], ["imagegen", "gan"], ["alexnet", "cnn"],
  ["alphago", "rl"], ["attention2017", "transformer"], ["chatgpt2022", "llm"], ["nlp", "llm"],
  ["safety", "rlhf"], ["rag", "hallucination"], ["cutoff", "rag"], ["genai", "llm"],
  ["genai", "imagegen"], ["benchmarks", "evaluation"], ["scaling", "gpu"], ["multimodal", "vision"],
  ["promptinjection", "redteam"], ["deepblue", "classic"], ["dartmouth", "classic"], ["alphago", "classic"],
  ["prob", "classic"], ["prob", "ml"], ["prob", "rl"], ["genai", "gan"], ["genai", "dl"],
  ["agents", "rl"], ["agents", "classic"], ["agents", "llm"],
];
const XLINKS_LLM = [
  ["temp2", "hallu2"], ["rag2", "hallu2"], ["scaling2", "gpuclusters"], ["rlhf2", "alignment"],
  ["constitutional", "alignment"], ["cot", "reasoning2"], ["decoder", "autoregressive"],
  ["moe", "inference2"], ["deepseek", "moe"], ["kvcache", "context2"], ["paper2017", "transformer2"],
  ["icl", "gpt"], ["nexttoken", "autoregressive"],
];
const XLINKS_DL = [
  ["relu", "vanishing"], ["batchnorm", "vanishing"], ["resnet", "vanishing"],
  ["backprop", "autograd"], ["adam", "sgd"], ["dropout", "overfitting"],
  ["augment", "overfitting"], ["cnn", "vision"], ["gan", "genai"], ["diffusion", "genai"],
  ["gpu", "alexnet"], ["conv", "kernel"], ["lstm", "vanishing"], ["transformer", "genai"],
  ["backprop-1986", "backprop"], ["alexnet", "cnn"], ["resnet-2015", "resnet"],
  ["gcn", "conv"], ["gat", "attention2"], ["gnn", "cnn"],
];
const XLINKS_ML = [
  ["logreg", "classification"], ["linreg", "regression"], ["knn", "curse-dim"],
  ["decisiontree", "randomforest"], ["randomforest", "ensemble"], ["pca", "dimreduction"],
  ["kmeans", "clustering"], ["regularization", "overfitting"], ["biasvariance", "underfitting"],
  ["crossval", "datasplit"], ["scaling", "knn"], ["leakage", "datasplit"],
  ["xgboost-2014", "ensemble"], ["svm-era", "svm"], ["mitchell-1997", "what-ml"],
  ["dl-bridge", "generalization"], ["interpretability", "decisiontree"],
];
const XLINKS_DATA = [
  ["cleaning", "quality"], ["imputation", "completeness"], ["duplicates", "leakage-d"],
  ["consistency", "cleaning"], ["outliers", "noise"], ["imagenet-d", "publicdata"],
  ["commoncrawl", "webscraping"], ["llm-data", "textdata"], ["synthetic", "imbalance"],
  ["gdpr", "privacy-d"], ["diffprivacy", "anonymization"], ["datacentric", "quality"],
  ["bigdata-era", "bigdata"], ["databias", "sampling"], ["tabular", "structured"],
  ["normalization", "datasplit-d"],
];
const XLINKS_ETHICS = [
  ["gender-shades", "algorithmic-auditing"], ["fairness-metrics", "algorithmic-auditing"], ["gdpr-e", "machine-unlearning"],
  ["differential-privacy", "privacy-attacks"], ["red-teaming-e", "dangerous-capability-evals"], ["owasp-llm-top10", "data-poisoning"],
  ["reward-hacking", "scalable-oversight"], ["mechanistic-interpretability", "explainability-xai"], ["eu-ai-act", "human-oversight"],
  ["nist-ai-rmf", "ai-risk-management"], ["responsible-scaling-policies", "catastrophic-cbrn-risk"], ["agi-e", "alignment-control"],
  ["rlhf-e", "alignment-problem"], ["constitutional-ai-e", "scalable-oversight"],
  ["human-oversight", "alignment-control"], ["human-oversight", "governance-regulation"],
];
const XLINKS_APPS = [
  ["object-detection", "self-driving-cars"], ["medical-imaging", "object-detection"], ["conversational-assistants", "rag-knowledge-assistants"],
  ["conversational-assistants", "coding-assistants"], ["speech-recognition-asr", "text-to-speech"], ["text-to-image", "generative-editing"],
  ["protein-structure", "drug-discovery"], ["genomics-ai", "drug-discovery"], ["recommendation-engines", "computational-advertising"],
  ["fraud-detection", "demand-forecasting"], ["coding-assistants", "agentic-coding"], ["rag-knowledge-assistants", "semantic-search"],
  ["foundation-model-apis", "model-adaptation"], ["inference-serving", "edge-on-device"],
];
const XLINKS_CLASSIC = [
  ["astar", "heuristic"], ["astar", "ucs"], ["astar", "admissibility"], ["minimax", "alpha-beta"],
  ["minimax", "mcts"], ["deep-blue", "alpha-beta"], ["csp", "sat-dpll"], ["csp", "local-search"],
  ["resolution", "fol"], ["resolution", "inference"], ["strips", "fol"], ["planning", "astar"],
  ["expert-systems", "kr"], ["neuro-symbolic", "alphago-bridge"],
  ["combinatorial-explosion", "game-tree"], ["combinatorial-explosion", "state-space-planning"], ["combinatorial-explosion", "inference"],
  ["min-conflicts", "local-search"], ["walksat", "local-search"],
];
const XLINKS_RL = [
  ["q-learning", "td-learning"], ["sarsa", "q-learning"], ["dqn", "q-learning"], ["actor-critic", "td-learning"],
  ["value-iteration", "bellman-optimality"], ["td-error", "q-learning"], ["ucb", "exploration-exploitation"], ["deadly-triad", "q-learning"],
  ["ppo", "rlhf-bridge"], ["td-gammon", "td-learning"], ["alphago", "self-play"], ["dqn", "function-approximation"], ["ppo", "trpo"],
];
const XLINKS_PROB = [
  ["bayes-rule", "conditional-prob"], ["bayes-net", "conditional-independence"], ["d-separation", "conditional-independence"],
  ["gibbs-sampling", "markov-blanket"], ["variable-elimination", "bn-factorization"], ["mcmc", "mcmc-history"],
  ["kalman-filter", "kalman-1960"], ["bayes-net", "pearl-1988"], ["em-algorithm", "forward-backward"],
  ["vae-p", "variational-inference"], ["naive-bayes-p", "conditional-independence"], ["pomdp", "temporal-models"],
  ["enumeration-inference", "marginalization"], ["bayes-1763", "bayes-rule"], ["diffusion-p", "variational-inference"],
  ["markov-random-field", "bayes-net"], ["causal-inference", "bayes-net"], ["belief-propagation", "approx-inference"],
];
const XLINKS_HISTORY = [
  ["turing-1950", "turing-machine"], ["mcculloch-pitts", "perceptron"], ["perceptrons-book", "perceptron"],
  ["backprop-1986", "perceptrons-book"], ["deep-blue", "shannon-chess"], ["lecun-convnet", "alexnet"],
  ["imagenet", "alexnet"], ["alphago", "dqn-atari"], ["alphago", "deep-blue"],
  ["transformer", "gpt-series"], ["chatgpt", "eliza"], ["turing-award-2018", "backprop-1986"],
  ["nobel-2024", "hopfield-net"], ["nobel-2024", "alphafold2"],
];

/* طبقة الدلالة (دستور الخريطة الام، README المادة 3): rt نوع العلاقة، nt نوع عقدة الحلقة الاولى، sp اب المعنى، rn جملة العلاقة */
const REL_TYPES = new Set(["is", "part", "uses", "cross", "ctx"]);
const NODE_TYPES = new Set(["field", "flat", "ctx", "umbrella"]);

function compile(name, { GROUPS, NODES, JOURNEY }, XLINKS) {
  for (const nd of NODES) for (const v of [nd.n, nd.d, nd.e, nd.rn]) {
    if (v && HARAKAT.test(v)) throw new Error(name + " تشكيل في " + nd.k);
  }
  for (const s of JOURNEY) if (HARAKAT.test(s.t)) throw new Error(name + " تشكيل خطوة " + s.k);
  for (const g of GROUPS) if (HARAKAT.test(g.name)) throw new Error(name + " تشكيل مجموعة");
  const keyToIdx = new Map(NODES.map((nd, i) => [nd.k, i]));
  if (keyToIdx.size !== NODES.length) throw new Error(name + ": مفاتيح مكررة");
  if (NODES[0].k !== "root") throw new Error(name + ": الاولى يجب ان تكون root");
  /* فرض الدستور (المادة 7): الخريطة الام كاملة التغطية rt+nt، وكل حلقة اولى في اي عالم تعلن rt */
  for (const nd of NODES) {
    if (nd.k === "root") continue;
    if (name === "AI" && !nd.rt) throw new Error("AI: عقدة بلا نوع علاقة rt: " + nd.k);
    if (nd.p === "root" && !nd.rt) throw new Error(name + ": عقدة حلقة اولى بلا rt: " + nd.k);
    if (name === "AI" && nd.p === "root" && !nd.nt) throw new Error("AI: عقدة حلقة اولى بلا نوع nt: " + nd.k);
  }
  const nodes = NODES.map((nd) => {
    if (nd.p !== null && !keyToIdx.has(nd.p)) throw new Error(name + " اب مجهول: " + nd.p);
    const out = { k: nd.k, n: nd.n, e: nd.e, p: nd.p === null ? -1 : keyToIdx.get(nd.p), g: nd.g, h: nd.h ? 1 : 0, d: nd.d };
    if (nd.rt !== undefined) {
      if (!REL_TYPES.has(nd.rt)) throw new Error(name + " نوع علاقة مجهول (" + nd.rt + "): " + nd.k);
      out.rt = nd.rt;
    }
    if (nd.nt !== undefined) {
      if (!NODE_TYPES.has(nd.nt)) throw new Error(name + " نوع عقدة مجهول (" + nd.nt + "): " + nd.k);
      out.nt = nd.nt;
    }
    if (nd.rn !== undefined) out.rn = nd.rn;
    if (nd.sp !== undefined) {
      if (!keyToIdx.has(nd.sp)) throw new Error(name + " اب دلالي مجهول: " + nd.k + " ← " + nd.sp);
      out.sp = keyToIdx.get(nd.sp);
    }
    return out;
  });
  const xlinks = XLINKS.map(([a, b]) => {
    if (!keyToIdx.has(a) || !keyToIdx.has(b)) throw new Error(name + " رابط مجهول: " + a + "-" + b);
    return [keyToIdx.get(a), keyToIdx.get(b)];
  });
  const journey = JOURNEY.map((s) => {
    if (!keyToIdx.has(s.k)) throw new Error(name + " خطوة مجهولة: " + s.k);
    const r = (s.rel || []).map((k2) => {
      if (!keyToIdx.has(k2)) throw new Error(name + " rel مجهول: " + k2);
      return keyToIdx.get(k2);
    });
    return { i: keyToIdx.get(s.k), t: s.t, r };
  });
  return { json: JSON.stringify({ groups: GROUPS, nodes, xlinks, journey }).replace(/<\//g, "<\\/"), count: nodes.length };
}

const ai = compile("AI", AI, XLINKS_AI);
const llm = compile("LLM", LLM, XLINKS_LLM);
const dl = compile("DL", DL, XLINKS_DL);
const ml = compile("ML", ML, XLINKS_ML);
const data = compile("DATA", DATA, XLINKS_DATA);
const ethics = compile("ETHICS", ETHICS, XLINKS_ETHICS);
const apps = compile("APPS", APPS, XLINKS_APPS);
const classic = compile("CLASSIC", CLASSIC, XLINKS_CLASSIC);
const rl = compile("RL", RL, XLINKS_RL);
const prob = compile("PROB", PROB, XLINKS_PROB);
const history = compile("HISTORY", HISTORY, XLINKS_HISTORY);

let t = readFileSync(join(here, "atlas-template.html"), "utf8");
for (const ph of ["/*__DATA_AI__*/null", "/*__DATA_LLM__*/null", "/*__DATA_DL__*/null", "/*__DATA_ML__*/null", "/*__DATA_DATA__*/null", "/*__DATA_ETHICS__*/null", "/*__DATA_APPS__*/null", "/*__DATA_CLASSIC__*/null", "/*__DATA_RL__*/null", "/*__DATA_PROB__*/null", "/*__DATA_HISTORY__*/null"])
  if (!t.includes(ph)) throw new Error("data placeholder missing: " + ph);
t = t.replace("/*__DATA_AI__*/null", ai.json).replace("/*__DATA_LLM__*/null", llm.json)
     .replace("/*__DATA_DL__*/null", dl.json).replace("/*__DATA_ML__*/null", ml.json)
     .replace("/*__DATA_DATA__*/null", data.json)
     .replace("/*__DATA_ETHICS__*/null", ethics.json).replace("/*__DATA_APPS__*/null", apps.json)
     .replace("/*__DATA_CLASSIC__*/null", classic.json).replace("/*__DATA_RL__*/null", rl.json)
     .replace("/*__DATA_PROB__*/null", prob.json).replace("/*__DATA_HISTORY__*/null", history.json);

writeFileSync(join(here, "ai-how-ai-works.html"), t, "utf8");
const wrap = (b) => '<!doctype html>\n<html lang="ar">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n' + b + "\n</body>\n</html>\n";
writeFileSync(join(here, "ai-how-ai-works-standalone.html"), wrap(t), "utf8");

/* الرابط القديم لخريطة LLM يصير بوابة تحويل الى العالم الثاني داخل الاطلس */
const stub = (target) =>
  "<title>كيف تعمل النماذج اللغوية الكبيرة</title>\n" +
  '<div dir="rtl" style="font-family:Segoe UI,Tahoma,sans-serif; background:#070b15; color:#e9eef8; min-height:100vh; display:flex; align-items:center; justify-content:center; text-align:center; padding:24px">' +
  '<div><div style="font-size:18px; font-weight:700">خريطة النماذج اللغوية انتقلت الى داخل الاطلس الموحد</div>' +
  '<div style="margin-top:10px; font-size:14px; color:#8792ac">يجري تحويلك الان...</div>' +
  '<a href="' + target + '" style="display:inline-block; margin-top:14px; color:#9fdcff; font-size:14.5px">اذا لم يحدث التحويل انقر هنا</a></div></div>\n' +
  "<script>location.replace(" + JSON.stringify(target) + ");</script>";
writeFileSync(join(here, "llm-how-llms-work.html"), stub("https://claude.ai/code/artifact/27d20e2b-0a65-4db4-9493-dceb2d42ee68#llm"), "utf8");
writeFileSync(join(here, "llm-how-llms-work-standalone.html"), wrap(stub("ai-how-ai-works.html#llm")), "utf8");

console.log(`atlas: ai=${ai.count} + llm=${llm.count} + dl=${dl.count} + ml=${ml.count} + data=${data.count} + ethics=${ethics.count} + apps=${apps.count} + classic=${classic.count} + rl=${rl.count} + prob=${prob.count} + history=${history.count} nodes, size=${Math.round(t.length / 1024)}KB — OK`);
