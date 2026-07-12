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

/* الروابط العابرة منوعة (تتمة المادة 3، 12 يوليو 2026): كل رابط [a, b, نوع] — النوع من XLINK_TYPES ادناه،
   والاتجاه معياري: في uses المعتمد قبل الركيزة، في hist المحطة الاقدم/المؤرخة اولا، في solves المعالجة قبل المشكلة،
   في is الصنف قبل الفئة، في part الجزء قبل الكل، في cross المظلة اولا. peer تناظري بلا اتجاه. */
const XLINKS_AI = [
  ["rlhf", "rl", "uses"], ["llm", "transformer", "uses"], ["pretraining", "gpu", "uses"], ["databias", "bias", "is"],
  ["embeddings", "tokens", "uses"], ["vision", "cnn", "uses"], ["imagegen", "gan", "uses"], ["alexnet", "cnn", "hist"],
  ["alphago", "rl", "hist"], ["attention2017", "transformer", "hist"], ["chatgpt2022", "llm", "hist"], ["nlp", "llm", "uses"],
  ["safety", "rlhf", "uses"], ["rag", "hallucination", "solves"], ["rag", "cutoff", "solves"], ["genai", "llm", "cross"],
  ["genai", "imagegen", "cross"], ["benchmarks", "evaluation", "is"], ["scaling", "gpu", "uses"], ["multimodal", "vision", "uses"],
  ["redteam", "promptinjection", "solves"], ["deepblue", "classic", "hist"], ["dartmouth", "classic", "hist"], ["alphago", "classic", "hist"],
  ["prob", "classic", "peer"], ["ml", "prob", "uses"], ["rl", "prob", "uses"], ["genai", "gan", "cross"], ["genai", "dl", "cross"],
  ["agents", "rl", "uses"], ["agents", "classic", "uses"], ["agents", "llm", "uses"],
  /* روابط المراجعة الخبرية الاولى (10 يوليو 2026): عقد فروع-من-الجذر المعروضة تحت اب ملاحي */
  ["xai", "ml", "uses"], ["governance", "xai", "uses"], ["multiagent", "agents", "is"], ["multiagent", "rl", "uses"],
  ["education", "llm", "uses"],
];
const XLINKS_LLM = [
  ["temp2", "hallu2", "affects"], ["rag2", "hallu2", "solves"], ["scaling2", "gpuclusters", "uses"], ["rlhf2", "alignment", "is"],
  ["constitutional", "alignment", "is"], ["reasoning2", "cot", "uses"], ["decoder", "autoregressive", "uses"],
  ["moe", "inference2", "solves"], ["deepseek", "moe", "uses"], ["kvcache", "context2", "enables"], ["paper2017", "transformer2", "hist"],
  ["gpt", "icl", "hist"], ["nexttoken", "autoregressive", "part"],
];
const XLINKS_DL = [
  ["relu", "vanishing", "solves"], ["batchnorm", "vanishing", "solves"], ["resnet", "vanishing", "solves"],
  ["backprop", "autograd", "is"], ["adam", "sgd", "is"], ["dropout", "overfitting", "solves"],
  ["augment", "overfitting", "solves"], ["vision", "cnn", "uses"], ["genai", "gan", "cross"], ["genai", "diffusion", "cross"],
  ["alexnet", "gpu", "uses"], ["kernel", "conv", "part"], ["lstm", "vanishing", "solves"], ["genai", "transformer", "uses"],
  ["backprop-1986", "backprop", "hist"], ["alexnet", "cnn", "hist"], ["resnet-2015", "resnet", "hist"],
  ["gcn", "conv", "is"], ["gat", "attention2", "uses"], ["gnn", "cnn", "peer"],
];
const XLINKS_ML = [
  ["logreg", "classification", "is"], ["linreg", "regression", "is"], ["curse-dim", "knn", "affects"],
  ["decisiontree", "randomforest", "part"], ["randomforest", "ensemble", "is"], ["pca", "dimreduction", "is"],
  ["kmeans", "clustering", "is"], ["regularization", "overfitting", "solves"], ["underfitting", "biasvariance", "part"],
  ["crossval", "datasplit", "is"], ["knn", "scaling", "uses"], ["datasplit", "leakage", "solves"],
  ["xgboost-2014", "ensemble", "hist"], ["svm-era", "svm", "hist"], ["mitchell-1997", "what-ml", "hist"],
  ["dl-bridge", "generalization", "uses"], ["decisiontree", "interpretability", "is"],
  ["selfsupervised", "semisupervised", "peer"],
];
const XLINKS_DATA = [
  ["cleaning", "quality", "part"], ["imputation", "completeness", "solves"], ["duplicates", "leakage-d", "affects"],
  ["cleaning", "consistency", "affects"], ["outliers", "noise", "peer"], ["imagenet-d", "publicdata", "is"],
  ["commoncrawl", "webscraping", "uses"], ["llm-data", "textdata", "is"], ["synthetic", "imbalance", "solves"],
  ["gdpr", "privacy-d", "hist"], ["diffprivacy", "anonymization", "peer"], ["datacentric", "quality", "uses"],
  ["bigdata-era", "bigdata", "hist"], ["sampling", "databias", "affects"], ["tabular", "structured", "is"],
  ["normalization", "datasplit-d", "uses"],
];
const XLINKS_ETHICS = [
  ["gender-shades", "algorithmic-auditing", "hist"], ["algorithmic-auditing", "fairness-metrics", "uses"], ["gdpr-e", "machine-unlearning", "affects"],
  ["differential-privacy", "privacy-attacks", "solves"], ["red-teaming-e", "dangerous-capability-evals", "peer"], ["data-poisoning", "owasp-llm-top10", "part"],
  ["scalable-oversight", "reward-hacking", "solves"], ["mechanistic-interpretability", "explainability-xai", "is"], ["human-oversight", "eu-ai-act", "part"],
  ["nist-ai-rmf", "ai-risk-management", "is"], ["responsible-scaling-policies", "catastrophic-cbrn-risk", "solves"], ["agi-e", "alignment-control", "affects"],
  ["rlhf-e", "alignment-problem", "solves"], ["constitutional-ai-e", "scalable-oversight", "is"],
  ["human-oversight", "alignment-control", "part"], ["human-oversight", "governance-regulation", "part"],
];
const XLINKS_APPS = [
  ["self-driving-cars", "object-detection", "uses"], ["medical-imaging", "object-detection", "uses"], ["rag-knowledge-assistants", "conversational-assistants", "is"],
  ["conversational-assistants", "coding-assistants", "peer"], ["speech-recognition-asr", "text-to-speech", "peer"], ["generative-editing", "text-to-image", "uses"],
  ["drug-discovery", "protein-structure", "uses"], ["drug-discovery", "genomics-ai", "uses"], ["computational-advertising", "recommendation-engines", "uses"],
  ["fraud-detection", "demand-forecasting", "peer"], ["agentic-coding", "coding-assistants", "is"], ["rag-knowledge-assistants", "semantic-search", "uses"],
  ["model-adaptation", "foundation-model-apis", "uses"], ["inference-serving", "edge-on-device", "peer"],
  ["ai-tutoring", "conversational-assistants", "uses"],
];
const XLINKS_CLASSIC = [
  ["astar", "heuristic", "uses"], ["ucs", "astar", "is"], ["astar", "admissibility", "uses"], ["alpha-beta", "minimax", "is"],
  ["minimax", "mcts", "peer"], ["deep-blue", "alpha-beta", "uses"], ["sat-dpll", "csp", "is"], ["csp", "local-search", "uses"],
  ["resolution", "fol", "uses"], ["resolution", "inference", "is"], ["strips", "fol", "uses"], ["planning", "astar", "uses"],
  ["expert-systems", "kr", "uses"], ["alphago-bridge", "neuro-symbolic", "is"],
  ["combinatorial-explosion", "game-tree", "affects"], ["combinatorial-explosion", "state-space-planning", "affects"], ["combinatorial-explosion", "inference", "affects"],
  ["min-conflicts", "local-search", "is"], ["walksat", "local-search", "is"],
];
const XLINKS_RL = [
  ["q-learning", "td-learning", "is"], ["sarsa", "q-learning", "peer"], ["dqn", "q-learning", "is"], ["actor-critic", "td-learning", "uses"],
  ["value-iteration", "bellman-optimality", "uses"], ["td-error", "q-learning", "part"], ["ucb", "exploration-exploitation", "solves"], ["deadly-triad", "q-learning", "affects"],
  ["rlhf-bridge", "ppo", "uses"], ["td-gammon", "td-learning", "hist"], ["alphago", "self-play", "uses"], ["dqn", "function-approximation", "uses"], ["ppo", "trpo", "is"],
  ["muzero", "model-based-rl", "is"],
];
const XLINKS_PROB = [
  ["bayes-rule", "conditional-prob", "uses"], ["bayes-net", "conditional-independence", "uses"], ["d-separation", "conditional-independence", "uses"],
  ["gibbs-sampling", "markov-blanket", "uses"], ["variable-elimination", "bn-factorization", "uses"], ["mcmc-history", "mcmc", "hist"],
  ["kalman-1960", "kalman-filter", "hist"], ["pearl-1988", "bayes-net", "hist"], ["em-algorithm", "forward-backward", "uses"],
  ["vae-p", "variational-inference", "uses"], ["naive-bayes-p", "conditional-independence", "uses"], ["pomdp", "temporal-models", "is"],
  ["enumeration-inference", "marginalization", "uses"], ["bayes-1763", "bayes-rule", "hist"], ["diffusion-p", "variational-inference", "uses"],
  ["markov-random-field", "bayes-net", "peer"], ["causal-inference", "bayes-net", "uses"], ["belief-propagation", "approx-inference", "is"],
];
/* عالم التاريخ: سلاسل تاثير زمنية بين محطات مؤرخة — الاتجاه دائما من الاقدم الى الاحدث */
const XLINKS_HISTORY = [
  ["turing-machine", "turing-1950", "hist"], ["mcculloch-pitts", "perceptron", "hist"], ["perceptron", "perceptrons-book", "hist"],
  ["perceptrons-book", "backprop-1986", "hist"], ["shannon-chess", "deep-blue", "hist"], ["lecun-convnet", "alexnet", "hist"],
  ["imagenet", "alexnet", "hist"], ["dqn-atari", "alphago", "hist"], ["deep-blue", "alphago", "hist"],
  ["transformer", "gpt-series", "hist"], ["eliza", "chatgpt", "hist"], ["backprop-1986", "turing-award-2018", "hist"],
  ["hopfield-net", "nobel-2024", "hist"], ["alphafold2", "nobel-2024", "hist"],
];

