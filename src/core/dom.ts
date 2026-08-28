import type { Question } from "../types";
import { allDocuments, gameDocument, findInstanceWithMethod } from "./state";

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
  const nodes = doc().querySelectorAll("[class*='answerContainer']");
  const el = nodes[index] as HTMLElement | undefined;
  if (el) {
    el.click();
    return true;
  }
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
  const inputs = Array.from(doc().querySelectorAll("input[type='text'], input:not([type]), textarea")) as HTMLInputElement[];
  for (const el of inputs) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function typingStateNode(wrapper: any): any {
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
  if (!node) node = findInstanceWithMethod("sendAnswer");
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
