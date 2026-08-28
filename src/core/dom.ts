import type { Question } from "../types";

export function clickAnswer(question: Question, index: number): boolean {
  const nodes = document.querySelectorAll("[class*='answerContainer']");
  const el = nodes[index] as HTMLElement | undefined;
  if (!el) return false;
  el.click();
  return true;
}

export function randomWrongIndex(question: Question): number {
  const wrong: number[] = [];
  question.answers.forEach((answer, i) => {
    if (question.correctAnswers.indexOf(answer) === -1) wrong.push(i);
  });
  if (!wrong.length) return -1;
  return wrong[Math.floor(Math.random() * wrong.length)];
}

export function clickCorrect(question: Question): boolean {
  const nodes = document.querySelectorAll("[class*='answerContainer']");
  const idx = question.answers.findIndex(
    (a) => question.correctAnswers.indexOf(a) !== -1,
  );
  const el = nodes[idx] as HTMLElement | undefined;
  if (!el) return false;
  el.click();
  return true;
}

export function submitTyping(answer: string): boolean {
  const wrapper: any = document.querySelector("[class*='typingAnswerWrapper']");
  if (!wrapper) return false;
  // React 16/17 route via _owner, React 18 route via the fiber tree.
  let node: any = (Object.values(wrapper) as any[])[1]?.children?._owner?.stateNode;
  if (!node) {
    for (const key of Object.keys(wrapper)) {
      if (!key.startsWith("__reactFiber$") && !key.startsWith("__reactInternalInstance$")) continue;
      const fiber = wrapper[key];
      const seen = new Set<any>();
      const stack: any[] = [fiber];
      while (stack.length && !node) {
        const f = stack.pop();
        if (!f || seen.has(f)) continue;
        seen.add(f);
        const sn = f.stateNode;
        if (sn && typeof sn.sendAnswer === "function") {
          node = sn;
          break;
        }
        if (f.child) stack.push(f.child);
        if (f.sibling) stack.push(f.sibling);
      }
      if (node) break;
    }
  }
  if (typeof node?.sendAnswer === "function") {
    node.sendAnswer(answer);
    return true;
  }
  return false;
}

export function advanceFeedback(): boolean {
  const el = document.querySelector(
    "[class*='feedback'], [id*='feedback']",
  ) as HTMLElement | null;
  const child: any = el?.firstChild;
  if (child && typeof child.click === "function") {
    child.click();
    return true;
  }
  return false;
}
