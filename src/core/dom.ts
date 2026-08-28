import type { Question } from "../types";
import { allDocuments, gameDocument } from "./state";

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
  // pointers) and whose text exactly matches, then fall back to any match,
  // then to short elements that merely contain the answer text.
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
  const needle = text.trim().toLowerCase();
  for (const el of candidates) {
    const t = (el.textContent ?? "").trim().toLowerCase();
    if (t.length > 0 && t.length <= 80 && t.includes(needle)) {
      const style = getComputedStyle(el);
      if (
        el.tagName === "BUTTON" ||
        el.getAttribute("role") === "button" ||
        style.cursor === "pointer"
      ) {
        return el;
      }
    }
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

// True when the current question's prompt text is actually visible on the
// page. On the hashed-class frontend this is the reliable way to tell "the
// question is on screen" apart from the chest/lobby/feedback screens, so
// auto answer doesn't click random elements between questions.
let questionScreenCache: { sig: string; at: number; visible: boolean } | null = null;

export function isQuestionOnScreen(question: Question): boolean {
  const prompt = String(question.question ?? "").trim().toLowerCase();
  if (!prompt) return true;
  const sig = prompt + "|" + (question.answers ?? []).join("~");
  const now = Date.now();
  if (questionScreenCache && questionScreenCache.sig === sig && now - questionScreenCache.at < 400) {
    return questionScreenCache.visible;
  }
  let visible = false;
  const nodes = doc().querySelectorAll("div,span,p,h1,h2,h3");
  const cap = Math.min(nodes.length, 1500);
  for (let i = 0; i < cap; i++) {
    const t = (nodes[i].textContent ?? "").trim().toLowerCase();
    if (t === prompt) {
      visible = true;
      break;
    }
  }
  questionScreenCache = { sig, at: now, visible };
  return visible;
}

export function clickChoiceByText(text: string): boolean {
  const el = findAnswerByText(text);
  if (el) {
    el.click();
    return true;
  }
  return false;
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

// Reference-exact answer click: `[class*='answerContainer']` at the same
// index as the answer, tried on every same-origin document (top page first).
// This is the exact selector the reference autoAnswer uses. Text-based
// fallback covers builds where the class was renamed.
export function clickAnswerContainerAt(index: number, fallbackText?: string): boolean {
  for (const doc of allDocuments()) {
    try {
      const nodes = doc.querySelectorAll("[class*='answerContainer']");
      const el = nodes[index] as HTMLElement | undefined;
      if (el) {
        el.click();
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  if (fallbackText) {
    const byText = findAnswerByText(fallbackText);
    if (byText) {
      byText.click();
      return true;
    }
  }
  return false;
}

// Reference-exact feedback advance: click the first child of the feedback
// element (the continue button), tried on every same-origin document.
export function clickFeedbackAdvance(): boolean {
  for (const doc of allDocuments()) {
    try {
      const el = doc.querySelector("[class*='feedback'], [id*='feedback']") as HTMLElement | null;
      const child = el?.firstChild as HTMLElement | null;
      if (child && typeof (child as any).click === "function") {
        (child as any).click();
        return true;
      }
    } catch {
      /* ignore */
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

export function typingStateNode(wrapper: any): any {
  // React 16/17 route via _owner (reference approach), React 18 route via
  // the fiber tree. children may be a single element or an array.
  let node: any = null;
  const values = Object.values(wrapper) as any[];
  const kids = values[1]?.children;
  if (Array.isArray(kids)) {
    for (const k of kids) {
      if (k?._owner?.stateNode) {
        node = k._owner.stateNode;
        break;
      }
    }
  } else if (kids?._owner?.stateNode) {
    node = kids._owner.stateNode;
  }
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
