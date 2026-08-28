// Runtime simulation test: boots the real bundle against fake Blooket-like
// DOMs and verifies the multi-path state detection (React 18 fiber props,
// hook-only state, legacy _owner stateNode, same-origin iframe, context
// provider value, window object graph), that setState/setVal reach the game
// controller, and that the Ctrl+Shift+X/E hotkey really toggles the panel.
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
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

class FakeEl {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.dataset = {};
    this.classList = new FakeClassList();
    this.listeners = {};
    this.id = "";
    this.textContent = "";
    this.innerText = "";
    this.value = "";
    this.type = "";
    this.placeholder = "";
    this.title = "";
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
    if (sel.includes("feedback")) return this.feedbackEl || null;
    if (sel.includes("typingAnswerWrapper")) return this.typingWrapper || null;
    return null;
  },
  querySelectorAll(sel) {
    if (sel === "iframe") return this.iframes;
    if (sel.includes("answerContainer")) return this.answerContainers || [];
    return [];
  },
  addEventListener() {},
};
fakeDocument.body = fakeDocument.createElement("body");
elementsById.set("body", fakeDocument.body);

let setValCalls = [];
let fiberState = { gold: 100, gold2: 100, stage: "prize", choices: [{ type: "gold", val: 100 }] };
const fiber = {
  memoizedProps: {
    liveGameController: {
      setVal(args) {
        setValCalls.push(args);
      },
      getDatabaseVal() {},
    },
    client: { name: "TestPlayer", type: "gold" },
  },
  memoizedState: {
    memoizedState: fiberState,
    next: null,
    queue: {
      dispatch(merged) {
        fiberState = merged;
        fiber.memoizedState.memoizedState = merged;
      },
    },
  },
  child: null,
  sibling: null,
  return: null,
  stateNode: null,
};

const gameDiv = fakeDocument.createElement("div");
gameDiv.__reactFiber$test = fiber;
fakeDocument.body.children.push(gameDiv);

