// Temporary debug: live-shape scenario trace (placeholder question + props question + nested client)
import { build } from "esbuild";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "cheetos-debug-"));

globalThis.__cheetosDebugLog = [];
const origLog = console.log;
console.log = (...a) => globalThis.__cheetosDebugLog.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));

class FakeClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach((x) => this.set.add(x)); }
  remove(...c) { c.forEach((x) => this.set.delete(x)); }
  toggle(c, f) { if (f === undefined) { if (this.set.has(c)) { this.set.delete(c); return false; } this.set.add(c); return true; } f ? this.set.add(c) : this.set.delete(c); return !!f; }
  contains(c) { return this.set.has(c); }
}
class FakeEl {
  constructor(tag) {
    Object.defineProperty(this, "tagName", { value: String(tag).toUpperCase(), writable: true, enumerable: false });
    Object.defineProperty(this, "children", { value: [], writable: true, enumerable: false });
    Object.defineProperty(this, "parentNode", { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, "style", { value: {}, writable: true, enumerable: false });
    Object.defineProperty(this, "dataset", { value: {}, writable: true, enumerable: false });
    Object.defineProperty(this, "classList", { value: new FakeClassList(), writable: true, enumerable: false });
    Object.defineProperty(this, "listeners", { value: {}, writable: true, enumerable: false });
    Object.defineProperty(this, "id", { value: "", writable: true, enumerable: false });
    Object.defineProperty(this, "textContent", { value: "", writable: true, enumerable: false });
    Object.defineProperty(this, "innerText", { value: "", writable: true, enumerable: false });
    Object.defineProperty(this, "value", { value: "", writable: true, enumerable: false });
    Object.defineProperty(this, "type", { value: "", writable: true, enumerable: false });
    Object.defineProperty(this, "placeholder", { value: "", writable: true, enumerable: false });
    Object.defineProperty(this, "title", { value: "", writable: true, enumerable: false });
  }
  getAttribute(name) { return this[name] !== undefined ? String(this[name]) : null; }
  appendChild(c) { this.children.push(c); c.parentNode = this; }
  replaceChildren(...cs) { this.children = cs; }
  contains(node) {
    if (node === this) return true;
    return this.children.some((c) => c.contains?.(node));
  }
  addEventListener(t, fn) { this.listeners[t] = this.listeners[t] || []; this.listeners[t].push(fn); }
  dispatchEvent(ev) {
    if (!ev || !ev.type) return true;
    (this.listeners[ev.type] || []).forEach((fn) => fn.call(this, ev));
    if (ev.type === "click" && this.onclick) this.onclick.call(this, ev);
    return true;
  }
  click() {
    if (typeof this.onclick === "function") this.onclick.call(this);
    this.dispatchEvent({ type: "click", bubbles: true });
  }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

const fakeWindow = {
  location: {
    href: "https://gold.blooket.com/6a925d3379c1759b4d442d0e/play/6a925d39cbf77bbac723f474",
    hostname: "gold.blooket.com",
    pathname: "/6a925d3379c1759b4d442d0e/play/6a925d39cbf77bbac723f474",
    search: "",
    hash: "",
  },
  addEventListener(type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  },
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
  },
  dispatchEvent(ev) {
    ev.target = this;
    ev.preventDefault = ev.preventDefault || (() => {});
    ev.stopPropagation = ev.stopPropagation || (() => {});
    for (const fn of this.listeners[ev.type] || []) fn.call(this, ev);
  },
  setInterval,
  clearInterval,
  fetch: async () => ({}),
  localStorage: {
    getItem: (k) =>
      k === "cheetos.settings"
        ? JSON.stringify({ delays: false, typing: false, minDelay: 0, maxDelay: 0, accuracy: 100 })
        : null,
    setItem: () => {},
  },
};
fakeWindow.listeners = {};

const fakeDocument = {
  createElement: (t) => new FakeEl(t),
  querySelector: () => null,
  querySelectorAll: () => [],
  body: new FakeEl("body"),
  documentElement: new FakeEl("html"),
  createTextNode: (t) => ({ nodeType: 3, textContent: t }),
  listeners: {},
  addEventListener(type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  },
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
  },
};

globalThis.window = fakeWindow;
globalThis.document = fakeDocument;
globalThis.localStorage = fakeWindow.localStorage;
globalThis.HTMLElement = FakeEl;
globalThis.HTMLInputElement = FakeEl;
globalThis.HTMLTextAreaElement = FakeEl;
globalThis.getComputedStyle = () => ({ cursor: "default" });

const sendAnswers = [];
const onAnswers = [];
const textClicks = [];

const ANSWERS = ["before school or during free time", "while my teacher is teaching", "during lunch", "at midnight"];
const fullQuestion = {
  question: "When should I study?",
  answers: ANSWERS,
  correctAnswers: ["while my teacher is teaching"],
};

