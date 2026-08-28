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

let lastVisualSig = "";

// Humanized typing answer: the real submission is ALWAYS the game's own
// sendAnswer (reference-exact, instant), so the answer lands every time. The
// character-by-character input fill is purely cosmetic and never gates or
// delays the submission.
export async function typeAnswerHuman(answer: string): Promise<boolean> {
  const s = getSettings();
  const wrapper: any = document.querySelector("[class*='typingAnswerWrapper']");
  const node = wrapper ? typingStateNode(wrapper) : null;
  if (typeof node?.sendAnswer === "function") {
    node.sendAnswer(answer);
    if (s.typing && wrapper && lastVisualSig !== answer) {
      lastVisualSig = answer;
      const input = wrapper.querySelector("input, textarea") as HTMLInputElement | null;
      if (input) {
        void (async () => {
          const proto =
            input.tagName === "TEXTAREA"
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          let value = "";
          for (const ch of answer) {
            value += ch;
            setter?.call(input, value);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            await sleep(randomDelay(25, 60));
          }
        })();
      }
    }
    return true;
  }
  return submitTyping(answer);
}
