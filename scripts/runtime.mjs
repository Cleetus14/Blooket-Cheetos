import { build } from "esbuild";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "cheetos-runtime-"));

const origLog = console.log;
const consoleLogs = [];
console.log = (...args) => {
  consoleLogs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
};

class FakeClassList {
  constructor() {
    this.set = new Set();
  }
  add(...c) {
    c.forEach((x) => this.set.add(x));
  }
  remove(...c) {
    c.forEach((x) => this.set.delete(x));
  }
  toggle(c, force) {
    if (force === undefined) {
      if (this.set.has(c)) {
        this.set.delete(c);
        return false;
      }
      this.set.add(c);
      return true;
    }
    force ? this.set.add(c) : this.set.delete(c);
    return !!force;
  }
  contains(c) {
    return this.set.has(c);
  }
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
  appendChild(c) {
    this.children.push(c);
    c.parentNode = this;
    return c;
  }
  replaceChildren(...cs) {
    this.children = cs;
  }
  contains(node) {
    if (node === this) return true;
    return this.children.some((c) => c.contains?.(node));
  }
  addEventListener(type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
  }
  dispatchEvent(ev) {
    ev.target = this;
    ev.preventDefault = ev.preventDefault || (() => {});
    ev.stopPropagation = ev.stopPropagation || (() => {});
    for (const fn of this.listeners[ev.type] || []) fn.call(this, ev);
  }
  click() {
    this.dispatchEvent({ type: "click" });
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 };
  }
  setPointerCapture() {}
  remove() {
    const p = this.parentNode;
    if (p) p.children = p.children.filter((c) => c !== this);
  }
}

const elementsById = new Map();
const fakeDocument = {
  body: null,
  iframes: [],
  answerContainers: [],
  feedbackEl: null,
  typingWrapper: null,
  domRoots: [],
  createElement(tag) {
    const el = new FakeEl(tag);
    if (el.id) elementsById.set(el.id, el);
    return el;
  },
  getElementById(id) {
    return elementsById.get(id) || null;
  },
  querySelector(sel) {
    if (sel === "body>div") return this.body.children[0] || null;
    if (sel.includes("feedback")) return this.feedbackEl;
    if (sel.includes("typingAnswerWrapper")) return this.typingWrapper;
    return null;
  },
  querySelectorAll(sel) {
    if (sel === "iframe") return this.iframes;
    if (sel === "body *") return this.domRoots;
    if (sel.includes("answerContainer")) return this.answerContainers;
    return [];
  },
  addEventListener() {},
  removeEventListener() {},
};
fakeDocument.body = fakeDocument.createElement("body");
elementsById.set("body", fakeDocument.body);

let setValCalls = [];
let chooseCalls = [];
const gameInst = {
  state: {
    gold: 200,
    gold2: 200,
    stage: "question",
    question: {
      qType: "mc",
      question: "What is 2+2?",
      answers: ["3", "4", "5"],
      correctAnswers: ["4"],
    },
    choices: [
      { type: "gold", val: 100, text: "Choice A" },
      { type: "multiply", val: 2, text: "Choice B" },
    ],
  },
  props: {
    client: { name: "TestPlayer", type: "gold", blook: "Chick" },
    liveGameController: {
      setVal(args) {
        setValCalls.push(args);
      },
      getDatabaseVal(path, cb) {
        cb({ TestPlayer: { g: 200, b: "Chick" }, OtherPlayer: { g: 999, b: "Frog" } });
      },
    },
  },
  freeQuestions: [{ question: "One", answers: ["a", "b"], correctAnswers: ["a"] }],
  questions: [{ question: "One", answers: ["a", "b"], correctAnswers: ["a"] }],
  setState(patch) {
    Object.assign(this.state, patch);
  },
  forceUpdate() {},
  choosePrize(idx) {
    chooseCalls.push(idx);
  },
};

const typingAnswers = [];
const typingInst = { sendAnswer: (text) => typingAnswers.push(text) };
const typingWrapperEl = fakeDocument.createElement("div");

const container = fakeDocument.createElement("div");