// question-card hook state: question is a PLACEHOLDER like the live page ("?" with no answers)
const qcardState = {
  question: { question: "?", answers: [] },
  feedback: null, slideIn: true, slideOut: false, theme: {},
  sendAnswer: (text) => sendAnswers.push(text),
  sendAnswerNext: () => {},
  settings: { time: 30 },
  dontAdvanceQuestion: false,
};
const qcardHook = { memoizedState: qcardState, queue: { dispatch: () => {} }, next: null };

// game client lives nested inside a hook value ({state, client}) - the shape our scan missed
const gameClient = { name: "peep", blook: "Chick", g: 5, isRandom: false, type: "gold" };
const gameHookVal = {
  state: { stage: "question", choices: ["A", "B", "C", "D"], clients: { peep: { g: 5 } } },
  client: gameClient,
};
const gameHook = { memoizedState: gameHookVal, queue: { dispatch: () => {} }, next: null };

const hostRoot = {
  memoizedState: { element: { type: () => {}, props: {}, key: null } },
  memoizedProps: null,
  dependencies: { firstContext: null },
  stateNode: null,
  child: null,
};
const gameFiber = {
  type: () => {},
  stateNode: null,
  memoizedState: gameHook,
  memoizedProps: { question: fullQuestion, onAnswer: (t, c) => onAnswers.push([t, c]) },
  dependencies: { firstContext: null },
  child: null,
  sibling: null,
  return: hostRoot,
};
const appFiber = {
  type: () => {},
  stateNode: null,
  memoizedState: qcardHook,
  memoizedProps: { question: qcardState.question },
  dependencies: { firstContext: null },
  child: null,
  sibling: gameFiber,
  return: hostRoot,
};
hostRoot.child = appFiber;

const hostEl = fakeDocument.createElement("div");
hostEl["__reactContainer$prod"] = hostRoot;
fakeDocument.domRoots = [hostEl];

const textEls = [];
const mkTextEl = (text) => {
  const el = fakeDocument.createElement("div");
  el.textContent = text;
  el.click = () => textClicks.push(text);
  textEls.push(el);
  return el;
};
ANSWERS.forEach(mkTextEl);
fakeDocument.textEls = textEls;
fakeDocument.querySelectorAll = (sel) => {
  if (sel === "iframe") return [];
  if (sel === "body *") return fakeDocument.domRoots || [];
  if (sel === "div,button,span,p,[role='button']") return fakeDocument.textEls;
  return [];
};

const res = await build({
  entryPoints: [join(root, "src/index.ts")],
  bundle: true,
  format: "iife",
  write: false,
  sourcemap: false,
  minify: false,
  platform: "browser",
  target: "es2019",
  logLevel: "silent",
});
if (res.errors && res.errors.length) {
  origLog("ESBUILD-ERRORS " + JSON.stringify(res.errors));
  process.exit(1);
}
const code = res.outputFiles[0].text;
origLog("BUNDLE-BYTES " + code.length);
try {
  eval(code);
} catch (err) {
  origLog("EVAL-ERROR " + (err && err.stack ? err.stack : String(err)));
  origLog(globalThis.__cheetosDebugLog.join("\n"));
  process.exit(1);
}

origLog("PROBE keys=" + Object.keys(fakeWindow).join(",") + " loaded=" + fakeWindow.__cheetosLoaded + " version=" + fakeWindow.__cheetosVersion + " loglen=" + globalThis.__cheetosDebugLog.length);
const api = fakeWindow.cheetos;
if (!api) {
  origLog("BOOTSTRAP-FAILED");
  origLog(globalThis.__cheetosDebugLog.join("\n"));
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(700);

console.log = (...a) => globalThis.__cheetosDebugLog.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));

const q = api.question();
console.log("QUESTION", JSON.stringify(q && { question: q.question, answers: q.answers, correctAnswers: q.correctAnswers }));
console.log("CLIENT", JSON.stringify(api.client() && { name: api.client().name, blook: api.client().blook, g: api.client().g }));
console.log("NODE-Q", JSON.stringify((() => { const n = api.node(); const qq = typeof n.question === "function" ? n.question() : n.question; return qq && { question: qq.question, n: qq.answers && qq.answers.length }; })()));

console.log("ANSWERIDX1", api.answerIndex(1));
console.log("CLICKS", JSON.stringify(textClicks));

api.runCheat("global-auto-answer");
await sleep(400);
console.log("AUTOCLICKS", JSON.stringify(textClicks));
console.log("SENDANSWERS", JSON.stringify(sendAnswers));

api.runCheat("global-every-correct");
await sleep(200);
console.log("EAC-CORRECTS", JSON.stringify(fullQuestion.correctAnswers));

origLog(globalThis.__cheetosDebugLog.join("\n"));
process.exit(0);
