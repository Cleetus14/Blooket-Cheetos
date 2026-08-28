type AnyNode = any;

function isCheetosEl(el: HTMLElement | null): boolean {
  return !!el && (el.id === "cheetos-root" || el.id === "cheetos-panel" || el.id === "cheetos-toggle");
}

function isGameStateNode(stateNode: AnyNode): boolean {
  if (!stateNode || typeof stateNode.setState !== "function" || !stateNode.state) return false;
  const s = stateNode.state;
  const p = stateNode.props;
  if (p?.liveGameController) return true;
  if (typeof s.stage === "string" && s.stage) return true;
  if (typeof s.phase === "string" && s.phase) return true;
  if (s.question) return true;
  if (typeof s.gold === "number") return true;
  if (typeof s.crypto === "number") return true;
  if (typeof s.cash === "number") return true;
  return false;
}

function classicStateNode(root: HTMLElement): AnyNode | null {
  let current: HTMLElement | null = root;
  let depth = 0;
  while (current && depth < 600) {
    const entry: AnyNode = (Object.values(current) as AnyNode[])[1];
    if (entry?.children?.[0]?._owner?.stateNode) {
      try {
        const stateNode = entry.children[0]._owner.stateNode;
        if (isGameStateNode(stateNode)) return stateNode;
      } catch {
        /* keep walking */
      }
    }
    const child: HTMLElement | null = current.querySelector(":scope>div");
    if (!child || child === current) break;
    current = child;
    depth++;
  }
  return null;
}

function fiberKey(el: HTMLElement): string | null {
  for (const key of Object.keys(el)) {
    if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) return key;
  }
  return null;
}

function getFiber(el: HTMLElement): AnyNode | null {
  const key = fiberKey(el);
  return key ? (el as AnyNode)[key] : null;
}

function walkFiber(fiber: AnyNode): AnyNode | null {
  const seen = new Set<AnyNode>();
  const stack: AnyNode[] = [fiber];
  while (stack.length) {
    const f = stack.pop();
    if (!f || seen.has(f)) continue;
    seen.add(f);
    const stateNode = f.stateNode;
    if (stateNode && stateNode !== f && isGameStateNode(stateNode)) return stateNode;
    if (f.child) stack.push(f.child);
    if (f.sibling) stack.push(f.sibling);
  }
  return null;
}

function candidateRoots(): HTMLElement[] {
  const roots: HTMLElement[] = [];
  for (const id of ["root", "app", "game"]) {
    const el = document.getElementById(id);
    if (el) roots.push(el);
  }
  for (const el of Array.from(document.querySelectorAll("body>div"))) {
    const htmlEl = el as HTMLElement;
    if (!isCheetosEl(htmlEl) && !roots.includes(htmlEl)) roots.push(htmlEl);
  }
  return roots;
}

export function findStateNode(): AnyNode | null {
  for (const root of candidateRoots()) {
    const classic = classicStateNode(root);
    if (classic) return classic;

    const fiber = getFiber(root);
    if (fiber) {
      let top = fiber;
      while (top.return) top = top.return;
      const found = walkFiber(top);
      if (found) return found;
    }
  }
  return null;
}
