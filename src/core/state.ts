type AnyNode = any;

// ---------------------------------------------------------------------------
// Blooket state detection.
//
// Old Blooket builds mounted the game as a class component reachable through
// `_owner.stateNode` (the classic getStateNode trick). The current build is a
// React 18/19 app where the game controller can live in:
//   - a fiber's memoizedProps (liveGameController / client),
//   - a context provider value (memoizedProps.value),
//   - a function component hook state (useState/useReducer),
//   - a class instance (stateNode), or
//   - any plain object reachable from window (module-scope globals).
// We therefore collect every reachable object and score each one for
// game-shaped fields, then expose a unified node proxy that forwards
// setState / setVal / getVal / question / state / props to the real objects.
// ---------------------------------------------------------------------------

function isCheetosEl(el: HTMLElement | null): boolean {
  return (
    !!el &&
    (el.id === "cheetos-root" || el.id === "cheetos-panel" || el.id === "cheetos-toggle")
  );
}

// ---------------------------------------------------------------------------
// Documents (top page + same-origin iframes)
// ---------------------------------------------------------------------------

export function allDocuments(): Document[] {
  const docs: Document[] = [document];
  try {
    for (const frame of Array.from(document.querySelectorAll("iframe"))) {
      const doc = (frame as HTMLIFrameElement).contentDocument;
      if (doc && doc !== document && !docs.includes(doc)) docs.push(doc);
    }
  } catch {
    /* cross-origin frame */
  }
  return docs;
}

let docCache: { doc: Document; at: number } | null = null;

// Returns the document that actually hosts the game (top page or a
// same-origin iframe). DOM-based helpers must click inside this document.
export function gameDocument(): Document {
  const now = Date.now();
  if (docCache && now - docCache.at < 400) return docCache.doc;
  let best: Document = document;
  let bestScore = -1;
  for (const doc of allDocuments()) {
    let score = 0;
    const markers = [
      "[class*='answer']",
      "[class*='question']",
      "[class*='choice']",
      "[class*='feedback']",
      "[class*='gold']",
      "[class*='crypto']",
      "canvas",
      "input[type=text]",
      "input[type=number]",
    ];
    for (const m of markers) {
      try {
        score += doc.querySelectorAll(m).length;
      } catch {
        /* ignore */
      }
    }
    if (doc !== document) score += 10;
    if (score > bestScore) {
      bestScore = score;
      best = doc;
    }
  }
  docCache = { doc: best, at: now };
  return best;
}

// ---------------------------------------------------------------------------
// React internals
// ---------------------------------------------------------------------------

const FIBER_PREFIXES = ["__reactFiber$", "__reactInternalInstance$", "__reactContainer$"];
const PROPS_PREFIXES = ["__reactProps$"];

function reactKeyedValues(el: HTMLElement, prefixes: string[]): AnyNode[] {
  const out: AnyNode[] = [];
  for (const key of Object.keys(el)) {
    for (const prefix of prefixes) {
      if (key.startsWith(prefix)) {
        const v = (el as AnyNode)[key];
        if (v) out.push(v);
      }
    }
  }
  return out;
}

function propsOf(el: HTMLElement): AnyNode | null {
  for (const key of Object.keys(el)) {
    for (const prefix of PROPS_PREFIXES) {
      if (key.startsWith(prefix)) {
        const props = (el as AnyNode)[key];
        if (props) return props;
      }
    }
  }
  // Legacy ordered lookup used by the reference getStateNode.
  const values = Object.values(el) as AnyNode[];
  return values[1] ?? null;
}

function ownerStateNodeOf(el: HTMLElement): AnyNode | null {
  const props = propsOf(el);
  const kids = props?.children;
  const first = Array.isArray(kids) ? kids[0] : kids;
  if (first?._owner?.stateNode) return first._owner.stateNode;
  // Legacy ordered lookup used by the classic getStateNode trick: the props
  // object sits at index 1 of the DOM node's React-internal values.
  const values = Object.values(el) as AnyNode[];
  const legacy = values[1];
  const lkids = legacy?.children;
  const lfirst = Array.isArray(lkids) ? lkids[0] : lkids;
  if (lfirst?._owner?.stateNode) return lfirst._owner.stateNode;
  return null;
}

