type AnyNode = any;

function isCheetosEl(el: HTMLElement | null): boolean {
  return !!el && (el.id === "cheetos-root" || el.id === "cheetos-panel" || el.id === "cheetos-toggle");
}

// ---------------------------------------------------------------------------
// React internals
// ---------------------------------------------------------------------------

// React 16/17/18 attach enumerable keys like `__reactFiber$<hash>`,
// `__reactProps$<hash>` and `__reactContainer$<hash>` onto the rendered DOM
// node. `Object.values(el)[1]` is the props object for the root container in
// the order React installs them, which is what 05konz's getStateNode relies on.
// We expose both the named-key lookup and that legacy ordered lookup so we work
// regardless of which exact build Blooket is currently serving.
function reactKeys(el: HTMLElement, prefix: string): string[] {
  const out: string[] = [];
  for (const key of Object.keys(el)) {
    if (key.startsWith(prefix)) out.push(key);
  }
  return out;
}

function propsOf(el: HTMLElement): AnyNode | null {
  for (const key of reactKeys(el, "__reactProps$")) {
    const props = (el as AnyNode)[key];
    if (props) return props;
  }
  // Legacy fallback used by the reference getStateNode.
  const values = Object.values(el) as AnyNode[];
  return values[1] ?? null;
}

function ownerStateNodeOf(el: HTMLElement): AnyNode | null {
  const props = propsOf(el);
  return props?.children?.[0]?._owner?.stateNode ?? null;
}

// Exact port of the reference walk: descend `body>div > div > ...` and return
// the first React component instance reachable through `_owner.stateNode`.
// React 18+ removed `_owner`, so this is kept as the primary fast path for
// older Blooket builds and the fiber walk below is the fallback.
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

function fiberOf(el: HTMLElement): AnyNode[] {
  const out: AnyNode[] = [];
  for (const key of Object.keys(el)) {
    if (
      key.startsWith("__reactFiber$") ||
      key.startsWith("__reactInternalInstance$") ||
      key.startsWith("__reactContainer$")
    ) {
      const fiber = (el as AnyNode)[key];
      if (fiber) out.push(fiber);
    }
  }
  return out;
}

// Walks every React fiber tree reachable from the candidate roots and returns
// every class-component instance (fiber.stateNode with a setState method).
// React 18 function components have fiber.stateNode === null, so they are not
// matched here; Blooket's game controller is still a class component.
function collectClassInstances(roots: HTMLElement[]): AnyNode[] {
  const found: AnyNode[] = [];
  const seen = new Set<AnyNode>();
  const stack: AnyNode[] = [];
  for (const el of roots) {
    for (const fiber of fiberOf(el)) stack.push(fiber);
  }
  while (stack.length) {
    const fiber = stack.pop();
    if (!fiber || seen.has(fiber)) continue;
    seen.add(fiber);
    const stateNode = fiber.stateNode;
    if (stateNode && stateNode !== fiber && typeof stateNode.setState === "function") {
      found.push(stateNode);
    }
    if (fiber.child) stack.push(fiber.child);
    if (fiber.sibling) stack.push(fiber.sibling);
  }
  return found;
}

function candidateRoots(): HTMLElement[] {
  const roots: HTMLElement[] = [];
  // Blooket mounts at the first direct child div of body; that is what the
  // reference walk uses, so put body>div first.
  for (const el of Array.from(document.querySelectorAll("body>div"))) {
    const htmlEl = el as HTMLElement;
    if (!isCheetosEl(htmlEl) && !roots.includes(htmlEl)) roots.push(htmlEl);
  }
  for (const id of ["root", "app", "game"]) {
    const el = document.getElementById(id);
    if (el && !roots.includes(el)) roots.push(el);
  }
  return roots;
}

// Score a candidate by how strongly it looks like the live game controller
// rather than an unrelated React class component. Higher is better.
function scoreNode(node: AnyNode): number {
  if (!node) return -1;
  let score = 0;
  const props = node.props ?? {};
  const state = node.state ?? {};
  if (props.liveGameController) score += 1000;
  if (props.client) score += 500;
  if (Array.isArray(node.freeQuestions)) score += 300;
  if (Array.isArray(node.questions)) score += 300;
  if (Array.isArray(props.client?.questions)) score += 200;
  if (state.question) score += 150;
  if (state.gold !== undefined || state.gold2 !== undefined) score += 100;
  if (Array.isArray(state.choices)) score += 100;
  if (state.stage || state.phase) score += 50;
  if (typeof node.setState === "function") score += 1;
  return score;
}

function computeStateNode(): AnyNode | null {
  const roots = candidateRoots();

  // 1) Reference-exact `_owner.stateNode` candidates.
  const candidates: AnyNode[] = [];
  for (const root of roots) {
    const node = referenceWalk(root);
    if (node && !candidates.includes(node)) candidates.push(node);
  }

  // 2) Fiber-tree class-component candidates (React 18+ where _owner is gone).
  for (const inst of collectClassInstances(roots)) {
    if (inst && !candidates.includes(inst)) candidates.push(inst);
  }

  if (!candidates.length) return null;

  let best = candidates[0];
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = scoreNode(candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

let cache: { node: AnyNode | null; at: number } | null = null;

export function findStateNode(): AnyNode | null {
  const now = Date.now();
  if (cache && now - cache.at < 200) {
    return cache.node;
  }
  const node = computeStateNode();
  cache = { node, at: now };
  return node;
}

export function stateDiagnostics(): Record<string, any> {
  const node = findStateNode();
  const props = node?.props ?? {};
  const state = node?.state ?? {};
  return {
    found: !!node,
    score: scoreNode(node),
    hasLiveGameController: !!props.liveGameController,
    hasClient: !!props.client,
    clientType: props.client?.type ?? null,
    clientName: props.client?.name ?? null,
    hasQuestion: !!state.question || !!props.client?.question,
    hasChoices: Array.isArray(state.choices),
    hasGold: state.gold !== undefined || state.gold2 !== undefined,
    stage: state.stage ?? null,
    phase: state.phase ?? null,
  };
}
