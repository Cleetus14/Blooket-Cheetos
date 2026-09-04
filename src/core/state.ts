import { VERSION } from "../version";

type AnyNode = any;

const FIBER_PREFIXES = ["__reactFiber$", "__reactInternalInstance$", "__reactContainer$"];

const METHOD_NAMES = [
  "sendAnswer",
  "sendAnswerNext",
  "onAnswer",
  "choosePrize",
  "kickPlayer",
  "removePlayer",
  "removeVal",
  "disconnectPlayer",
  "sellBlook",
  "answerNext",
  "answerQuestion",
  "submitAnswer",
  "checkAnswer",
];

const METHOD_ALIASES: Record<string, string[]> = {
  kickPlayer: ["kickPlayer", "removePlayer", "disconnectPlayer"],
};

function isCheetosEl(el: HTMLElement | null): boolean {
  return (
    !!el &&
    (el.id === "cheetos-root" || el.id === "cheetos-panel" || el.id === "cheetos-toggle")
  );
}

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
    if (score > bestScore) {
      bestScore = score;
      best = doc;
    }
  }
  docCache = { doc: best, at: now };
  return best;
}

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
    if (fiber.current) stack.push(fiber.current);
    if (fiber.child) stack.push(fiber.child);
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.return) stack.push(fiber.return);
    if (fiber.alternate) stack.push(fiber.alternate);
  }
  return Array.from(seen);
}

let fibersCache: { fibers: AnyNode[]; at: number } | null = null;

function collectFibers(): AnyNode[] {
  const now = Date.now();
  if (fibersCache && now - fibersCache.at < 500) return fibersCache.fibers;
  const roots: AnyNode[] = fibersFromDevToolsHook();
  for (const doc of allDocuments()) {
    const els = Array.from(doc.querySelectorAll("body *")) as HTMLElement[];
    for (const el of els) {
      if (isCheetosEl(el)) continue;
      for (const f of reactKeyedValues(el, FIBER_PREFIXES)) roots.push(f);
    }
  }
  const fibers = walkFiberTree(roots);
  fibersCache = { fibers, at: now };
  return fibers;
}

function firstChildDiv(el: AnyNode): AnyNode | null {
  try {
    const hit = el.querySelector?.(":scope>div");
    if (hit) return hit;
  } catch {
    /* older engines */
  }
  return el.firstElementChild ?? null;
}

function isClassInstance(o: AnyNode): boolean {
  return (
    !!o &&
    typeof o === "object" &&
    typeof o.setState === "function" &&
    typeof o.state === "object" &&
    o.state !== null
  );
}

function instanceHasGameSignals(sn: AnyNode): boolean {
  if (!sn || typeof sn !== "object") return false;
  if (isClassInstance(sn)) return true;
  const props = sn.props ?? {};
  if (props.client || props.liveGameController) return true;
  return Object.keys(sn.state ?? {}).length > 0;
}

function referenceInstance(doc: Document): AnyNode | null {
  let current: AnyNode = doc.querySelector("body>div");
  let depth = 0;
  while (current && depth < 2000) {
    try {
      for (const v of Object.values(current) as AnyNode[]) {
        if (!v || typeof v !== "object" || v.children == null) continue;
        const kids = Array.isArray(v.children) ? v.children : [v.children];
        for (const k of kids) {
          if (!k || typeof k !== "object") continue;
          const sn = k._owner?.stateNode;
          if (instanceHasGameSignals(sn)) return sn;
        }
      }
    } catch {
      /* ignore */
    }
    const child = firstChildDiv(current);
    if (!child || child === current) return null;
    current = child;
    depth++;
  }
  return null;
}

