import type { CheatDef } from "../types";

export const cryptoHackCheats: CheatDef[] = [
  {
    id: "crypto-set",
    label: "Set Crypto",
    group: "Crypto Hack",
    kind: "action",
    inputs: [{ name: "amount", label: "Crypto", type: "number", defaultValue: "100000" }],
    run(api, args) {
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount)) return;
      api.setState({ crypto: amount, crypto2: amount });
      api.setVal(`c/${api.client().name}/cr`, amount);
    },
  },
  {
    id: "crypto-auto-guess",
    label: "Auto Guess",
    group: "Crypto Hack",
    kind: "action",
    description: "Clicks the correct password during the hack stage.",
    run(api) {
      const node = api.node();
      if (node?.state?.stage !== "hack") return;
      const correct = node.state.correctPassword;
      const container = document.querySelector("div[class*=buttonContainer]");
      for (const button of Array.from(container?.children ?? [])) {
        const el = button as HTMLElement;
        if (el.innerText === correct) el.click();
      }
    },
  },
  {
    id: "crypto-password-esp",
    label: "Password ESP",
    group: "Crypto Hack",
    kind: "action",
    description: "Highlights wrong password choices in red.",
    run(api) {
      const node = api.node();
      if (node?.state?.stage !== "hack") return;
      const correct = node.state.correctPassword;
      const container = document.querySelector("div[class*=buttonContainer]");
      for (const button of Array.from(container?.children ?? [])) {
        const el = button as HTMLElement;
        if (el.innerText === correct) continue;
        el.style.outlineColor = "rgba(255, 64, 64, 0.8)";
        el.style.backgroundColor = "rgba(255, 64, 64, 0.8)";
        el.style.textShadow = "0 0 1px #f33";
      }
    },
  },
  {
    id: "crypto-choice-esp",
    label: "Choice ESP",
    group: "Crypto Hack",
    kind: "action",
    description: "Reveals the correct choice text.",
    run(api) {
      const node = api.node();
      const container = document.querySelector("[class*=feedbackContainer]") as HTMLElement | null;
      if (!container || container.children.length > 4) return;
      const text = node?.state?.choices?.[0]?.text;
      if (!text) return;
      const el = document.createElement("div");
      el.style.cssText =
        "color:#fff;font-family:Inconsolata,Helvetica,monospace,sans-serif;font-size:2em;display:flex;justify-content:center;margin-top:675px;";
      el.innerText = text;
      container.append(el);
    },
  },
];