/* طبقة الدلالة (دستور الخريطة الام، README المادة 3): rt نوع العلاقة، nt نوع عقدة الحلقة الاولى، sp اب المعنى، rn جملة العلاقة */
const REL_TYPES = new Set(["is", "part", "uses", "cross", "ctx", "enables"]);
const NODE_TYPES = new Set(["field", "flat", "ctx", "umbrella", "enabler", "framework"]);
/* انواع الروابط العابرة (تعديل المادة 3 الموثق، 12 يوليو 2026): الدستورية الخمسة القابلة للتطبيق
   + hist محطة-تاريخية · solves معالجة-مشكلة · peer نظير-مقابل · affects مؤثر-مباشر */
const XLINK_TYPES = new Set(["is", "part", "uses", "enables", "cross", "hist", "solves", "peer", "affects"]);

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
  /* قاعدة المحاور: البروز h لعقدة حلقة اولى او لعقدة داخلية ترسو عائلة (لها ابناء) — يمنع البروز اليتيم والالوان الدخيلة كسوابق dyna/creativity/tooluse */
  for (const nd of NODES) {
    if (nd.h && nd.k !== "root" && nd.p !== "root" && !NODES.some((x) => x.p === nd.k))
      throw new Error(name + ": محور داخلي بلا ابناء (بروز يتيم): " + nd.k);
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
  const xlinks = XLINKS.map(([a, b, t]) => {
    if (!keyToIdx.has(a) || !keyToIdx.has(b)) throw new Error(name + " رابط مجهول: " + a + "-" + b);
    if (!XLINK_TYPES.has(t)) throw new Error(name + " رابط عابر بلا نوع معتمد (" + t + "): " + a + "-" + b);
    return [keyToIdx.get(a), keyToIdx.get(b), t];
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