function scoreInstance(inst: AnyNode): number {
  let score = 0;
  const props = inst.props ?? {};
  const state = inst.state ?? {};
  const ctrl = props.liveGameController;
  if (ctrl && typeof ctrl === "object") {
    score += 1000000;
    if (typeof ctrl.setVal === "function") score += 500000;
  }
  const client = props.client;
  if (client && typeof client === "object") {
    score += 300000;
    if (typeof client.name === "string") score += 200000;
    if (typeof client.type === "string") score += 100000;
  }
  if (state.question !== undefined) score += 150000;
  if (state.stage !== undefined || state.phase !== undefined) score += 150000;
  if (state.gold !== undefined || state.crypto !== undefined || state.cash !== undefined) {
    score += 150000;
  }
  if (Array.isArray(state.choices)) score += 50000;
  if (Array.isArray(inst.freeQuestions)) score += 50000;
  if (Array.isArray(inst.questions)) score += 50000;
  if (typeof inst.choosePrize === "function") score += 50000;
  return score;
}

function bestClassInstance(): AnyNode | null {
  let best: AnyNode | null = null;
  let bestScore = 0;
  for (const f of collectFibers()) {
    const sn = f.stateNode;
    if (!isClassInstance(sn)) continue;
    const s = scoreInstance(sn);
    if (s > bestScore) {
      bestScore = s;
      best = sn;
    }
  }
  return best;
}

function stateScore(v: AnyNode): number {
  if (!v || typeof v !== "object") return 0;
  if (typeof v.setVal === "function" || typeof v.getDatabaseVal === "function") return 0;
  if (v.child || v.sibling || v.return || v.$$typeof || v.memoizedState) return 0;
  let s = 0;
  if (v.question && typeof v.question === "object") s += 4;
  if (typeof v.stage === "string" || typeof v.phase === "string") s += 3;
  if (Array.isArray(v.choices)) s += 2;
  if (Array.isArray(v.answers) && Array.isArray(v.correctAnswers)) s += 2;
  if (typeof v.gold === "number") s += 2;
  if (typeof v.gold2 === "number") s += 2;
  if (typeof v.crypto === "number") s += 2;
  if (typeof v.cash === "number") s += 2;
  if (typeof v.doubloons === "number") s += 2;
  if (typeof v.tokens === "number") s += 1;
  if (v.blookData && typeof v.blookData === "object") s += 1;
  if (Array.isArray(v.customers)) s += 1;
  if (Array.isArray(v.questions)) s += 1;
  if (typeof v.health === "number") s += 1;
  if (v.island && typeof v.island === "object") s += 1;
  return s;
}

function isControllerLike(v: AnyNode): boolean {
  return (
    !!v &&
    typeof v === "object" &&
    (typeof v.setVal === "function" ||
      typeof v.removeVal === "function" ||
      typeof v.removePlayer === "function" ||
      typeof v.kickPlayer === "function" ||
      typeof v.disconnectPlayer === "function" ||
      !!v._liveApp ||
      typeof v.database === "function" ||
      typeof v.ref === "function")
  );
}

function ctrlScore(v: AnyNode): number {
  let s = 0;
  if (typeof v.setVal === "function") s += 100;
  if (typeof v.getDatabaseVal === "function") s += 4;
  if (typeof v.getVal === "function") s += 2;
  if (typeof v.removeVal === "function") s += 2;
  if (typeof v.removePlayer === "function") s += 2;
  if (typeof v.kickPlayer === "function" || typeof v.disconnectPlayer === "function") s += 2;
  if (typeof v.mode === "string" || typeof v._gameMode === "string") s += 4;
  if (!!v._liveApp) s += 6;
  if (typeof v.database === "function") s += 3;
  if (typeof v.ref === "function") s += 2;
  return s;
}

function firebaseFrom(v: AnyNode): AnyNode | null {
  if (!v || typeof v !== "object") return null;
  if (typeof v.database === "function") return v;
  if (v._liveApp && typeof v._liveApp.database === "function") return v._liveApp;
  if (v._liveApp && v._liveApp.firebase && typeof v._liveApp.firebase.database === "function") {
    return v._liveApp.firebase;
  }
  if (v.firebase && typeof v.firebase.database === "function") return v.firebase;
  return null;
}

function questionTextOf(v: AnyNode): string {
  if (!v || typeof v !== "object") return "";
  for (const k of ["question", "text", "prompt", "title"]) {
    if (typeof v[k] === "string" && v[k]) return v[k];
  }
  return "";
}