const hostRoot = { tag: 3, stateNode: container, child: null, sibling: null, return: null, alternate: null };
const appFiber = { tag: 0, stateNode: null, child: null, sibling: null, return: null, alternate: null };
const gameFiber = { tag: 1, stateNode: gameInst, child: null, sibling: null, return: null, alternate: null };
const screenHost = { tag: 5, stateNode: fakeDocument.createElement("div"), child: null, sibling: null, return: null, alternate: null };
const typingComp = { tag: 1, stateNode: typingInst, child: null, sibling: null, return: null, alternate: null };
const typingHost = { tag: 5, stateNode: typingWrapperEl, child: null, sibling: null, return: null, alternate: null };
const decoyHost = { tag: 5, stateNode: fakeDocument.createElement("input"), child: null, sibling: null, return: null, alternate: null };
decoyHost.stateNode.type = "checkbox";

hostRoot.child = appFiber;
appFiber.return = hostRoot;
appFiber.child = gameFiber;
gameFiber.return = appFiber;
gameFiber.child = screenHost;
screenHost.return = gameFiber;
screenHost.child = typingComp;
typingComp.return = screenHost;
typingComp.child = typingHost;
typingHost.return = typingComp;
typingHost.sibling = decoyHost;
decoyHost.return = screenHost;

container.__reactContainer$prod = hostRoot;
fakeDocument.body.children.push(container);
fakeDocument.domRoots = [container];

fakeDocument.typingWrapper = typingWrapperEl;

const clickedContainers = [];
for (let i = 0; i < 3; i++) {
  const el = fakeDocument.createElement("div");
  el.classList.add("answerContainer");
  el.click = () => clickedContainers.push(i);
  fakeDocument.answerContainers.push(el);
}

const feedbackClicks = [];
fakeDocument.feedbackEl = { firstChild: { click: () => feedbackClicks.push(1) } };

const fakeWindow = {
  location: {
    hostname: "gold.blooket.com",
    pathname: "/play/gold",
    href: "https://gold.blooket.com/play/gold",
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

globalThis.window = fakeWindow;
globalThis.document = fakeDocument;
globalThis.localStorage = fakeWindow.localStorage;
globalThis.HTMLElement = FakeEl;
globalThis.HTMLInputElement = FakeEl;
globalThis.HTMLTextAreaElement = FakeEl;
globalThis.getComputedStyle = () => ({ cursor: "default" });

function panelEl() {
  const root = fakeDocument.body.children.find((c) => c.id === "cheetos-root");
  return root?.children.find((c) => c.id === "cheetos-panel");
}

function hotkey(code) {
  fakeWindow.dispatchEvent({ type: "keydown", ctrlKey: true, shiftKey: true, code, repeat: false });
}

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    origLog("PASS  " + msg);
  } else {
    failures++;
    origLog("FAIL  " + msg);
  }
}

const settle = () => new Promise((r) => setTimeout(r, 1000));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const outfile = join(tmp, "bundle.js");
await build({
  entryPoints: [join(root, "src/index.ts")],
  bundle: true,
  format: "iife",
  target: "es2020",
  outfile,
  logLevel: "silent",
});

await import(outfile);

const api = fakeWindow.cheetos;
assert(!!api, "api exposed on window.cheetos");
assert(!!api.node(), "game instance found via fiber walk");
assert(api.client().name === "TestPlayer", "client name readable");
assert(api.state().gold === 200, "state readable");
assert(api.question()?.question === "What is 2+2?", "live question readable");

api.setState({ gold: 999 });
assert(gameInst.state.gold === 999, "setState patches the live class state");

setValCalls = [];
api.setVal("c/TestPlayer/g", 555);
assert(
  setValCalls.length === 1 && setValCalls[0].path === "c/TestPlayer/g" && setValCalls[0].val === 555,
  "setVal forwards {path,val} to liveGameController",
);

const panel = panelEl();
assert(!!panel, "panel element mounted");
assert(panel.style.display !== "none", "panel visible by default");
const status = panel.children[0]?.children.find((c) => c.id === "cheetos-status");
assert(status?.textContent === "Gold Quest \u00b7 live", "status chip reports live game, got: " + status?.textContent);

const visibleBefore = panel.style.display;
hotkey("KeyX");
assert(panel.style.display !== visibleBefore, "Ctrl+Shift+X toggled the panel");
await sleep(150);
hotkey("KeyE");
assert(panel.style.display === visibleBefore, "Ctrl+Shift+E toggled it back");

const eacHandle = api.runCheat("global-every-correct");
assert(!!eacHandle, "every-answer-correct starts");
await sleep(700);
assert(
  gameInst.state.question.correctAnswers.join(",") === "3,4,5",
  "EAC marked the live question correct, got " + gameInst.state.question.correctAnswers.join(","),
);
assert(
  gameInst.freeQuestions[0].correctAnswers.join(",") === "a,b",
  "EAC marked freeQuestions list correct",
);
eacHandle.stop();

