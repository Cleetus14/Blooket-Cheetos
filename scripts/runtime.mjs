// Runtime simulation test: boots the real bundle against a fake Blooket-like
// DOM that models the ACTUAL reference structure — the game is a React class
// component reachable through
//   Object.values(body>div)[1].children[0]._owner.stateNode
// exactly like the reference getStateNode. It then drives the real cheat code
// (auto answer, every-answer-correct, gold auto choose, kick) and verifies the
// Ctrl+Shift+X/E hotkey toggles the panel.
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "cheetos-runtime-"));

const consoleLogs = [];
const origLog = console.log;
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

// A DOM element whose standard properties are non-enumerable, matching the
// real DOM. Real React attaches `__reactInternalInstance$...` and
// `__reactProps$...` as OWN ENUMERABLE props, which is what the reference
// `Object.values(el)[1]` reads. Keeping our fake DOM props non-enumerable
// makes `Object.values(el)` behave exactly like the real Blooket page.
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
}

const elementsById = new Map();
const fakeDocument = {
  body: null,
  iframes: [],
  answerContainers: [],
  feedbackEl: null,
  typingWrapper: null,
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
    if (sel.includes("answerContainer")) return this.answerContainers;
    return [];
  },
  addEventListener() {},
  removeEventListener() {},
};
fakeDocument.body = fakeDocument.createElement("body");
elementsById.set("body", fakeDocument.body);

let setValCalls = [];
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

const chooseCalls = [];

// Build the reference structure on the root div:
//   Object.values(root)[1].children[0]._owner.stateNode === gameInst
const gameDiv = fakeDocument.createElement("div");
gameDiv.__reactInternalInstance$test = { dummy: true }; // index 0
gameDiv.__reactProps$test = { children: [{ _owner: { stateNode: gameInst } }] }; // index 1
fakeDocument.body.children.push(gameDiv);

// Answer containers for the reference auto-answer click.
const clickedContainers = [];
for (let i = 0; i < 3; i++) {
  const el = fakeDocument.createElement("div");
  el.classList.add("answerContainer");
  el.click = () => clickedContainers.push(i);
  fakeDocument.answerContainers.push(el);
}

const feedbackClicks = [];
fakeDocument.feedbackEl = { firstChild: { click: () => feedbackClicks.push(1) } };

const typingAnswers = [];
fakeDocument.typingWrapper = fakeDocument.createElement("div");
fakeDocument.typingWrapper.__reactInternalInstance$t = { dummy: true };
fakeDocument.typingWrapper.__reactProps$t = {
  children: { _owner: { stateNode: { sendAnswer: (text) => typingAnswers.push(text) } } },
};

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

// ---------------------------------------------------------------------------
// Reference state node detection (the only path the reference cheats use)
// ---------------------------------------------------------------------------
const api = fakeWindow.cheetos;
assert(!!api, "api exposed on window.cheetos");
assert(!!api.node(), "reference _owner.stateNode found");
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

// ---------------------------------------------------------------------------
// Hotkey toggling (the reported bug)
// ---------------------------------------------------------------------------
const visibleBefore = panel.style.display;
hotkey("KeyX");
assert(panel.style.display !== visibleBefore, "Ctrl+Shift+X toggled the panel");
await sleep(150); // the hotkey has a 120ms double-fire debounce; respect it
hotkey("KeyE");
assert(panel.style.display === visibleBefore, "Ctrl+Shift+E toggled it back");

// ---------------------------------------------------------------------------
// Every Answer Correct
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Auto Answer (reference-exact: answerContainer click + feedback + typing)
// ---------------------------------------------------------------------------
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

// Feedback screen: continue element clicked automatically.
// (state.question is intentionally kept — real Blooket keeps it during feedback)
gameInst.state.stage = "feedback";
await sleep(400);
assert(feedbackClicks.length >= 1, "feedback continue clicked");

// Typing question: submitted via the wrapper's sendAnswer.
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

// ---------------------------------------------------------------------------
// Gold Auto Choose (reference-exact: click div[class*='choiceN'])
// ---------------------------------------------------------------------------
fakeDocument.querySelector = (sel) => {
  if (sel === "body>div") return gameDiv;
  if (sel.includes("feedback")) return fakeDocument.feedbackEl;
  if (sel.includes("typingAnswerWrapper")) return fakeDocument.typingWrapper;
  if (sel.includes("choice2")) return { click: () => choiceClicks.push(2) };
  if (sel.includes("choice1")) return { click: () => choiceClicks.push(1) };
  return null;
};
const choiceClicks = [];
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
// Best value: multiply 200 -> 400 beats gold+100 -> 300, so index 1 (choice2).
assert(choiceClicks.includes(2), "auto-choose clicked choice2 (the best chest), got [" + choiceClicks.join(",") + "]");
acHandle.stop();

// ---------------------------------------------------------------------------
// Kick Player tries every removal hook + node delete
// ---------------------------------------------------------------------------
const kicked = [];
gameInst.props.liveGameController.removePlayer = (name) => kicked.push(name);
await settle();
const attempts = api.kickPlayer("Victim");
assert(
  attempts.includes("removePlayer") && attempts.includes("nodeDelete"),
  "kick tries removePlayer + node delete, got " + attempts.join(","),
);
assert(kicked.includes("Victim"), "removePlayer called with the target name");

console.log = origLog;
if (failures) {
  console.error("runtime sim: " + failures + " failure(s)");
  process.exit(1);
}
console.log("runtime sim: all passed");
rmSync(tmp, { recursive: true, force: true });
process.exit(0);
