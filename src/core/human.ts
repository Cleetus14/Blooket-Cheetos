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

let lastVisualSig = "";

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
