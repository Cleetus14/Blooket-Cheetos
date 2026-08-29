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

function isClickable(el: Element): boolean {
  if (el.tagName === "BUTTON") return true;
  if (typeof el.getAttribute === "function" && el.getAttribute("role") === "button") return true;
  try {
    if (getComputedStyle(el).cursor === "pointer") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function correctIndex(question: Question): number {
  for (let i = 0; i < question.answers.length; i++) {
    for (let j = 0; j < question.correctAnswers.length; j++) {
      if (question.answers[i] === question.correctAnswers[j]) return i;
    }
  }
  return -1;
}

export function answerElementByText(text: string): HTMLElement | null {
  if (!text) return null;
  const needle = text.trim().toLowerCase();
  const els = Array.from(
    doc().querySelectorAll("div,button,span,p,[role='button']"),
  ) as HTMLElement[];
  const exact: HTMLElement[] = [];
  for (const el of els) {
    if (textMatches(el, text)) exact.push(el);
  }
  if (exact.length) {
    for (const el of exact) if (isClickable(el)) return el;
    return exact[exact.length - 1];
  }
  for (const el of els) {
    const t = (el.textContent ?? "").trim().toLowerCase();
    if (!t || t.length > 120 || !t.includes(needle)) continue;
    if (isClickable(el)) return el;
  }
  return null;
}

export function answerTextOnScreen(text: string): boolean {
  return !!answerElementByText(text);
}

export function clickAnswerText(text: string): boolean {
  const el = answerElementByText(text);
  if (el) {
    el.click();
    return true;
  }
  return false;
}

function findAnswerByText(text: string): HTMLElement | null {
  return answerElementByText(text);
}

export function clickAnswer(question: Question, index: number): boolean {
  const answer = question.answers[index];
  if (answer && clickAnswerText(answer)) return true;
  const nodes = doc().querySelectorAll("[class*='answerContainer']");
  const el = nodes[index] as HTMLElement | undefined;
  if (el) {
    el.click();
    return true;
  }
  if (answer) {
    const byText = findAnswerByText(answer);
    if (byText) {
      byText.click();
      return true;
    }
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
  const idx = correctIndex(question);
  if (idx >= 0) {
    const text = question.answers[idx];
    if (text && clickAnswerText(text)) return true;
  }
  for (const answer of question.correctAnswers) {
    if (clickAnswerText(answer)) return true;
  }
  const nodes = doc().querySelectorAll("[class*='answerContainer']");
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

export function clickCorrectAnswer(question: Question): boolean {
  const idx = correctIndex(question);
  const text = idx >= 0 ? question.answers[idx] : question.correctAnswers[0];
  if (text && clickAnswerText(text)) return true;
  if (idx >= 0 && clickAnswerContainerAt(idx, text)) return true;
  return false;
}

export function clickFeedbackAdvance(): boolean {
  return advanceFeedback();
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
