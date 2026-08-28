type AnyNode = any;

function isCheetosEl(el: HTMLElement | null): boolean {
  return !!el && (el.id === "cheetos-root" || el.id === "cheetos-panel" || el.id === "cheetos-toggle");
}

// Mirrors 05konz's reference walk: descend `body>div > div > ...` and return
// the first React class-component instance reachable through
// `__reactProps$....children[0]._owner.stateNode`. We intentionally do NOT
// filter on game-specific fields (liveGameController/stage/gold/etc.) because
// that over-shoots into a wrong (or null) node in the lobby or when Blooket
// wraps the game component in a provider.
function classicStateNode(root: HTMLElement): AnyNode | null {
  let current: HTMLElement | null = root;
  let depth = 0;
  while (current && depth < 600) {
    const props: AnyNode = (Object.values(current) as AnyNode[])[1];
    const stateNode = props?.children?.[0]?._owner?.stateNode;
    if (stateNode && typeof stateNode.setState === "function" && stateNode.state) {
      return stateNode;
    }
    const child: HTMLElement | null = current.querySelector?.(":scope>div") ?? null;
    if (!child || child === current) break;
    current = child;
    depth++;
  }
  return null;
}

function fiberKey(el: HTMLElement): string | null {
  for (const key of Object.keys(el)) {
    if (
      key.startsWith("__reactFiber$") ||
      key.startsWith("__reactInternalInstance$") ||
      key.startsWith("__reactContainer$")
    ) {
      return key;
    }
  }
  return null;
}

function getFiber(el: HTMLElement): AnyNode | null {
  const key = fiberKey(el);
  return key ? (el as AnyNode)[key] : null;
}

// Fallback for React builds where the props-based walk above is unavailable.
function walkFiber(fiber: AnyNode): AnyNode | null {
  const seen = new Set<AnyNode>();
  const stack: AnyNode[] = [fiber];
  while (stack.length) {
    const f = stack.pop();
    if (!f || seen.has(f)) continue;
    seen.add(f);
    const stateNode = f.stateNode;
    if (
      stateNode &&
      stateNode !== f &&
      typeof stateNode.setState === "function" &&
      stateNode.state
    ) {
      return stateNode;
    }
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