function answerArrayOf(v: AnyNode): AnyNode | null {
  if (!v || typeof v !== "object") return null;
  for (const k of ["answers", "choices", "options", "answerChoices", "responses"]) {
    const a = v[k];
    if (Array.isArray(a) && a.length) return a;
  }
  return null;
}

function isQuestionShaped(v: AnyNode): boolean {
  if (!v || typeof v !== "object") return false;
  const answers = answerArrayOf(v);
  if (!answers) return false;
  const c =
    v.correctAnswers ?? v.correctAnswer ?? v.correct ?? v.answer ??
    v.answerIndex ?? v.correctIndex ?? v.solution;
  if (c !== undefined && c !== null) {
    if (Array.isArray(c)) return c.length > 0;
    if (typeof c === "string" || typeof c === "number" || typeof c === "boolean") return true;
  }
  return answers.some(
    (a: AnyNode) => a && typeof a === "object" && (a.correct === true || a.isCorrect === true),
  );
}

const HTML_INPUT_TYPES = new Set([
  "checkbox",
  "text",
  "number",
  "password",
  "email",
  "radio",
  "button",
  "submit",
  "range",
  "color",
  "date",
  "hidden",
  "search",
  "tel",
  "url",
]);

const KNOWN_MODES = new Set([
  "gold",
  "crypto",
  "factory",
  "tower",
  "racing",
  "monster",
  "fishing",
  "cafe",
  "classic",
  "naval",
  "defense",
  "hacks",
  "kingdom",
  "island",
]);

function clientScore(v: AnyNode): number {
  if (!v || typeof v !== "object" || typeof v.name !== "string" || !v.name) return 0;
  const strong =
    typeof v.blook === "string" ||
    typeof v.isRandom === "boolean" ||
    typeof v.isHost === "boolean" ||
    (v.question && typeof v.question === "object") ||
    typeof v.b === "string" ||
    typeof v.g === "number" ||
    (typeof v.type === "string" && KNOWN_MODES.has(v.type));
  if (!strong) return 0;
  let s = 0;
  if (typeof v.blook === "string") s += 4;
  if (typeof v.isRandom === "boolean") s += 2;
  if (v.question && typeof v.question === "object") s += 3;
  if (typeof v.b === "string") s += 1;
  if (typeof v.isHost === "boolean") s += 1;
  if (typeof v.type === "string") {
    if (HTML_INPUT_TYPES.has(v.type)) return 0;
    if (KNOWN_MODES.has(v.type)) s += 3;
    else s += 1;
  }
  return s;
}

function isQuestionList(v: AnyNode): boolean {
  if (!v || !Array.isArray(v) || !v.length) return false;
  const first = v[0];
  if (!first || typeof first !== "object") return false;
  return (
    !!answerArrayOf(first) ||
    typeof first.question === "string" ||
    typeof first.text === "string" ||
    typeof first.prompt === "string"
  );
}

interface HookEntry {
  obj: AnyNode;
  hook: AnyNode | null;
  fiber: AnyNode | null;
}

interface ScanResult {
  inst: AnyNode | null;
  states: HookEntry[];
  ctrl: AnyNode | null;
  ctrlCandidates: number;
  client: AnyNode | null;
  lists: AnyNode[];
  questions: AnyNode[];
  answers: { obj: AnyNode; source: string }[];
  firebase: AnyNode | null;
  contextValues: number;
  methods: Record<string, { fn: AnyNode; owner: AnyNode | null }>;
  stateCandidates: number;
}

