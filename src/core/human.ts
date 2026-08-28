import { getSettings } from "./settings";
import { submitTyping } from "./dom";

export function randomDelay(min: number, max: number): number {
  const lo = Math.max(0, min);
  const hi = Math.max(lo, max);
  return Math.round(lo + Math.random() * (hi - lo));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function humanPause(): Promise<void> {
  const s = getSettings();
  if (!s.delays) return Promise.resolve();
  return sleep(randomDelay(s.minDelay, s.maxDelay));
}

export function shouldMiss(accuracy: number): boolean {
  const acc = Math.max(0, Math.min(100, accuracy));
  return Math.random() * 100 > acc;
}

export async function typeAnswerHuman(answer: string): Promise<boolean> {
  const wrapper: any = document.querySelector("[class*='typingAnswerWrapper']");
  if (!wrapper) return submitTyping(answer);

  const node: any = (Object.values(wrapper) as any[])[1]?.children?._owner?.stateNode;
  const input = wrapper.querySelector("input, textarea") as HTMLInputElement | null;

  if (input) {
    const proto =
      input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    let value = "";
    for (const ch of answer) {
      value += ch;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(randomDelay(45, 130));
    }
  }

  if (typeof node?.sendAnswer === "function") {
    node.sendAnswer(answer);
    return true;
  }
  if (input) {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    return true;
  }
  return false;
}
