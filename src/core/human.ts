import { getSettings } from "./settings";
import { submitTyping, typingStateNode } from "./dom";

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

// Humanized typing answer: fills the input visually when one exists, then
// ALWAYS submits through the game's own sendAnswer stateNode (the reference
// approach), so the answer lands even if the visual typing is imperfect.
// Falls back to the plain typing submitter when no wrapper/stateNode exists.
export async function typeAnswerHuman(answer: string): Promise<boolean> {
  const wrapper: any = document.querySelector("[class*='typingAnswerWrapper']");
  if (wrapper) {
    const node = typingStateNode(wrapper);
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
  }
  return submitTyping(answer);
}