function deepScan(): ScanResult {
  const out: ScanResult = {
    inst: null,
    states: [],
    ctrl: null,
    ctrlCandidates: 0,
    client: null,
    lists: [],
    questions: [],
    answers: [],
    firebase: null,
    contextValues: 0,
    methods: {},
    stateCandidates: 0,
  };
  let bestScore = 0;
  let bestClientScore = 0;
  let bestCtrlScore = -1;
  const seenStates = new Set<AnyNode>();
  const considered = new Set<AnyNode>();

  const adoptCtrl = (o: AnyNode) => {
    const cs = ctrlScore(o);
    out.ctrlCandidates += 1;
    if (cs > bestCtrlScore) {
      bestCtrlScore = cs;
      out.ctrl = o;
    }
  };

  const pushQuestion = (q: AnyNode) => {
    if (isQuestionShaped(q) && !out.questions.includes(q)) out.questions.push(q);
  };

  const recordAnswers = (q: AnyNode, source: string) => {
    if (!q || typeof q !== "object") return;
    const c = q.correctAnswers ?? q.correctAnswer ?? q.correct;
    const has =
      Array.isArray(c)
        ? c.length > 0
        : c !== undefined && c !== null && c !== "";
    const arr = answerArrayOf(q);
    const flagged =
      Array.isArray(arr) &&
      arr.some(
        (a: AnyNode) =>
          a && typeof a === "object" && (a.correct === true || a.isCorrect === true),
      );
    if ((has || flagged) && !out.answers.some((e) => e.obj === q)) {
      out.answers.push({ obj: q, source });
    }
  };

  const consider = (o: AnyNode, hook: AnyNode | null, fiber: AnyNode | null, asState = true) => {
    if (!o || typeof o !== "object") return;
    if (considered.has(o)) return;
    considered.add(o);
    if (isControllerLike(o)) adoptCtrl(o);
    const fb = firebaseFrom(o);
    if (fb && !out.firebase) out.firebase = fb;
    const cs = clientScore(o);
    if (cs > bestClientScore) {
      bestClientScore = cs;
      out.client = o;
    }
    const subClient = o.client;
    if (subClient && typeof subClient === "object") {
      const sc = clientScore(subClient);
      if (sc > bestClientScore) {
        bestClientScore = sc;
        out.client = subClient;
      }
      recordAnswers(subClient, "client");
      recordAnswers(subClient.question, "client.question");
      recordAnswers(subClient.currentQuestion, "client.currentQuestion");
      for (const k of ["questions", "freeQuestions"]) {
        const arr = subClient[k];
        if (Array.isArray(arr)) {
          for (const q of arr) {
            if (q && typeof q === "object") {
              pushQuestion(q);
              recordAnswers(q, "client." + k);
            }
          }
        }
      }
    }
    if (isQuestionList(o) && !out.lists.includes(o)) out.lists.push(o);
    for (const k of ["questions", "freeQuestions"]) {
      const sub = o[k];
      if (sub && typeof sub === "object" && isQuestionList(sub) && !out.lists.includes(sub)) {
        out.lists.push(sub);
      }
    }
    pushQuestion(o);
    recordAnswers(o, "object");
    for (const k of ["question", "text", "prompt", "currentQuestion", "questionData"]) {
      const sub = o[k];
      if (sub && typeof sub === "object") {
        pushQuestion(sub);
        recordAnswers(sub, k);
      }
    }
    for (const k of ["questions", "freeQuestions", "questionSet"]) {
      const arr = o[k];
      if (Array.isArray(arr)) {
        for (const q of arr) if (q && typeof q === "object") pushQuestion(q);
      }
    }
    const sc = stateScore(o);
    if (asState) {
      if (sc > 0) out.stateCandidates += 1;
      if (sc >= 4 && !seenStates.has(o)) {
        seenStates.add(o);
        out.states.push({ obj: o, hook, fiber });
        if (sc > bestScore) bestScore = sc;
      }
    }
    for (const m of METHOD_NAMES) {
      if (!out.methods[m] && typeof o[m] === "function") out.methods[m] = { fn: o[m], owner: o };
    }
    for (const k of ["liveGameController", "controller", "gameController"]) {
      const c = o[k];
      if (c && typeof c === "object" && isControllerLike(c)) adoptCtrl(c);
    }
    if (typeof o.getState === "function") {
      try {
        const st = o.getState();
        if (st && typeof st === "object") consider(st, hook, fiber);
      } catch {
        /* ignore */
      }
    }
    for (const k of ["state", "gameState", "game", "data", "value", "current", "store", "snapshot"]) {
      const sub = o[k];
      if (sub && typeof sub === "object" && sub !== o) consider(sub, hook, fiber);
    }
  };

  const fibers = collectFibers();
  for (const f of fibers) {
    const sn = f.stateNode;
    if (isClassInstance(sn)) {
      const s = scoreInstance(sn);
      if (!out.inst || s > scoreInstance(out.inst)) out.inst = sn;
      if (sn.props && typeof sn.props === "object") consider(sn.props, null, f, false);
      if (sn.state && typeof sn.state === "object") consider(sn.state, null, f);
    }
    const props = f.memoizedProps;
    if (props && typeof props === "object") {
      consider(props, null, f, false);
      if (props.value && typeof props.value === "object") consider(props.value, null, f);
    }
    let dep = f.dependencies?.firstContext;
    while (dep) {
      if (dep.memoizedValue && typeof dep.memoizedValue === "object") {
        out.contextValues += 1;
        consider(dep.memoizedValue, null, f);
      }
      dep = dep.next;
    }
    let h = f.memoizedState;
    while (h) {
      const v = h.memoizedState;
      if (v && typeof v === "object") {
        if (v.current && typeof v.current === "object") {
          consider(v.current, h, f);
        }
        consider(v, h, f);
        if (
          Array.isArray(v) &&
          v.length === 2 &&
          typeof v[1] === "function" &&
          v[0] &&
          typeof v[0] === "object"
        ) {
          consider(v[0], h, f);
        }
      }
      h = h.next;
    }
  }

  out.states.sort((a, b) => stateScore(b.obj) - stateScore(a.obj));
  return out;
}