// Exact port of the reference walk: descend `body>div > div > ...` and return
// the first React component instance reachable through `_owner.stateNode`.
function referenceWalk(start: HTMLElement): AnyNode | null {
  let current: HTMLElement | null = start;
  let depth = 0;
  while (current && depth < 800) {
    const stateNode = ownerStateNodeOf(current);
    if (stateNode) return stateNode;
    const child = current.querySelector?.(":scope>div") ?? null;
    if (!child || child === current) break;
    current = child as HTMLElement;
    depth++;
  }
  return null;
}

// ---------------------------------------------------------------------------
// DOM + fiber collection
// ---------------------------------------------------------------------------

const SCAN_LIMIT = 100000;
interface DomScan {
  fibers: AnyNode[];
  propsObjs: AnyNode[];
  seenNodes: AnyNode[];
  at: number;
}
let scanCache: DomScan | null = null;

function allScannable(doc: Document): HTMLElement[] {
  const els: HTMLElement[] = [];
  for (const el of Array.from(doc.body?.children ?? [])) {
    if (!isCheetosEl(el as HTMLElement)) els.push(el as HTMLElement);
  }
  const all = doc.querySelectorAll("body *");
  const cap = Math.min(all.length, SCAN_LIMIT);
  for (let i = 0; i < cap; i++) {
    const el = all[i] as HTMLElement;
    if (!isCheetosEl(el)) els.push(el);
  }
  return els;
}

function collectDom(): DomScan {
  const now = Date.now();
  if (scanCache && now - scanCache.at < 600) return scanCache;

  const fibers: AnyNode[] = [];
  const propsObjs: AnyNode[] = [];
  const seenNodes: AnyNode[] = [];
  const seenSet = new Set<AnyNode>();
  for (const doc of allDocuments()) {
    const els = allScannable(doc);
    for (const el of els) {
      for (const fiber of reactKeyedValues(el, FIBER_PREFIXES)) {
        if (!fibers.includes(fiber)) fibers.push(fiber);
      }
      for (const props of reactKeyedValues(el, PROPS_PREFIXES)) {
        if (!propsObjs.includes(props)) propsObjs.push(props);
      }
    }
    // Legacy `_owner` path: scan every element for a direct stateNode.
    for (const el of els) {
      const sn = ownerStateNodeOf(el);
      if (sn && !seenSet.has(sn)) {
        seenSet.add(sn);
        seenNodes.push(sn);
      }
    }
  }

  scanCache = { fibers, propsObjs, seenNodes, at: now };
  return scanCache;
}

function fibersFromDevToolsHook(): AnyNode[] {
  const hook = (window as AnyNode).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook?.renderers) return [];
  const out: AnyNode[] = [];
  for (const [id, renderer] of hook.renderers.entries()) {
    try {
      const roots = renderer.getFiberRoots ? renderer.getFiberRoots(id) : [];
      for (const root of roots) if (root) out.push(root);
    } catch {
      /* ignore */
    }
  }
  return out;
}

function walkFiberTree(roots: AnyNode[]): AnyNode[] {
  const seen = new Set<AnyNode>();
  const stack: AnyNode[] = [];
  for (const r of roots) stack.push(r);
  while (stack.length) {
    const fiber = stack.pop();
    if (!fiber || seen.has(fiber)) continue;
    seen.add(fiber);
    if (fiber.child) stack.push(fiber.child);
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.return) stack.push(fiber.return);
    if (fiber.alternate) stack.push(fiber.alternate);
  }
  return Array.from(seen);
}

// ---------------------------------------------------------------------------
// Object-graph hunt
// ---------------------------------------------------------------------------

const GAME_STATE_KEYS = [
  "gold", "gold2", "crypto", "crypto2", "stage", "phase", "question", "choices",
  "cash", "tokens", "fossils", "toys", "toysPerQ", "guestScore", "round", "level",
  "myHealth", "myLife", "materials", "people", "happiness", "fossilMult",
  "numDefense", "numBlooks", "lure", "blooks", "towers", "weight", "password",
  "correctPassword", "hack", "safe", "party",
];

interface Hunt {
  controller: AnyNode | null; // has setVal / getDatabaseVal
  client: AnyNode | null; // { name, type/question/gold ... }
  question: AnyNode | null; // { answers, correctAnswers ... }
  stateObj: AnyNode | null; // game-state shaped object
  classNode: AnyNode | null; // class instance with setState + state
  best: AnyNode | null;
  bestScore: number;
  stateFiber: AnyNode | null; // fiber whose hook state holds game state
  visited: number;
}

