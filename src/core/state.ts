type AnyNode = any;

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

const FIBER_PREFIXES = ["__reactFiber$", "__reactInternalInstance$", "__reactContainer$"];

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

function isClassInstance(o: AnyNode): boolean {
  return (
    !!o &&
    typeof o === "object" &&
    typeof o.setState === "function" &&
    typeof o.state === "object" &&
    o.state !== null
  );
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

function findGameInstance(): AnyNode | null {
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

export function findInstanceWithMethod(method: string): AnyNode | null {
  for (const f of collectFibers()) {
    const sn = f.stateNode;
    if (sn && typeof sn[method] === "function") return sn;
  }
  return null;
}

// Old Blooket builds expose the game class through _owner.stateNode. React 18
// dropped _owner, so this only runs as a fallback when the fiber walk is empty.
function legacyOwnerInstance(doc: Document): AnyNode | null {
  let current: HTMLElement | null = doc.querySelector("body>div") as HTMLElement | null;
  let depth = 0;
  while (current && depth < 800) {
    try {
      const stateNode = (Object.values(current) as AnyNode[])[1]?.children?.[0]
        ?._owner?.stateNode;
      if (stateNode && isClassInstance(stateNode)) return stateNode;
    } catch {
      /* ignore */
    }
    const child = current.querySelector?.(":scope>div");
    if (!child || child === current) break;
    current = child as HTMLElement;
    depth++;
  }
  return null;
}

function findInstance(): AnyNode | null {
  const inst = findGameInstance();
  if (inst) return inst;
  for (const doc of allDocuments()) {
    const legacy = legacyOwnerInstance(doc);
    if (legacy) return legacy;
  }
  return null;
}

function wrapNode(inst: AnyNode): AnyNode {
  const ctrl = inst.props?.liveGameController ?? null;
  const client = inst.props?.client ?? null;
  return new Proxy(inst, {
    get(t, prop: string) {
      if (prop === "setVal") {
        return (path: string, val: unknown) => {
          if (!ctrl || typeof ctrl.setVal !== "function") return;
          try {
            if (ctrl.setVal.length >= 2) ctrl.setVal(path, val);
            else ctrl.setVal({ path, val });
          } catch {
            try {
              ctrl.setVal({ path, val });
            } catch {
              /* ignore */
            }
          }
        };
      }
      if (prop === "getVal" || prop === "getDatabaseVal") {
        return (path: string, cb: (val: any) => void) => {
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
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  });
}

let nodeCache: { node: AnyNode | null; at: number } | null = null;

export function findStateNode(): AnyNode | null {
  const now = Date.now();
  if (nodeCache) {
    const ttl = nodeCache.node ? 300 : 150;
    if (now - nodeCache.at < ttl) return nodeCache.node;
  }
  const inst = findInstance();
  const node = inst ? wrapNode(inst) : null;
  nodeCache = { node, at: now };
  return node;
}

export function stateDiagnostics(): Record<string, any> {
  const inst = findInstance();
  const state = inst?.state ?? {};
  const props = inst?.props ?? {};
  return {
    found: !!inst,
    score: inst ? scoreInstance(inst) : 0,
    controller: !!props.liveGameController,
    clientName: props.client?.name ?? null,
    clientType: props.client?.type ?? null,
    hasQuestion: !!(state.question || props.client?.question),
    hasGold: state.gold !== undefined || state.crypto !== undefined || state.cash !== undefined,
    stage: state.stage ?? state.phase ?? null,
    stateKeys: Object.keys(state).slice(0, 30),
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
  return {
    url: window.location.href,
    fibers: fibers.length,
    classInstances: classes.slice(0, 8),
    best: inst
      ? { name: inst.constructor?.name ?? "?", score: scoreInstance(inst) }
      : null,
    devtools: !!(window as AnyNode).__REACT_DEVTOOLS_GLOBAL_HOOK__,
  };
}
