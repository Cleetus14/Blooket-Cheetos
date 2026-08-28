import type { Question } from "../types";
import { gameDocument } from "./state";

// The current Blooket frontend hashes/renames its CSS classes, so the old
// `[class*='answerContainer']` selectors may match nothing. Every helper here
// falls back to text-based matching: find a clickable element whose text
// content equals the answer text. All queries run against the document that
// actually hosts the game (top page or a same-origin iframe).

function doc(): Document {
  return gameDocument();
}

function textMatches(el: Element, text: string): boolean {
  const t = (el.textContent ?? "").trim().toLowerCase();
  const needle = text.trim().toLowerCase();
  return t === needle;
}

function findAnswerByText(text: string): HTMLElement | null {
  if (!text) return null;
  const candidates = Array.from(
    doc().querySelectorAll("div,button,span,p,[role='button']"),
  ) as HTMLElement[];
  // Prefer elements that look interactive (role=button, button tags, cursor
  // pointers) and whose text exactly matches, then fall back to any match.
  for (const el of candidates) {
    if (!textMatches(el, text)) continue;
    const style = getComputedStyle(el);
    if (
      el.tagName === "BUTTON" ||
      el.getAttribute("role") === "button" ||
      style.cursor === "pointer"
    ) {
      return el;
    }
  }
  for (const el of candidates) {
    if (textMatches(el, text)) return el;
  }
  return null;
}

export function clickAnswer(question: Question, index: number): boolean {
  const answer = question.answers[index];
  // Primary path: the old selector still works on older Blooket builds.
  const nodes = doc().querySelectorAll("[class*='answerContainer']");
  const el = nodes[index] as HTMLElement | undefined;
  if (el) {
    el.click();
    return true;
  }
  // Fallback: match by text content.
  const byText = findAnswerByText(answer);
  if (byText) {
    byText.click();
    return true;
  }
  return false;
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
  const nodes = doc().querySelectorAll("[class*='answerContainer']");
  const idx = question.answers.findIndex(
    (a) => question.correctAnswers.indexOf(a) !== -1,
  );
  const el = nodes[idx] as HTMLElement | undefined;
  if (el) {
    el.click();
    return true;
  }
  for (const answer of question.correctAnswers) {
    const byText = findAnswerByText(answer);
    if (byText) {
      byText.click();
      return true;
    }
  }
  return false;
}

function typingInput(): HTMLInputElement | null {
  const wrapper: any = doc().querySelector("[class*='typingAnswerWrapper']");
  const input = wrapper?.querySelector("input, textarea");
  if (input) return input as HTMLInputElement;
  // Fallback: the first visible text input on the page (new frontend).
  const inputs = Array.from(doc().querySelectorAll("input[type='text'], input:not([type]), textarea")) as HTMLInputElement[];
  for (const el of inputs) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function typingStateNode(wrapper: any): any {
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
  return node;
}

export function submitTyping(answer: string): boolean {
  const wrapper: any = doc().querySelector("[class*='typingAnswerWrapper']");
  if (wrapper) {
    const node = typingStateNode(wrapper);
    if (typeof node?.sendAnswer === "function") {
      node.sendAnswer(answer);
      return true;
    }
  }
  // Text fallback: type into the visible input and submit with Enter.
  const input = typingInput();
  if (input) {
    const proto =
      input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter?.call(input, answer);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
    return true;
  }
  return false;
}

export function advanceFeedback(): boolean {
  const el = doc().querySelector(
    "[class*='feedback'], [id*='feedback']",
  ) as HTMLElement | null;
  const child: any = el?.firstChild;
  if (child && typeof child.click === "function") {
    child.click();
    return true;
  }
  // Fallback: click a Continue / Next / arrow button by text.
  const labels = ["continue", "next", "ok", "got it", "let's go", "onward"];
  const buttons = Array.from(
    doc().querySelectorAll("button, div[role='button'], [class*='button']"),
  ) as HTMLElement[];
  for (const b of buttons) {
    const t = (b.textContent ?? "").trim().toLowerCase();
    if (labels.some((l) => t === l || t.startsWith(l + " "))) {
      b.click();
      return true;
    }
  }
  return false;
}