function isObj(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object";
}

function hasGameValue(o: AnyNode): boolean {
  return (
    o.gold !== undefined ||
    o.crypto !== undefined ||
    o.cash !== undefined ||
    o.fossils !== undefined ||
    o.toys !== undefined ||
    o.tokens !== undefined ||
    o.guestScore !== undefined ||
    o.myHealth !== undefined
  );
}

function consider(o: AnyNode, hunt: Hunt): void {
  if (!isObj(o)) return;
  let score = 0;

  // The Firebase controller: the single most important object.
  const ctrl =
    typeof o.setVal === "function" &&
    (typeof o.getDatabaseVal === "function" ||
      typeof o.getDatabaseRef === "function" ||
      typeof o.getVal === "function");
  if (ctrl) {
    score += 100000;
    if (!hunt.controller) hunt.controller = o;
  } else if (typeof o.setVal === "function") {
    score += 20000;
  }

  // Wrapper object carrying client / liveGameController (fiber props, context).
  if (isObj(o.client)) {
    score += 30000;
    const c = o.client;
    if (typeof c.name === "string") score += 20000;
    if (typeof c.type === "string") score += 5000;
    if (isObj(c.question)) score += 10000;
    if (!hunt.client && typeof c.name === "string") hunt.client = c;
  }
  if (isObj(o.liveGameController)) {
    score += 40000;
    if (isObj(o.liveGameController) && !hunt.controller) {
      // liveGameController itself may be the controller
      if (
        typeof o.liveGameController.setVal === "function" &&
        (typeof o.liveGameController.getDatabaseVal === "function" ||
          typeof o.liveGameController.getDatabaseRef === "function")
      ) {
        hunt.controller = o.liveGameController;
      }
    }
  }

  // A client object itself ({ name, type/question/gold/blook ... }).
  if (
    typeof o.name === "string" &&
    (typeof o.type === "string" ||
      isObj(o.question) ||
      o.gold !== undefined ||
      o.crypto !== undefined ||
      o.blook !== undefined)
  ) {
    score += 30000;
    if (!hunt.client) hunt.client = o;
  }

  // A question object. The one with a real prompt field is the live
  // question; bare answer blobs from freeQuestions lists must not shadow it.
  if (isObj(o.question) && Array.isArray(o.question.answers)) {
    score += 30000;
    if (Array.isArray(o.question.correctAnswers)) score += 10000;
    if (!hunt.question || !hunt.question.question) hunt.question = o.question;
  }
  if (Array.isArray(o.answers) && Array.isArray(o.correctAnswers)) {
    score += 20000;
    if (!hunt.question && isObj(o)) hunt.question = o;
  }

  // Game-state shaped object.
  if (hasGameValue(o) && (o.stage !== undefined || o.phase !== undefined || isObj(o.client) || Array.isArray(o.choices) || isObj(o.question))) {
    score += 25000;
  }

  if (Array.isArray(o.questions) || Array.isArray(o.freeQuestions)) score += 10000;

  // Class component instance.
  if (typeof o.setState === "function" && isObj(o.state)) {
    score += 5000;
    if (isObj(o.props) && (isObj(o.props.client) || isObj(o.props.liveGameController))) {
      score += 30000;
    }
    if (!hunt.classNode) hunt.classNode = o;
  }

  if (
    !hunt.stateObj &&
    (hasGameValue(o) ||
      o.stage !== undefined ||
      o.phase !== undefined ||
      Array.isArray(o.choices) ||
      isObj(o.question))
  ) {
    hunt.stateObj = o;
  }

  if (score > hunt.bestScore) {
    hunt.bestScore = score;
    hunt.best = o;
  }
}

function enumerableLeaves(o: AnyNode): AnyNode[] {
  const out: AnyNode[] = [];
  if (typeof Element !== "undefined" && o instanceof Element) {
    // DOM nodes: only React internal keys carry useful state.
    for (const k of Object.keys(o)) {
      if (!k.startsWith("__react")) continue;
      try {
        const v = (o as AnyNode)[k];
        if (isObj(v)) out.push(v);
      } catch {
        /* ignore */
      }
    }
    return out;
  }
  if (Array.isArray(o)) {
    const n = Math.min(o.length, 2000);
    for (let i = 0; i < n; i++) {
      try {
        const v = o[i];
        if (isObj(v)) out.push(v);
      } catch {
        /* ignore */
      }
    }
    return out;
  }
  for (const k of Object.keys(o)) {
    try {
      const v = o[k];
      if (isObj(v)) out.push(v);
    } catch {
      /* ignore */
    }
  }
  return out;
}