function findInstance(): AnyNode | null {
  for (const doc of allDocuments()) {
    const ref = referenceInstance(doc);
    if (ref) return ref;
  }
  return bestClassInstance();
}

function hookValue(hook: AnyNode | null): AnyNode | null {
  if (!hook) return null;
  const hv = hook.memoizedState;
  if (Array.isArray(hv) && hv.length >= 1 && hv[0] && typeof hv[0] === "object") return hv[0];
  if (hv && typeof hv === "object") return hv;
  return null;
}

function poolQuestion(scan: ScanResult): AnyNode | null {
  const pool = scan.questions;
  if (!pool.length) return null;
  const seenText = new Set<string>();
  try {
    const doc = gameDocument();
    const els = doc.querySelectorAll("div,button,span,p,[role='button']");
    const cap = Math.min(els.length, 3000);
    for (let i = 0; i < cap; i++) {
      const t = (els[i].textContent ?? "").trim().toLowerCase();
      if (t && t.length <= 160) seenText.add(t);
    }
  } catch {
    /* ignore */
  }
  for (const q of pool.slice().reverse()) {
    const answers = answerArrayOf(q);
    if (!answers) continue;
    for (const a of answers.slice(0, 4)) {
      const text = a && typeof a === "object" ? (a.text ?? a.answerText ?? a.label ?? a.value) : a;
      const needle = String(text ?? "").trim().toLowerCase();
      if (needle && seenText.has(needle)) return q;
    }
  }
  return pool[pool.length - 1];
}