gameInst.state.stage = "question";
gameInst.state.question = {
  qType: "mc",
  question: "What is 2+2?",
  answers: ["3", "4", "5"],
  correctAnswers: ["4"],
};
await settle();
const aaHandle = api.runCheat("global-auto-answer");
assert(!!aaHandle, "auto-answer starts");
await sleep(400);
assert(clickedContainers.includes(1), "correct answerContainer clicked (index 1), got [" + clickedContainers.join(",") + "]");

gameInst.state.stage = "feedback";
await sleep(400);
assert(feedbackClicks.length >= 1, "feedback continue clicked");

gameInst.state.stage = "question";
gameInst.state.question = {
  qType: "typing",
  question: "Type it",
  answers: ["hello"],
  correctAnswers: ["hello"],
};
await sleep(400);
assert(typingAnswers.includes("hello"), "typing answer sent via sendAnswer");
aaHandle.stop();

const choiceClicks = [];
fakeDocument.querySelector = (sel) => {
  if (sel === "body>div") return container;
  if (sel.includes("feedback")) return fakeDocument.feedbackEl;
  if (sel.includes("typingAnswerWrapper")) return fakeDocument.typingWrapper;
  if (sel.includes("choice2")) return { click: () => choiceClicks.push(2) };
  if (sel.includes("choice1")) return { click: () => choiceClicks.push(1) };
  return null;
};
gameInst.state.stage = "prize";
gameInst.state.gold = 200;
gameInst.state.choices = [
  { type: "gold", val: 100, text: "Choice A" },
  { type: "multiply", val: 2, text: "Choice B" },
];
await settle();
const acHandle = api.runCheat("gold-auto-choose");
assert(!!acHandle, "gold-auto-choose starts");
await sleep(700);
assert(choiceClicks.includes(2), "auto-choose clicked choice2 (best chest), got [" + choiceClicks.join(",") + "]");
acHandle.stop();

const kicked = [];
gameInst.props.liveGameController.removePlayer = (name) => kicked.push(name);
await settle();
const attempts = api.kickPlayer("Victim");
assert(
  attempts.includes("removePlayer") && attempts.includes("nodeDelete"),
  "kick tries removePlayer + node delete, got " + attempts.join(","),
);
assert(kicked.includes("Victim"), "removePlayer called with the target name");

// ---- hooks-based tree (modern Blooket shape: no class instances) ----
gameFiber.stateNode = null;
const hooksState = {
  gold: 200,
  gold2: 200,
  stage: "question",
  question: { qType: "mc", question: "What is 2+2?", answers: ["3", "4", "5"], correctAnswers: ["4"] },
  choices: [
    { type: "gold", val: 100, text: "Choice A" },
    { type: "multiply", val: 2, text: "Choice B" },
  ],
};
const hooksSetValCalls = [];
const hooksCtrl = {
  setVal(args) {
    hooksSetValCalls.push(args);
  },
  getDatabaseVal(path, cb) {
    cb({ HooksPlayer: { g: 200, b: "Chick" } });
  },
};
const hooksClient = { name: "HooksPlayer", type: "gold", blook: "Chick" };
const hooksKicked = [];
const hooksMethods = {
  removePlayer: (name) => hooksKicked.push(name),
  sendAnswer: (text) => typingAnswers.push(text),
};
const hState = {
  memoizedState: hooksState,
  queue: {
    dispatch: (updater) => {
      hState.memoizedState = typeof updater === "function" ? updater(hState.memoizedState) : updater;
    },
  },
  next: null,
};
const hCtrl = { memoizedState: { current: hooksCtrl }, queue: null, next: null };
const hClient = { memoizedState: { current: hooksClient }, queue: null, next: null };
const hMethods = { memoizedState: { current: hooksMethods }, queue: null, next: null };
const hList = {
  memoizedState: [{ question: "One", answers: ["a", "b"], correctAnswers: ["a"] }],
  queue: null,
  next: null,
};
hState.next = hCtrl;
hCtrl.next = hClient;
hClient.next = hMethods;
hMethods.next = hList;
appFiber.type = () => {};
appFiber.memoizedState = hState;
appFiber.memoizedProps = { type: "checkbox", name: "high-contrast-toggle", onChange: () => {} };
await sleep(700);