const BFS_BUDGET = 150000;
const BFS_DEPTH = 5;

function runHunt(seeds: AnyNode[]): Hunt {
  const hunt: Hunt = {
    controller: null,
    client: null,
    question: null,
    stateObj: null,
    classNode: null,
    best: null,
    bestScore: -1,
    stateFiber: null,
    visited: 0,
  };
  const seen = new Set<AnyNode>();
  const stack: { o: AnyNode; d: number }[] = [];
  for (const s of seeds) if (isObj(s)) stack.push({ o: s, d: 0 });
  while (stack.length && hunt.visited < BFS_BUDGET) {
    const { o, d } = stack.pop()!;
    if (seen.has(o)) continue;
    seen.add(o);
    hunt.visited++;
    consider(o, hunt);
    if (d >= BFS_DEPTH) continue;
    for (const leaf of enumerableLeaves(o)) {
      if (!seen.has(leaf)) stack.push({ o: leaf, d: d + 1 });
    }
  }
  return hunt;
}

function hookChainValues(fiber: AnyNode): AnyNode[] {
  const out: AnyNode[] = [];
  let hook: AnyNode = fiber?.memoizedState;
  let guard = 0;
  while (hook && guard++ < 300) {
    let v = hook.memoizedState;
    if (Array.isArray(v)) v = v[0]; // useReducer state
    if (isObj(v)) out.push(v);
    hook = hook.next;
  }
  return out;
}

function huntSeeds(): AnyNode[] {
  const seeds: AnyNode[] = [window, document];
  for (const doc of allDocuments()) {
    seeds.push(doc);
    const win = (doc as AnyNode).defaultView;
    if (win && win !== window) seeds.push(win);
  }

  const dom = collectDom();
  const fibers = walkFiberTree(dom.fibers.concat(fibersFromDevToolsHook()));

  for (const f of fibers) {
    seeds.push(f);
    if (isObj(f.memoizedProps)) {
      seeds.push(f.memoizedProps);
      if (isObj(f.memoizedProps.value)) seeds.push(f.memoizedProps.value); // context value
      if (isObj(f.memoizedProps.client)) seeds.push(f.memoizedProps.client);
      if (isObj(f.memoizedProps.liveGameController)) seeds.push(f.memoizedProps.liveGameController);
    }
    for (const v of hookChainValues(f)) seeds.push(v);
    const ctx = f.dependencies?.firstContext?.memoizedValue;
    if (isObj(ctx)) seeds.push(ctx);
    if (isObj(f.stateNode) && typeof f.stateNode.setState === "function") seeds.push(f.stateNode);
  }
  for (const p of dom.propsObjs) seeds.push(p);
  for (const sn of dom.seenNodes) seeds.push(sn);

  return seeds;
}