function wrapNode(inst: AnyNode | null, scan: ScanResult): AnyNode {
  const stateEntries = scan.states;
  const primary = stateEntries[0] ?? null;
  let stateObj: AnyNode = null;
  if (inst && inst.state && typeof inst.state === "object") stateObj = inst.state;
  else if (primary) stateObj = primary.obj;
  const ctrl = inst?.props?.liveGameController ?? scan.ctrl ?? null;
  const client = inst?.props?.client ?? scan.client ?? null;
  const lists = scan.lists.length ? scan.lists : null;

  const syncPrimary = () => {
    if (inst && inst.state && typeof inst.state === "object" && inst.state !== stateObj) {
      stateObj = inst.state;
      return;
    }
    if (!inst && primary?.hook) {
      const cand = hookValue(primary.hook);
      if (cand && cand !== stateObj) stateObj = cand;
    }
  };

  const currentStateObjs = (): AnyNode[] => {
    if (inst) {
      return inst.state && typeof inst.state === "object" ? [inst.state] : [];
    }
    const objs: AnyNode[] = [];
    for (const e of stateEntries) {
      const obj = e.hook ? hookValue(e.hook) : e.obj;
      if (obj && typeof obj === "object" && !objs.includes(obj)) objs.push(obj);
      if (e.obj && e.obj !== obj && typeof e.obj === "object" && !objs.includes(e.obj)) {
        objs.push(e.obj);
      }
    }
    if (!objs.length && stateObj) objs.push(stateObj);
    return objs;
  };

  const applyPatch = (patch: AnyNode) => {
    if (inst && typeof inst.setState === "function") {
      try {
        inst.setState(patch);
      } catch {
        /* ignore */
      }
      syncPrimary();
      return;
    }
    for (const e of stateEntries) {
      const obj = e.hook ? hookValue(e.hook) : e.obj;
      if (!obj || typeof obj !== "object") continue;
      try {
        Object.assign(obj, patch);
      } catch {
        /* ignore */
      }
      if (e.hook?.queue?.dispatch) {
        try {
          e.hook.queue.dispatch((prev: AnyNode) => ({ ...(prev ?? obj), ...patch }));
        } catch {
          /* ignore */
        }
      }
    }
    syncPrimary();
  };

  const target = inst ?? {};

  return new Proxy(target, {
    get(t, prop: string) {
      if (prop === "state") {
        syncPrimary();
        return stateObj;
      }
      if (prop === "states") return currentStateObjs();
      if (prop === "questions") return scan.questions.slice();
      if (prop === "firebase") return scan.firebase;
      if (prop === "onAnswerOwner") return scan.methods.onAnswer?.owner ?? null;
      if (prop === "lists") return lists ? lists.slice() : [];
      if (prop === "answerSources") {
        return scan.answers.map((e) => e.obj);
      }
      if (prop === "hasCorrectAnswers") return scan.answers.length > 0;
      if (prop === "props") {
        const base = inst?.props ?? {};
        return {
          ...base,
          client,
          liveGameController: ctrl,
          questions: lists ? lists[0] : base.questions ?? [],
          freeQuestions: lists ? lists[0] : base.freeQuestions ?? [],
          question: stateObj?.question ?? client?.question ?? base.client?.question ?? null,
        };
      }
      if (prop === "client") return client ?? inst?.props?.client ?? null;
      if (prop === "setState") {
        return (patch: AnyNode) => applyPatch(patch);
      }
      if (prop === "setVal") {
        return (path: string, val: unknown) => {
          if (!ctrl || typeof ctrl.setVal !== "function") return;
          try {
            ctrl.setVal({ path, val });
          } catch {
            try {
              ctrl.setVal(path, val);
            } catch {
              /* ignore */
            }
          }
        };
      }
      if (prop === "getVal" || prop === "getDatabaseVal") {
        return (path: string, cb: (val: AnyNode) => void) => {
          if (!ctrl) return;
          const fn = ctrl.getDatabaseVal ?? ctrl.getVal;
          if (typeof fn !== "function") return;
          try {
            const r = fn.call(ctrl, path, cb);
            if (r && typeof r.then === "function") r.then(cb).catch(() => {});
          } catch {
            /* ignore */
          }
        };
      }
      if (prop === "question") {
        return () =>
          poolQuestion(scan) ??
          stateObj?.question ??
          client?.question ??
          inst?.props?.client?.question ??
          null;
      }
      if (prop === "forceUpdate") {
        return () => {
          try {
            inst?.forceUpdate?.();
          } catch {
            /* ignore */
          }
          if (!inst) {
            for (const e of stateEntries) {
              if (e.hook?.queue?.dispatch) {
                try {
                  e.hook.queue.dispatch((prev: AnyNode) => ({ ...(prev ?? e.obj) }));
                } catch {
                  /* ignore */
                }
              }
            }
          }
        };
      }
      if (prop === "freeQuestions" || prop === "questions") {
        return lists && lists.length ? lists[0] : inst?.[prop] ?? undefined;
      }
      const aliasKey = METHOD_NAMES.includes(prop)
        ? prop
        : (Object.keys(METHOD_ALIASES).find((k) => METHOD_ALIASES[k].includes(prop)) ?? null);
      if (aliasKey) {
        const rec = scan.methods[aliasKey];
        const fn = inst?.[prop] ?? rec?.fn;
        if (typeof fn !== "function") return undefined;
        return fn.bind(rec?.owner ?? inst ?? null);
      }
      const v = Reflect.get(t, prop);
      if (typeof v === "function" && prop !== "constructor") return v.bind(t);
      return v;
    },
    set(t, prop: string, value) {
      if (typeof t === "object" && t !== null) t[prop] = value;
      return true;
    },
  });
}

