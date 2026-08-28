import type { CheatDef } from "../types";
import { humanPause } from "../core/human";

const DINO_CHOICES: any[] = [
  { type: "fossil", val: 10, rate: 0.1, blook: "Amber" },
  { type: "fossil", val: 25, rate: 0.1, blook: "Dino Egg" },
  { type: "fossil", val: 50, rate: 0.175, blook: "Dino Fossil" },
  { type: "fossil", val: 75, rate: 0.175, blook: "Stegosaurus" },
  { type: "fossil", val: 100, rate: 0.15, blook: "Velociraptor" },
  { type: "fossil", val: 125, rate: 0.125, blook: "Brontosaurus" },
  { type: "fossil", val: 250, rate: 0.075, blook: "Triceratops" },
  { type: "fossil", val: 500, rate: 0.025, blook: "Tyrannosaurus Rex" },
  { type: "mult", val: 1.5, rate: 0.05 },
  { type: "mult", val: 2, rate: 0.025 },
];

function sampleChoices(count: number): any[] {
  const picked: any[] = [];
  while (picked.length < count) {
    const r = Math.random();
    let acc = 0;
    let found: any = null;
    for (const c of DINO_CHOICES) {
      acc += c.rate;
      if (r < acc) {
        found = c;
        break;
      }
    }
    if (found && !picked.includes(found)) picked.push(found);
  }
  return picked;
}

export const deceptiveDinosCheats: CheatDef[] = [
  {
    id: "dinos-fossils",
    label: "Set Fossils",
    group: "Deceptive Dinos",
    kind: "action",
    inputs: [{ name: "amount", label: "Fossils", type: "number", defaultValue: "100000" }],
    run(api, args) {
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount)) return;
      api.setState({ fossils: amount });
      api.setVal(`c/${api.client().name}/f`, amount);
    },
  },
  {
    id: "dinos-multiplier",
    label: "Set Multiplier",
    group: "Deceptive Dinos",
    kind: "action",
    inputs: [{ name: "amount", label: "Multiplier", type: "number", defaultValue: "10" }],
    run(api, args) {
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount)) return;
      api.setState({ fossilMult: amount });
    },
  },
  {
    id: "dinos-auto-choose",
    label: "Auto Choose",
    group: "Deceptive Dinos",
    kind: "toggle",
    description: "Picks the most valuable rock automatically.",
    run(api) {
      let busy = false;
      return api.interval(() => {
        if (busy) return;
        const node = api.node();
        if (!node || node.state?.stage !== "excavate") return;
        const s = node.state;
        if (!s.choices?.length) s.choices = sampleChoices(3);
        const fossils = s.fossils ?? 0;
        const mult = s.fossilMult ?? 1;
        let best = -1;
        let bestValue = -Infinity;
        (s.choices as any[]).forEach((c, i) => {
          const value = c.type === "fossil" ? fossils + c.val * mult : fossils * c.val;
          if (c.type === "mult" && value <= bestValue) return;
          if (value > bestValue) {
            bestValue = value;
            best = i + 1;
          }
        });
        busy = true;
        (async () => {
          try {
            await humanPause();
            if (node.state?.stage !== "excavate") return;
            (
              document.querySelector(
                `div[class*=rockRow] > div[role="button"]:nth-child(${best})`,
              ) as HTMLElement | null
            )?.click();
          } finally {
            busy = false;
          }
        })();
      }, 150);
    },
  },
  {
    id: "dinos-rock-esp",
    label: "Rock ESP",
    group: "Deceptive Dinos",
    kind: "action",
    description: "Shows the value of each rock.",
    run(api) {
      const node = api.node();
      if (!node) return;
      const s = node.state;
      const rocksEl = document.querySelector("[class*='rockButton']")
        ?.parentElement as HTMLElement | null;
      if (!rocksEl) return;
      if (!s.choices?.length) s.choices = sampleChoices(3);
      const mult = s.fossilMult ?? 1;
      Array.from(rocksEl.children).forEach((rock: any, i: number) => {
        const c = s.choices[i];
        if (!c) return;
        rock.querySelector?.("div")?.remove?.();
        const el = document.createElement("div");
        el.style.cssText =
          "color:#fff;font-family:Macondo,sans-serif;font-size:1em;display:flex;justify-content:center;transform:translateY(25px);";
        el.innerText =
          c.type === "fossil"
            ? `+${Math.round(c.val * mult)} Fossils`
            : `x${c.val} Fossils Per Excavation`;
        rock.append(el);
      });
    },
  },
];
