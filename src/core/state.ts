function rootElement(): HTMLElement | null {
  const byId = document.getElementById("root");
  if (byId) return byId;
  for (const el of document.body.children) {
    if ((el as HTMLElement).id !== "cheetos-root") return el as HTMLElement;
  }
  return document.querySelector("body>div");
}

export function findStateNode(): any {
  const react = (node: any, depth: number): any => {
    if (!node || depth > 500) return null;
    const entry: any = (Object.values(node) as any[])[1];
    if (entry?.children?.[0]?._owner?.stateNode) {
      return node;
    }
    const child = node.querySelector?.(":scope>div");
    return child ? react(child, depth + 1) : null;
  };

  const root = react(rootElement(), 0);
  if (!root) return null;
  try {
    const entry: any = (Object.values(root) as any[])[1];
    return entry.children[0]._owner.stateNode;
  } catch {
    return null;
  }
}