let nodeCache: { node: AnyNode | null; at: number } | null = null;

export function findStateNode(): AnyNode | null {
  const now = Date.now();
  if (nodeCache) {
    const ttl = nodeCache.node ? 400 : 150;
    if (now - nodeCache.at < ttl) return nodeCache.node;
  }
  const inst = findInstance();
  const scan = deepScan();
  const node =
    inst || scan.states.length || scan.ctrl || scan.client ? wrapNode(inst, scan) : null;
  nodeCache = { node, at: now };
  return node;
}

export function findInstanceWithMethod(method: string): AnyNode | null {
  for (const f of collectFibers()) {
    const sn = f.stateNode;
    if (sn && typeof sn[method] === "function") return sn;
  }
  const rec = deepScan().methods[method];
  if (!rec || typeof rec.fn !== "function") return null;
  return rec.fn.bind(rec.owner ?? null);
}

export function methodOwner(method: string): AnyNode | null {
  return deepScan().methods[method]?.owner ?? null;
}

function describe(v: AnyNode, depth = 0): any {
  if (v === null || v === undefined) return v;
  if (depth > 2) return "[depth]";
  if (Array.isArray(v)) {
    return {
      type: "array",
      length: v.length,
      first: v.length ? describe(v[0], depth + 1) : null,
    };
  }
  if (typeof v === "object") {
    const keys = Object.keys(v);
    const out: Record<string, any> = { keys: keys.slice(0, 30) };
    for (const k of keys.slice(0, 14)) {
      const val = v[k];
      if (typeof val === "string") out[k] = String(val).slice(0, 100);
      else if (typeof val === "number" || typeof val === "boolean") out[k] = val;
      else if (typeof val === "function") out[k] = "function";
      else if (Array.isArray(val)) {
        out[k] = {
          type: "array",
          length: val.length,
          first: val.length ? describe(val[0], depth + 1) : null,
        };
      } else if (val && typeof val === "object") {
        out[k] = { type: "object", keys: Object.keys(val).slice(0, 14) };
      }
    }
    return out;
  }
  return typeof v;
}

function findPropsQuestion(): AnyNode | null {
  for (const f of collectFibers()) {
    const p = f.memoizedProps;
    if (p && typeof p === "object" && p.question && typeof p.question === "object") {
      return p.question;
    }
    const sn = f.stateNode;
    if (sn && sn.props && typeof sn.props.question === "object") return sn.props.question;
  }
  return null;
}

function describeStateFields(state: AnyNode): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of [
    "gold", "crypto", "cash", "doubloons", "totalPrizeMoney", "goldEvents",
    "playerToGameStats", "playerToStatDeltas", "players", "host", "g", "c",
  ]) {
    if (state[k] !== undefined) out[k] = describe(state[k]);
  }
  return out;
}

