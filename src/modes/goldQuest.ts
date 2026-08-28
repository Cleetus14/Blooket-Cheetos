import type { CheatDef } from "../types";
import { humanPause } from "../core/human";

export const goldQuestCheats: CheatDef[] = [
  {
    id: "gold-set",
    label: "Set Gold",
    group: "Gold Quest",
    kind: "action",
    inputs: [{ name: "amount", label: "Gold", type: "number", defaultValue: "100000" }],
    run(api, args) {
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount)) return;
      api.setState({ gold: amount, gold2: amount });
      api.setVal(`c/${api.client().name}/g`, amount);
    },
  },
  {
    id: "gold-chest-esp",
    label: "Chest ESP",
    group: "Gold Quest",
    kind: "action",
    description: "Shows what is inside each chest.",
    run(api) {
      const node = api.node();
      const choices: any[] = node?.state?.choices ?? [];
      choices.forEach((choice, i) => {
        const chest = document.querySelector(`div[class*='choice${i + 1}']`) as HTMLElement | null;
        if (!chest || chest.querySelector("div")) return;
        const el = document.createElement("div");
        el.style.cssText =
          "color:#fff;font-family:Eczar,sans-serif;font-size:2em;display:flex;justify-content:center;transform:translateY(200px);";
        el.innerText = choice.text ?? "";
        chest.append(el);
      });
    },
  },
  {
    id: "gold-always-triple",
    label: "Always Triple",
    group: "Gold Quest",
    kind: "action",
    description: "Forces the next chosen chest to be a triple multiplier.",
    run(api) {
      const node = api.node();
      if (!node) return;
      if ((node.state?.gold ?? 0) === 0) api.setState({ gold: 100, gold2: 100 });
      if (!node.__choosePrize) node.__choosePrize = node.choosePrize;
      const triple = { type: "multiply", val: 3, text: "Triple Gold!", blook: "Unicorn" };
      node.choosePrize = function (i: number) {
        if (node.state?.choices) node.state.choices[i] = triple;
        node.__choosePrize(i);
      };
    },
  },
  {
    id: "gold-auto-choose",
    label: "Auto Choose",
    group: "Gold Quest",
    kind: "toggle",
    description: "Automatically picks the most valuable chest.",
    run(api) {
      let busy = false;
      return api.interval(() => {
        if (busy) return;
        const node = api.node();
        if (!node || node.state?.stage !== "prize") return;
        api.getVal("c", (players: any) => {
          if (!players || busy) return;
          let most = 0;
          for (const name of Object.keys(players)) {
            if (name === api.client().name) continue;
            most = Math.max(most, players[name]?.g ?? 0);
          }
          const gold = node.state?.gold ?? 0;
          const choices: any[] = node.state?.choices ?? [];
          let best = -1;
          let bestValue = -Infinity;
          choices.forEach((choice, i) => {
            let value = gold;
            if (choice.type === "gold") value = gold + (choice.val ?? 0);
            else if (choice.type === "multiply" || choice.type === "divide")
              value = Math.round(gold * (choice.val ?? 1));
            else if (choice.type === "swap") value = most;
            else if (choice.type === "take") value = gold + most * (choice.val ?? 0);
            if (value > bestValue) {
              bestValue = value;
              best = i + 1;
            }
          });
          busy = true;
          (async () => {
            try {
              await humanPause();
              if (node.state?.stage !== "prize") return;
              (document.querySelector(`div[class*='choice${best}']`) as HTMLElement | null)?.click();
            } finally {
              busy = false;
            }
          })();
        });
      }, 150);
    },
  },
  {
    id: "gold-swap",
    label: "Swap Gold",
    group: "Gold Quest",
    kind: "action",
    inputs: [{ name: "player", label: "Player", type: "text" }],
    description: "Swap your gold with another player (case sensitive).",
    run(api, args) {
      const target = (args.player ?? "").trim();
      if (!target) return;
      const node = api.node();
      if (!node) return;
      api.getVal("c", (players: any) => {
        if (!players || players[target] == null) return;
        const gold = players[target].g ?? 0;
        const client = api.client();
        api.setVal(`c/${client.name}`, {
          b: client.blook,
          tat: `${target}:swap:${node.state?.gold ?? 0}`,
          g: gold,
        });
        api.setState({ gold, gold2: gold });
      });
    },
  },
];
