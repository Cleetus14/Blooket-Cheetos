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
  querySelector() {
    return null;
  },
  querySelectorAll(sel) {
    if (sel === "iframe") return this.iframes;
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
  localStorage: { getItem: () => null, setItem: () => {} },
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

console.log = origLog;
if (failures) {
  console.error("runtime sim: " + failures + " failure(s)");
  process.exit(1);
}
console.log("runtime sim: all passed");
process.exit(0);