const fakeWindow = {
  location: {
    hostname: "play.blooket.com",
    pathname: "/play/gold",
    href: "https://play.blooket.com/play/gold",
  },
  addEventListener(type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
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

function panelEl() {
  const root = fakeDocument.body.children.find((c) => c.id === "cheetos-root");
  return root?.children.find((c) => c.id === "cheetos-panel");
}

function hotkey(code) {
  fakeWindow.dispatchEvent({ type: "keydown", ctrlKey: true, shiftKey: true, code });
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

// Detection caches live inside the bundle (300ms node / 600ms DOM / 700ms
// hunt), so wait long enough between scenarios for fresh scans.
const settle = () => new Promise((r) => setTimeout(r, 1000));

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
// Scenario A: React 18 fiber with liveGameController in props (new frontend)
// ---------------------------------------------------------------------------
const api = fakeWindow.cheetos;
assert(!!api, "api exposed on window.cheetos");
assert(!!api.node(), "A: state node found on fiber props path");
assert(api.client().name === "TestPlayer", "A: client name readable");
assert(api.state().gold === 100, "A: hook state readable");
assert(
  !consoleLogs.some((l) => l.includes("[state node not found]")),
  "A: no [state node not found] diagnostic",
);

api.setState({ gold: 999 });
assert(fiberState.gold === 999, "A: setState patched hook state");

setValCalls = [];
api.setVal("c/TestPlayer/g", 555);
assert(
  setValCalls.length === 1 && setValCalls[0].path === "c/TestPlayer/g" && setValCalls[0].val === 555,
  "A: setVal forwarded to liveGameController",
);

const panel = panelEl();
assert(!!panel, "A: panel element mounted");
assert(panel.style.display !== "none", "A: panel visible by default");
const status = panel.children[0]?.children.find((c) => c.id === "cheetos-status");
assert(status?.textContent === "Gold Quest \u00b7 live", "A: status chip reports live game, got: " + status?.textContent);

// Hotkey toggling (the reported bug). The same handler is installed on
// window/document/body, so repeats within 120ms are debounced; space presses
// like a real user.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
hotkey("KeyX");
assert(panel.style.display === "none", "A: Ctrl+Shift+X hides panel");
await sleep(160);
hotkey("KeyX");
assert(panel.style.display === "flex", "A: Ctrl+Shift+X shows panel again");
await sleep(160);
hotkey("KeyE");
assert(panel.style.display === "none", "A: Ctrl+Shift+E hides panel");
await sleep(160);
hotkey("KeyE");
assert(panel.style.display === "flex", "A: Ctrl+Shift+E shows panel again");

const toggleBtn = fakeDocument.body.children.find((c) => c.id === "cheetos-root")?.children[0];
toggleBtn.click();
assert(panel.style.display === "none", "A: toggle button hides panel");
toggleBtn.click();
assert(panel.style.display === "flex", "A: toggle button shows panel");

const title = panel.children[0]?.children.find((c) => c.textContent?.startsWith("Blooket Cheetos V"));
assert(!!title, "A: versioned panel title present");

// ---------------------------------------------------------------------------
// Scenario B: legacy class instance reachable via __reactProps$ -> _owner
// ---------------------------------------------------------------------------
await settle();
fakeDocument.body.children = [];
fakeDocument.iframes = [];
const legacyInstance = {
  props: { client: { name: "LegacyPlayer", type: "gold" } },
  state: { gold: 50 },
  setState() {},
  forceUpdate() {},
};
const legacyDiv = fakeDocument.createElement("div");
legacyDiv.__reactProps$test = {
  children: [{ _owner: { stateNode: legacyInstance } }],
};
fakeDocument.body.children.push(legacyDiv);
await settle();
assert(!!api.node(), "B: state node found via legacy _owner path");
assert(api.client().name === "LegacyPlayer", "B: legacy client name readable");

// ---------------------------------------------------------------------------
// Scenario C: function component whose props carry nothing, only hook state
// ---------------------------------------------------------------------------
await settle();
fakeDocument.body.children = [];
const hookOnlyFiber = {
  memoizedProps: {},
  memoizedState: {
    memoizedState: { gold: 42, stage: "prize", choices: [] },
    next: null,
    queue: { dispatch() {} },
  },
  child: null,
  sibling: null,
  return: null,
  stateNode: null,
};
const hookDiv = fakeDocument.createElement("div");
hookDiv.__reactFiber$hook = hookOnlyFiber;
fakeDocument.body.children.push(hookDiv);
await settle();
assert(!!api.node(), "C: state node found from hook state alone");
assert(api.state().gold === 42, "C: hook-only state readable");

// ---------------------------------------------------------------------------
// Scenario D: the game lives in a same-origin iframe
// ---------------------------------------------------------------------------
await settle();
fakeDocument.body.children = [];
const frameState = { gold: 777, stage: "prize" };
const frameFiber = {
  memoizedProps: {
    liveGameController: { setVal() {}, getDatabaseVal() {} },
    client: { name: "FramePlayer", type: "gold" },
  },
  memoizedState: {
    memoizedState: frameState,
    next: null,
    queue: { dispatch() {} },
  },
  child: null,
  sibling: null,
  return: null,
  stateNode: null,
};
const frameDoc = {
  body: null,
  iframes: [],
  createElement(tag) {
    return new FakeEl(tag);
  },
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
};
frameDoc.body = frameDoc.createElement("body");
const frameGameDiv = frameDoc.createElement("div");
frameGameDiv.__reactFiber$frame = frameFiber;
frameDoc.body.children.push(frameGameDiv);
const iframeEl = fakeDocument.createElement("iframe");
iframeEl.contentDocument = frameDoc;
fakeDocument.iframes.push(iframeEl);
await settle();
assert(!!api.node(), "D: state node found inside same-origin iframe");
assert(api.client().name === "FramePlayer", "D: iframe client name readable");
assert(api.state().gold === 777, "D: iframe hook state readable");

// ---------------------------------------------------------------------------
// Scenario E: context provider value (memoizedProps.value) — the likely
// current Blooket shape: controller + client + state inside one value object
// ---------------------------------------------------------------------------
await settle();
fakeDocument.body.children = [];
const ctxValue = {
  client: { name: "CtxPlayer", type: "gold" },
  liveGameController: { setVal() {}, getDatabaseVal() {} },
  gold: 123,
  gold2: 123,
  stage: "prize",
  choices: [{ type: "gold", val: 50 }],
};
const ctxFiber = {
  memoizedProps: { value: ctxValue },
  memoizedState: null,
  child: null,
  sibling: null,
  return: null,
  stateNode: null,
};
const ctxDiv = fakeDocument.createElement("div");
ctxDiv.__reactFiber$ctx = ctxFiber;
fakeDocument.body.children.push(ctxDiv);
await settle();
assert(!!api.node(), "E: state node found from context provider value");
assert(api.client().name === "CtxPlayer", "E: context client name readable");
assert(api.state().gold === 123, "E: context state readable");

// ---------------------------------------------------------------------------
// Scenario F: controller reachable only through the window object graph
// (module-scope global, no fibers at all)
// ---------------------------------------------------------------------------
await settle();
fakeDocument.body.children = [];
const globalController = {
  setVal() {},
  getDatabaseVal() {},
};
fakeWindow.__gameController = globalController;
await settle();
assert(!!api.node(), "F: state node found via window object graph");

// ---------------------------------------------------------------------------
// Scenario G: gold Auto Choose calls the game's own pick handler with the
// most valuable chest (the fix for hashed CSS classes breaking clicks)
// ---------------------------------------------------------------------------
fakeDocument.body.children = [];
delete fakeWindow.__gameController;
const chooseCalls = [];
const gState = {
  gold: 200,
  gold2: 200,
  stage: "prize",
  choices: [
    { type: "gold", val: 100, text: "Choice A" },
    { type: "multiply", val: 2, text: "Choice B" },
  ],
};
const gFiber = {
  memoizedProps: {
    liveGameController: {
      setVal(args) {
        setValCalls.push(args);
      },
      getDatabaseVal(path, cb) {
        cb({ TestPlayer: { g: 200 }, OtherPlayer: { g: 999 } });
      },
    },
    client: { name: "TestPlayer", type: "gold" },
  },
  memoizedState: {
    memoizedState: gState,
    next: null,
    queue: {
      dispatch(merged) {
        Object.assign(gState, merged);
      },
    },
  },
  choosePrize(idx) {
    chooseCalls.push(idx);
  },
  child: null,
  sibling: null,
  return: null,
  stateNode: null,
};
const gDiv = fakeDocument.createElement("div");
gDiv.__reactFiber$test = gFiber;
fakeDocument.body.children.push(gDiv);
await settle();
setValCalls = [];
const acHandle = api.runCheat("gold-auto-choose");
assert(!!acHandle, "G: gold-auto-choose starts");
await sleep(700);
// Best value: multiply 200 -> 400 beats gold+100 -> 300, so index 1 wins.
assert(
  chooseCalls.length >= 1 && chooseCalls[chooseCalls.length - 1] === 1,
  "G: auto-choose picked the best chest via choosePrize, got " + chooseCalls.join(","),
);
assert(typeof acHandle.stop === "function", "G: auto-choose returns a stoppable handle");
acHandle.stop();
await sleep(250);
const afterStop = chooseCalls.length;
await sleep(400);
assert(chooseCalls.length === afterStop, "G: auto-choose stopped picking after stop()");

// ---------------------------------------------------------------------------
// Scenario H: Every Answer Correct marks the live question (the reported
// "does not work at all" bug)
// ---------------------------------------------------------------------------
const hQ = {
  qType: "mc",
  question: "What is 2+2?",
  answers: ["3", "4", "5"],
  correctAnswers: ["3"],
};
Object.assign(gState, { stage: "question", question: hQ });
gFiber.freeQuestions = [
  { question: "One", answers: ["a", "b"], correctAnswers: ["a"] },
];
await settle();
const eacHandle = api.runCheat("global-every-correct");
assert(!!eacHandle, "H: every-answer-correct starts");
await sleep(700);
assert(
  hQ.correctAnswers.length === 3 && hQ.correctAnswers.join(",") === "3,4,5",
  "H: live question answers all marked correct, got " + hQ.correctAnswers.join(","),
);
assert(
  gFiber.freeQuestions[0].correctAnswers.join(",") === "a,b",
  "H: freeQuestions list answers all marked correct",
);
eacHandle.stop();

// ---------------------------------------------------------------------------
// Scenario I: Kick Player tries every removal hook and reports attempts
// ---------------------------------------------------------------------------
const kicked = [];
gFiber.memoizedProps.liveGameController.removePlayer = (name) => kicked.push(name);
await settle();
const attempts = api.kickPlayer("Victim");
assert(
  attempts.includes("removePlayer") && attempts.includes("nodeDelete"),
  "I: kick tries removePlayer + node delete, got " + attempts.join(","),
);
assert(kicked.includes("Victim"), "I: removePlayer called with the target name");

// ---------------------------------------------------------------------------
// Scenario J: Auto Answer runs the reference-exact path — fresh _owner
// stateNode grab, [class*='answerContainer'] click at the correct index,
// feedback auto-advance, and typing sendAnswer — with the humanizer off it
// answers instantly and cannot be blocked by DOM text gating.
// ---------------------------------------------------------------------------
fakeDocument.body.children = [];
const clickedContainers = [];
const answerEls = [];
for (let i = 0; i < 3; i++) {
  const el = fakeDocument.createElement("div");
  el.classList.add("answerContainer");
  el.click = () => {
    clickedContainers.push(i);
  };
  answerEls.push(el);
}
fakeDocument.answerContainers = answerEls;

const feedbackClicks = [];
fakeDocument.feedbackEl = { firstChild: { click: () => feedbackClicks.push(1) } };

const typingAnswers = [];
fakeDocument.typingWrapper = fakeDocument.createElement("div");
fakeDocument.typingWrapper.__reactFiber$test = {
  stateNode: null,
  child: {
    stateNode: { sendAnswer: (text) => typingAnswers.push(text) },
    child: null,
    sibling: null,
  },
  sibling: null,
  return: null,
};

const jState = {
  stage: "question",
  question: {
    qType: "mc",
    question: "What is 2+2?",
    answers: ["3", "4", "5"],
    correctAnswers: ["4"],
  },
};
const jInst = {
  state: jState,
  props: {
    client: { name: "JPlayer" },
    liveGameController: { setVal() {}, getDatabaseVal() {} },
  },
  setState(patch) {
    Object.assign(this.state, patch);
  },
  forceUpdate() {},
};
const jDiv = fakeDocument.createElement("div");
jDiv.__reactProps$test = { children: [{ _owner: { stateNode: jInst } }] };
fakeDocument.body.children.push(jDiv);

await settle();
const aaHandle = api.runCheat("global-auto-answer");
assert(!!aaHandle, "J: auto-answer starts");
await sleep(400);
assert(
  clickedContainers.includes(1),
  "J: correct answerContainer clicked (index 1), got [" + clickedContainers.join(",") + "]",
);

// Feedback screen: the continue element gets clicked automatically.
jState.stage = "feedback";
delete jState.question;
await sleep(400);
assert(feedbackClicks.length >= 1, "J: feedback continue clicked");

// Typing question: submitted via the wrapper's sendAnswer stateNode.
jState.stage = "question";
jState.question = {
  qType: "typing",
  question: "Type it",
  answers: ["hello"],
  correctAnswers: ["hello"],
};
await sleep(400);
assert(typingAnswers.includes("hello"), "J: typing answer sent via sendAnswer");
aaHandle.stop();
await sleep(200);
const jClicksAfterStop = clickedContainers.length;
await sleep(300);
assert(
  clickedContainers.length === jClicksAfterStop,
  "J: auto-answer stopped after stop()",
);

console.log = origLog;
if (failures) {
  console.error("runtime sim: " + failures + " failure(s)");
  process.exit(1);
}
console.log("runtime sim: all passed");
process.exit(0);
