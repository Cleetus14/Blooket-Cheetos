type AnyNode = any;

const FIBER_PREFIXES = ["__reactFiber$", "__reactInternalInstance$", "__reactContainer$"];

const METHOD_NAMES = [
  "sendAnswer",
  "choosePrize",
  "kickPlayer",
  "removePlayer",
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

function isController(v: AnyNode): boolean {
  return (
    !!v &&
    typeof v === "object" &&
    typeof v.setVal === "function" &&
    (typeof v.getDatabaseVal === "function" || typeof v.getVal === "function")
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
  if (!v || typeof v !== "object" || typeof v.name !== "string") return 0;
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

function isClient(v: AnyNode): boolean {
  return clientScore(v) >= 3;
}

function isQuestionList(v: AnyNode): boolean {
  return (
    !!v &&
    Array.isArray(v) &&
    v.length > 0 &&
    !!v[0] &&
    typeof v[0] === "object" &&
    Array.isArray(v[0].answers) &&
    Array.isArray(v[0].correctAnswers)
  );
}

interface HookFindings {
  state: AnyNode | null;
  stateHook: AnyNode | null;
  ctrl: AnyNode | null;
  client: AnyNode | null;
  lists: AnyNode[];
  methods: Record<string, AnyNode>;
  stateCandidates: number;
}

function hookScan(): HookFindings {
  const out: HookFindings = {
    state: null,
    stateHook: null,
    ctrl: null,
    client: null,
    lists: [],
    methods: {},
    stateCandidates: 0,
  };
  let bestScore = 0;
  let bestCtor: AnyNode | null = null;
  let bestClient: AnyNode | null = null;
  let bestClientScore = 0;

  const adoptClient = (o: AnyNode) => {
    const cs = clientScore(o);
    if (cs > bestClientScore) {
      bestClientScore = cs;
      bestClient = o;
    }
  };

  const consider = (v: AnyNode) => {
    if (!v || typeof v !== "object") return;
    const direct = v.current && typeof v.current === "object" ? [v, v.current] : [v];
    for (const o of direct) {
      if (!o || typeof o !== "object") continue;
      if (!out.ctrl && isController(o)) out.ctrl = o;
      if (isClient(o)) adoptClient(o);
      if (o.client && isClient(o.client)) adoptClient(o.client);
      if (isQuestionList(o)) out.lists.push(o);
      const sc = stateScore(o);
      if (sc > 0) out.stateCandidates += 1;
      if (sc > bestScore) {
        bestScore = sc;
        bestCtor = o;
      }
      for (const m of METHOD_NAMES) {
        if (!out.methods[m] && typeof o[m] === "function") out.methods[m] = o[m];
      }
      for (const k of ["liveGameController", "controller", "gameController"]) {
        const c = o[k];
        if (!out.ctrl && isController(c)) out.ctrl = c;
      }
    }
  };

  const fibers = collectFibers();
  for (const f of fibers) {
    const props = f.memoizedProps;
    if (props && typeof props === "object") {
      consider(props);
      if (props.value && typeof props.value === "object") consider(props.value);
    }
    let h = f.memoizedState;
    while (h) {
      const v = h.memoizedState;
      if (v && typeof v === "object") {
        consider(v);
        if (Array.isArray(v) && v.length === 2 && typeof v[1] === "function" && v[0] && typeof v[0] === "object") {
          consider(v[0]);
        }
      }
      h = h.next;
    }
  }

  if (bestScore >= 4 && bestCtor) {
    out.state = bestCtor;
    for (const f of fibers) {
      if (typeof f.type !== "function") continue;
      let h = f.memoizedState;
      while (h) {
        const v = h.memoizedState;
        if (
          v === bestCtor ||
          (v && v.current === bestCtor) ||
          (Array.isArray(v) && v[0] === bestCtor)
        ) {
          out.stateHook = h;
          break;
        }
        h = h.next;
      }
      if (out.stateHook) break;
    }
  }
  out.client = bestClient;
  return out;
}

function findInstance(): AnyNode | null {
  for (const doc of allDocuments()) {
    const ref = referenceInstance(doc);
    if (ref) return ref;
  }
  const cls = bestClassInstance();
  if (cls) return cls;
  return null;
}

function wrapNode(inst: AnyNode, hooks: HookFindings): AnyNode {
  let stateObj: AnyNode = null;
  if (inst && inst.state && typeof inst.state === "object") stateObj = inst.state;
  else stateObj = hooks.state ?? null;
  const stateHook = hooks.stateHook ?? null;
  const ctrl = inst?.props?.liveGameController ?? hooks.ctrl ?? null;
  const client = inst?.props?.client ?? hooks.client ?? null;
  const lists = hooks.lists.length ? hooks.lists : null;

  const syncState = () => {
    if (inst && inst.state && typeof inst.state === "object" && inst.state !== stateObj) {
      stateObj = inst.state;
    }
    if (!inst && stateHook) {
      const hv = stateHook.memoizedState;
      const candidate =
        Array.isArray(hv) && hv.length >= 1 && hv[0] && typeof hv[0] === "object" ? hv[0] : hv;
      if (candidate && typeof candidate === "object" && candidate !== stateObj) {
        stateObj = candidate;
      }
    }
  };

  const setStateViaHook = (patch: AnyNode) => {
    if (!stateObj || typeof stateObj !== "object") return;
    syncState();
    try {
      Object.assign(stateObj, patch);
    } catch {
      /* ignore */
    }
    if (stateHook?.queue?.dispatch) {
      try {
        stateHook.queue.dispatch((prev: AnyNode) => ({ ...(prev ?? stateObj), ...patch }));
      } catch {
        /* ignore */
      }
    }
  };

  const target = inst ?? {};

  return new Proxy(target, {
    get(t, prop: string) {
      if (prop === "state") {
        syncState();
        return stateObj;
      }
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
        return (patch: AnyNode) => {
          if (inst && typeof inst.setState === "function") {
            try {
              inst.setState(patch);
            } catch {
              /* ignore */
            }
            return;
          }
          setStateViaHook(patch);
        };
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
        return () => stateObj?.question ?? client?.question ?? inst?.props?.client?.question ?? null;
      }
      if (prop === "forceUpdate") {
        return () => {
          try {
            inst?.forceUpdate?.();
          } catch {
            /* ignore */
          }
          if (!inst && stateHook?.queue?.dispatch) {
            try {
              stateHook.queue.dispatch((prev: AnyNode) => ({ ...(prev ?? stateObj) }));
            } catch {
              /* ignore */
            }
          }
        };
      }
      if (prop === "freeQuestions" || prop === "questions") {
        return lists && lists.length ? lists[0] : inst?.[prop] ?? undefined;
      }
      for (const m of METHOD_NAMES) {
        if (prop === m || (METHOD_ALIASES[prop] ?? []).includes(m)) {
          const fn = inst?.[prop] ?? hooks.methods[prop] ?? hooks.methods[m];
          if (typeof fn !== "function") return undefined;
          return fn.bind(inst ?? null);
        }
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
  const hooks = hookScan();
  const node = inst || hooks.state || hooks.ctrl || hooks.client ? wrapNode(inst, hooks) : null;
  nodeCache = { node, at: now };
  return node;
}

export function findInstanceWithMethod(method: string): AnyNode | null {
  for (const f of collectFibers()) {
    const sn = f.stateNode;
    if (sn && typeof sn[method] === "function") return sn;
  }
  const hooks = hookScan();
  return typeof hooks.methods[method] === "function" ? hooks.methods[method] : null;
}

export function stateDiagnostics(): Record<string, any> {
  const inst = findInstance();
  const hooks = hookScan();
  const state = hooks.state ?? inst?.state ?? {};
  const props = inst?.props ?? {};
  const source = inst ? "instance" : hooks.state || hooks.ctrl ? "hooks" : null;
  const ctrl = props.liveGameController ?? hooks.ctrl ?? null;
  const client = props.client ?? hooks.client ?? null;
  return {
    found: !!inst || !!(hooks.state || hooks.ctrl || hooks.client),
    source,
    score: inst ? scoreInstance(inst) : hooks.state ? stateScore(hooks.state) : 0,
    controller: !!ctrl,
    clientName: client?.name ?? null,
    clientType: client?.type ?? null,
    hasQuestion: !!(state.question || client?.question),
    hasGold:
      state.gold !== undefined ||
      state.crypto !== undefined ||
      state.cash !== undefined ||
      state.doubloons !== undefined,
    stage: state.stage ?? state.phase ?? null,
    stateKeys: Object.keys(state).slice(0, 30),
    hookStates: hooks.stateCandidates,
    methods: Object.keys(hooks.methods),
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
  const hooks = hookScan();
  return {
    url: window.location.href,
    fibers: fibers.length,
    classInstances: classes.slice(0, 8),
    hookStates: hooks.stateCandidates,
    hookStateKeys: hooks.state ? Object.keys(hooks.state).slice(0, 16) : [],
    hasHookController: !!hooks.ctrl,
    hasHookClient: !!hooks.client,
    hookMethods: Object.keys(hooks.methods),
    best: inst
      ? { name: inst.constructor?.name ?? "?", score: scoreInstance(inst) }
      : hooks.state
        ? { name: "hook-state", score: stateScore(hooks.state) }
        : null,
    devtools: !!(window as AnyNode).__REACT_DEVTOOLS_GLOBAL_HOOK__,
  };
}