export function stateDiagnostics(): Record<string, any> {
  const inst = findInstance();
  const scan = deepScan();
  const state = inst?.state ?? scan.states[0]?.obj ?? {};
  const props = inst?.props ?? {};
  const source = inst
    ? "instance"
    : scan.states.length || scan.ctrl
      ? "hooks"
      : scan.client
        ? "client"
        : null;
  const ctrl = props.liveGameController ?? scan.ctrl ?? null;
  const client = props.client ?? scan.client ?? null;
  const hasQuestion = !!(state.question || client?.question);
  const hasGold =
    state.gold !== undefined ||
    state.crypto !== undefined ||
    state.cash !== undefined ||
    state.doubloons !== undefined;
  const strong =
    !!inst ||
    !!ctrl ||
    (!!scan.states[0] && (hasQuestion || hasGold || !!state.stage || !!state.phase));
  return {
    version: VERSION,
    found: !!inst || !!scan.states.length || !!ctrl || !!client,
    strong,
    source,
    score: inst
      ? scoreInstance(inst)
      : scan.states[0]
        ? stateScore(scan.states[0].obj)
        : 0,
    controller: !!ctrl,
    clientName: client?.name ?? null,
    clientType: client?.type ?? null,
    hasQuestion,
    hasGold,
    stage: state.stage ?? state.phase ?? null,
    stateKeys: Object.keys(state).slice(0, 30),
    hookStates: scan.stateCandidates,
    states: scan.states.length,
    questionPool: scan.questions.length,
    topStates: scan.states.slice(0, 3).map((s) => Object.keys(s.obj).slice(0, 14)),
    questionsInfo: describe(Array.isArray(state.questions) ? state.questions : null),
    stateQuestionInfo: state.question && typeof state.question === "object" ? describe(state.question) : null,
    propsQuestionInfo: (() => {
      const q = findPropsQuestion();
      return q ? describe(q) : null;
    })(),
    goldInfo: describeStateFields(state),
    clientInfo: client && typeof client === "object" ? describe(client) : null,
    ctrlCandidates: scan.ctrlCandidates,
    ctrlKeys: scan.ctrl ? Object.keys(scan.ctrl).slice(0, 14) : [],
    firebase: !!scan.firebase,
    contextValues: scan.contextValues,
    onAnswer: typeof scan.methods.onAnswer?.fn === "function",
    sendAnswerNext: typeof scan.methods.sendAnswerNext?.fn === "function",
    lists: scan.lists.length,
    answerSources: scan.answers.map((e) => ({
      source: e.source,
      prompt: questionTextOf(e.obj) || "(no text)",
      answers: (answerArrayOf(e.obj) ?? []).length,
      correctAnswers: Array.isArray(e.obj.correctAnswers) ? e.obj.correctAnswers.slice(0, 8) : (e.obj.correctAnswers ?? e.obj.correctAnswer ?? e.obj.correct ?? null),
    })),
    anyCorrectAnswers: scan.answers.length > 0,
    methods: Object.keys(scan.methods),
    fibers: collectFibers().length,
    devtools: !!(window as AnyNode).__REACT_DEVTOOLS_GLOBAL_HOOK__,
  };
}

export function debugDump(): Record<string, any> {
  const fibers = collectFibers();
  const classes: AnyNode[] = [];
  for (const f of fibers) {
    const sn = f.stateNode;
    if (!isClassInstance(sn)) continue;
    classes.push({
      name: f.type?.name ?? f.elementType?.name ?? "?",
      score: scoreInstance(sn),
      hasClient: !!sn.props?.client,
      hasController: !!sn.props?.liveGameController,
      stateKeys: Object.keys(sn.state ?? {}).slice(0, 12),
    });
  }
  classes.sort((a, b) => b.score - a.score);
  const inst = findInstance();
  const scan = deepScan();
  return {
    url: window.location.href,
    fibers: fibers.length,
    classInstances: classes.slice(0, 8),
    hookStates: scan.stateCandidates,
    hookStateKeys: scan.states[0] ? Object.keys(scan.states[0].obj).slice(0, 16) : [],
    hasHookController: !!scan.ctrl,
    hasHookClient: !!scan.client,
    hookMethods: Object.keys(scan.methods),
    best: inst
      ? { name: inst.constructor?.name ?? "?", score: scoreInstance(inst) }
      : scan.states[0]
        ? { name: "hook-state", score: stateScore(scan.states[0].obj) }
        : null,
    devtools: !!(window as AnyNode).__REACT_DEVTOOLS_GLOBAL_HOOK__,
  };
}