function fiberForHookState(fibers: AnyNode[], stateObj: AnyNode): AnyNode | null {
  for (const f of fibers) {
    for (const v of hookChainValues(f)) {
      if (v === stateObj) return f;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Unified node
// ---------------------------------------------------------------------------

function buildNode(hunt: Hunt, fibers: AnyNode[]): AnyNode | null {
  if (hunt.bestScore < 0 && !hunt.client && !hunt.controller && !hunt.question) return null;

  if (!hunt.stateFiber && hunt.stateObj) {
    hunt.stateFiber = fiberForHookState(fibers, hunt.stateObj);
  }

  const source: AnyNode =
    hunt.classNode ||
    hunt.best ||
    (hunt.client ? { client: hunt.client } : {}) ||
    {};

  const stateObj = (): AnyNode => {
    const merged: AnyNode = {};
    const parts = [
      hunt.question,
      hunt.client,
      hunt.classNode?.state,
      hunt.stateObj,
    ];
    // hunt.question is merged first so a live question living on the actual
    // state object wins over a bare blob found earlier in the walk.
    for (const p of parts) {
      if (isObj(p)) Object.assign(merged, p);
    }
    return merged;
  };

  const setVal = (path: string, val: unknown) => {
    const c = hunt.controller;
    if (!c || typeof c.setVal !== "function") return;
    try {
      if (c.setVal.length >= 2) c.setVal(path, val);
      else c.setVal({ path, val });
    } catch {
      try {
        c.setVal({ path, val });
      } catch {
        /* ignore */
      }
    }
  };

  const getVal = (path: string, cb: (val: any) => void) => {
    const c = hunt.controller;
    if (!c) return;
    try {
      const fn = c.getDatabaseVal ?? c.getVal;
      if (typeof fn !== "function") return;
      const r = fn.call(c, path, cb);
      if (r && typeof r.then === "function") r.then(cb).catch(() => {});
    } catch {
      /* ignore */
    }
  };

  const setState = (patch: AnyNode) => {
    if (!patch || typeof patch !== "object") return;
    if (hunt.classNode && typeof hunt.classNode.setState === "function") {
      try {
        hunt.classNode.setState(patch);
        return;
      } catch {
        /* ignore */
      }
    }
    bestEffortSetState(hunt.stateFiber ?? huntStateFiberFallback(fibers, patch), patch, fibers);
  };

  const forceUpdate = () => {
    try {
      hunt.classNode?.forceUpdate?.();
    } catch {
      /* ignore */
    }
    try {
      let f = hunt.stateFiber;
      while (f) {
        const sn = f.stateNode;
        if (sn && typeof sn.forceUpdate === "function") {
          sn.forceUpdate();
          return;
        }
        f = f.return;
      }
    } catch {
      /* ignore */
    }
  };

  const propsObj: AnyNode = {
    client: hunt.client ?? {},
    liveGameController: hunt.controller ?? {},
    question: hunt.question ?? null,
  };

  const questionOf = (): AnyNode =>
    hunt.client?.question ?? stateObj().question ?? hunt.question ?? null;

  // React fiber internals that must never leak through the node proxy.
  const FIBER_RESERVED = new Set([
    "memoizedProps",
    "memoizedState",
    "pendingProps",
    "child",
    "sibling",
    "return",
    "stateNode",
    "type",
    "key",
    "ref",
    "index",
    "lanes",
    "alternate",
    "elementType",
    "mode",
    "flags",
    "tag",
    "updateQueue",
    "dependencies",
    "_debugOwner",
    "_debugSource",
  ]);

  return new Proxy(source, {
    get(t, prop: string, recv) {
      if (prop === "props") return propsObj;
      if (prop === "state") return stateObj();
      if (prop === "setState") return setState;
      if (prop === "setVal") return setVal;
      if (prop === "getVal") return getVal;
      if (prop === "getDatabaseVal") return (path: string, cb: any) => getVal(path, cb);
      if (prop === "forceUpdate") return forceUpdate;
      if (prop === "question") return questionOf;
      if (prop in t) return Reflect.get(t, prop, recv);
      // The live game instance (choosePrize, kickPlayer, removeCustomer,
      // freeQuestions, ...) often lives on the fiber itself, not on the
      // controller that owns setVal/getVal. Forward those so cheats reach
      // the real game methods instead of falling back to DOM guessing.
      if (hunt.stateFiber && !FIBER_RESERVED.has(prop) && prop in hunt.stateFiber) {
        const v = Reflect.get(hunt.stateFiber, prop, hunt.stateFiber);
        if (v !== undefined) return v;
      }
      if (hunt.classNode && !FIBER_RESERVED.has(prop) && prop in hunt.classNode) {
        const v = Reflect.get(hunt.classNode, prop, hunt.classNode);
        if (v !== undefined) return v;
      }
      if (hunt.client && prop in hunt.client) return hunt.client[prop];
      const s = stateObj();
      if (prop in s) return s[prop];
      if (hunt.controller && prop in hunt.controller) return hunt.controller[prop];
      return undefined;
    },
    set(t, prop: string, value) {
      if (
        prop === "props" ||
        prop === "state" ||
        prop === "setState" ||
        prop === "setVal" ||
        prop === "getVal" ||
        prop === "forceUpdate" ||
        prop === "question"
      ) {
        return true;
      }
      if (prop in t) {
        t[prop] = value;
        return true;
      }
      if (isObj(hunt.stateObj)) hunt.stateObj[prop] = value;
      if (isObj(hunt.client)) hunt.client[prop] = value;
      return true;
    },
  });
}

function huntStateFiberFallback(fibers: AnyNode[], patch: AnyNode): AnyNode | null {
  const keys = Object.keys(patch);
  if (!keys.length) return null;
  for (const f of fibers) {
    for (const v of hookChainValues(f)) {
      if (keys.some((k) => k in v)) return f;
    }
  }
  return null;
}

// React dispatches are stable per fiber: hook.queue.dispatch is the same
// function React calls internally, so calling it with a merged object is the
// function-component equivalent of setState.
function bestEffortSetState(fiber: AnyNode | null, patch: AnyNode, fibers: AnyNode[]): void {
  try {
    const keys = Object.keys(patch);
    if (!keys.length) return;

    const tryFiber = (f: AnyNode): boolean => {
      let hook: AnyNode = f.memoizedState;
      let best: AnyNode | null = null;
      let bestScore = 0;
      while (hook) {
        let value = hook.memoizedState;
        if (Array.isArray(value)) value = value[0];
        if (value && typeof value === "object") {
          const score = keys.filter((k) => k in value).length;
          if (score > bestScore) {
            bestScore = score;
            best = hook;
          }
        }
        hook = hook.next;
      }
      if (best?.queue?.dispatch && bestScore > 0) {
        const current = best.memoizedState;
        if (Array.isArray(current)) {
          best.queue.dispatch([Object.assign({}, current[0], patch), ...current.slice(1)]);
        } else {
          best.queue.dispatch(Object.assign({}, current, patch));
        }
        return true;
      }
      return false;
    };

    if (fiber && tryFiber(fiber)) return;
    for (const f of fibers) {
      if (tryFiber(f)) return;
    }
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Reference-style class instance (the classic getStateNode trick)
//
// The game is a React class component. The reference approach walks down
// body>div > div > ... and returns the first `_owner.stateNode` class
// instance it finds, then every cheat mutates that instance's LIVE
// state/props directly. We do the same, preferring game-shaped instances so
// the walk doesn't grab a random dashboard component, then wrap the instance
// in a thin proxy that only adds setVal/getVal/question helpers.
// ---------------------------------------------------------------------------

function referenceWalkInstance(doc: Document): AnyNode | null {
  const start = doc.querySelector("body>div");
  if (!start) return null;
  let current: HTMLElement | null = start as HTMLElement;
  let depth = 0;
  let fallback: AnyNode | null = null;
  while (current && depth < 800) {
    const sn = ownerStateNodeOf(current);
    if (sn && typeof sn.setState === "function" && isObj(sn.state)) {
      const props = sn.props ?? {};
      const s = sn.state ?? {};
      const gameShaped =
        isObj(props.liveGameController) ||
        isObj(props.client) ||
        s.question !== undefined ||
        s.stage !== undefined ||
        s.phase !== undefined ||
        s.gold !== undefined ||
        s.crypto !== undefined ||
        s.cash !== undefined ||
        s.doubloons !== undefined;
      if (gameShaped) return sn;
      if (!fallback) fallback = sn;
    }
    const child = current.querySelector(":scope>div");
    if (!child || child === current) break;
    current = child as HTMLElement;
    depth++;
  }
  return fallback;
}

function findReferenceInstance(): AnyNode | null {
  for (const doc of allDocuments()) {
    const inst = referenceWalkInstance(doc);
    if (inst) return inst;
  }
  return null;
}

// Thin live wrapper: everything reads/writes straight through to the real
// class instance (state, props, game, freeQuestions, choosePrize, ...), so
// mutations stick. Only the Firebase helpers are synthesized from
// props.liveGameController, exactly where the game itself keeps them.
function wrapLiveNode(instance: AnyNode): AnyNode {
  const controller: AnyNode = instance?.props?.liveGameController ?? null;
  const client: AnyNode = instance?.props?.client ?? null;
  return new Proxy(instance, {
    get(t, prop: string) {
      if (prop === "setVal") {
        return (path: string, val: unknown) => {
          if (!controller || typeof controller.setVal !== "function") return;
          try {
            if (controller.setVal.length >= 2) controller.setVal(path, val);
            else controller.setVal({ path, val });
          } catch {
            try {
              controller.setVal({ path, val });
            } catch {
              /* ignore */
            }
          }
        };
      }
      if (prop === "getVal" || prop === "getDatabaseVal") {
        return (path: string, cb: (val: any) => void) => {
          if (!controller) return;
          const fn = controller.getDatabaseVal ?? controller.getVal;
          if (typeof fn !== "function") return;
          try {
            const r = fn.call(controller, path, cb);
            if (r && typeof r.then === "function") r.then(cb).catch(() => {});
          } catch {
            /* ignore */
          }
        };
      }
      if (prop === "question") {
        return () => t.state?.question ?? t.props?.client?.question ?? null;
      }
      if (prop === "forceUpdate") {
        return () => {
          try {
            t.forceUpdate?.();
          } catch {
            /* ignore */
          }
        };
      }
      if (prop === "client") return client ?? t.props?.client ?? null;
      const v = Reflect.get(t, prop);
      if (typeof v === "function" && prop !== "constructor") return v.bind(t);
      return v;
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let nodeCache: { node: AnyNode | null; at: number } | null = null;
let huntCache: { hunt: Hunt; fibers: AnyNode[]; at: number } | null = null;

// Found hunts are reusable for a short while (the game tree doesn't change
// every frame), but empty hunts must expire fast so detection retries once
// the game mounts. Otherwise running the bookmark in the lobby would cache
// "nothing found" and keep reporting "waiting for the game to load" even
// after a question is on screen.
const HUNT_CACHE_HIT_MS = 700;
const HUNT_CACHE_MISS_MS = 350;

function computeHunt(): { hunt: Hunt; fibers: AnyNode[] } {
  const now = Date.now();
  if (huntCache) {
    const ttl = huntCache.hunt.bestScore < 0 ? HUNT_CACHE_MISS_MS : HUNT_CACHE_HIT_MS;
    if (now - huntCache.at < ttl) {
      return { hunt: huntCache.hunt, fibers: huntCache.fibers };
    }
  }
  const fibers = walkFiberTree(collectDom().fibers.concat(fibersFromDevToolsHook()));
  const hunt = runHunt(huntSeeds());
  const found =
    hunt.bestScore >= 0 || !!hunt.client || !!hunt.controller || !!hunt.question;
  if (found) huntCache = { hunt, fibers, at: now };
  return { hunt, fibers };
}

function computeStateNode(): AnyNode | null {
  const { hunt, fibers } = computeHunt();
  if (hunt.bestScore < 0 && !hunt.client && !hunt.controller && !hunt.question) return null;
  return buildNode(hunt, fibers);
}

export function findStateNode(): AnyNode | null {
  const now = Date.now();
  if (nodeCache && now - nodeCache.at < 300) return nodeCache.node;
  // Reference-first: the game is a class component, so the classic walk gets
  // the real live instance. The object-graph hunt is only a fallback for
  // builds that stopped mounting the game as a class component.
  const ref = findReferenceInstance();
  const node = ref ? wrapLiveNode(ref) : computeStateNode();
  nodeCache = { node, at: now };
  return node;
}

export function stateDiagnostics(): Record<string, any> {
  const { hunt } = computeHunt();
  const node = findStateNode();
  const state = node?.state ?? {};
  const props = node?.props ?? {};
  const dom = collectDom();
  const allFibers = walkFiberTree(dom.fibers.concat(fibersFromDevToolsHook()));
  return {
    found: !!node,
    score: hunt.bestScore,
    controller: !!hunt.controller,
    clientName: hunt.client?.name ?? null,
    clientType: hunt.client?.type ?? null,
    hasQuestion: !!hunt.question || !!state.question || !!props.client?.question,
    hasGold: state.gold !== undefined || state.crypto !== undefined || state.cash !== undefined,
    stage: state.stage ?? state.phase ?? null,
    stateKeys: Object.keys(state).slice(0, 30),
    fibers: allFibers.length,
    visited: hunt.visited,
    devtools: !!(window as AnyNode).__REACT_DEVTOOLS_GLOBAL_HOOK__,
  };
}

export function debugDump(): Record<string, any> {
  const dom = collectDom();
  const allFibers = walkFiberTree(dom.fibers.concat(fibersFromDevToolsHook()));
  const hunt = runHunt(huntSeeds());
  return {
    url: window.location.href,
    fibers: allFibers.length,
    controller: !!hunt.controller,
    clientName: hunt.client?.name ?? null,
    score: hunt.bestScore,
    visited: hunt.visited,
    devtools: !!(window as AnyNode).__REACT_DEVTOOLS_GLOBAL_HOOK__,
    stateKeys: Object.keys(hunt.stateObj ?? {}).slice(0, 30),
    reactKeysOnRoot: Object.keys(document.body?.firstElementChild ?? {}).slice(0, 12),
  };
}