assert(!!api.node(), "hooks tree: game state found via hook chain");
assert(api.client().name === "HooksPlayer", "hooks tree: client readable from ref hook");
assert(
  api.client().name !== "high-contrast-toggle",
  "hooks tree: HTML input props not mistaken for client, got " + api.client().name,
);
assert(api.state().gold === 200, "hooks tree: state readable from useState hook");
assert(api.question()?.question === "What is 2+2?", "hooks tree: live question readable");
api.setState({ gold: 777 });
assert(hooksState.gold === 777, "hooks tree: setState mutated the hook state object");
assert(hState.memoizedState.gold === 777, "hooks tree: dispatch re-rendered the hook state");
assert(api.state().gold === 777, "hooks tree: node.state tracks the new hook object");
hooksSetValCalls.length = 0;
api.setVal("c/HooksPlayer/g", 555);
assert(
  hooksSetValCalls.length === 1 &&
    hooksSetValCalls[0].path === "c/HooksPlayer/g" &&
    hooksSetValCalls[0].val === 555,
  "hooks tree: setVal forwards to ref-held controller",
);

const hooksEac = api.runCheat("global-every-correct");
assert(!!hooksEac, "hooks tree: every-answer-correct starts");
await sleep(700);
assert(
  hooksState.question.correctAnswers.join(",") === "3,4,5",
  "hooks tree: EAC marked the live hook question, got " + hooksState.question.correctAnswers.join(","),
);
assert(
  hList.memoizedState[0].correctAnswers.join(",") === "a,b",
  "hooks tree: EAC marked the hook question list",
);
hooksEac.stop();

hooksState.stage = "question";
hooksState.question = {
  qType: "mc",
  question: "What is 2+2?",
  answers: ["3", "4", "5"],
  correctAnswers: ["4"],
};
await settle();
const hooksAa = api.runCheat("global-auto-answer");
assert(!!hooksAa, "hooks tree: auto-answer starts");
await sleep(400);
assert(
  clickedContainers.includes(1),
  "hooks tree: correct answerContainer clicked (index 1), got [" + clickedContainers.join(",") + "]",
);
hooksAa.stop();

const hooksKick = api.kickPlayer("HooksVictim");
assert(
  hooksKicked.includes("HooksVictim"),
  "hooks tree: removePlayer from ref methods called with the target name",
);
assert(
  hooksKick.includes("game.removePlayer") || hooksKick.includes("removePlayer"),
  "hooks tree: kick reports the ref removal hook, got " + hooksKick.join(","),
);

// ---- hooks tree with useReducer-shaped state ([state, dispatch]) ----
const redState = {
  gold: 200,
  gold2: 200,
  stage: "question",
  question: { qType: "mc", question: "What is 2+2?", answers: ["3", "4", "5"], correctAnswers: ["4"] },
  choices: [
    { type: "gold", val: 100, text: "Choice A" },
    { type: "multiply", val: 2, text: "Choice B" },
  ],
};
let redCurrent = redState;
const redHook = {
  memoizedState: [
    redState,
    (updater) => {
      redCurrent = typeof updater === "function" ? updater(redCurrent) : updater;
    },
  ],
  queue: {
    dispatch: (updater) => {
      redCurrent = typeof updater === "function" ? updater(redCurrent) : updater;
      redHook.memoizedState[0] = redCurrent;
    },
  },
  next: hCtrl,
};
appFiber.memoizedState = redHook;
await sleep(700);
assert(!!api.node(), "reducer hook: state found from [state, dispatch] array");
assert(api.state().gold === 200, "reducer hook: state readable from array hook");
api.setState({ gold: 888 });
assert(redCurrent.gold === 888, "reducer hook: setState dispatch applied");
assert(api.client().name === "HooksPlayer", "reducer hook: ref chain still readable");

delete container.__reactContainer$prod;
container.aa = {};
container.bb = { children: [{ _owner: { stateNode: gameInst } }] };
await sleep(600);
assert(!!api.node(), "legacy _owner.stateNode fallback finds the game");
assert(api.client().name === "TestPlayer", "legacy fallback client readable");

console.log = origLog;
if (failures) {
  console.error("runtime sim: " + failures + " failure(s)");
  process.exit(1);
}
console.log("runtime sim: all passed");
rmSync(tmp, { recursive: true, force: true });
process.exit(0);
