import type { CheatDef } from "../types";
import { humanPause } from "../core/human";

function findPlayer(players: Record<string, any>, name: string): [string, any] | null {
  const key = Object.keys(players).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? [key, players[key]] : null;
}

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
    id: "gold-set-player",
    label: "Set Player Gold",
    group: "Gold Quest",
    kind: "action",
    inputs: [
      { name: "player", label: "Player", type: "text" },
      { name: "amount", label: "Gold", type: "number", defaultValue: "1000" },
    ],
    description: "Sets another player's gold (case insensitive).",
    run(api, args) {
      const target = (args.player ?? "").trim();
      const amount = parseInt(args.amount, 10);
      if (!target || !Number.isFinite(amount)) return;
      api.setVal(`c/${api.client().name}/tat`, `${target}:swap:${amount}`);
    },
  },
  {
    id: "gold-reset-player",
    label: "Reset Player Gold",
    group: "Gold Quest",
    kind: "action",
    inputs: [{ name: "player", label: "Player", type: "text" }],
    description: "Resets another player's gold to 0.",
    run(api, args) {
      const target = (args.player ?? "").trim();
      if (!target) return;
      api.setVal(`c/${api.client().name}/tat`, `${target}:swap:0`);
    },
  },
  {
    id: "gold-reset-all",
    label: "Reset All Gold",
    group: "Gold Quest",
    kind: "action",
    description: "Resets every player's gold to 0 (best-effort).",
    run(api) {
      api.getVal("c", (players: any) => {
        if (!players) return;
        const me = api.client().name;
        const others = Object.keys(players).filter((n) => n !== me);
        api.setState({ gold: 0, gold2: 0 });
        api.setVal(`c/${me}/g`, 0);
        others.forEach((name, i) => {
          setTimeout(() => api.setVal(`c/${me}/tat`, `${name}:swap:0`), i * 150);
        });
      });
    },
  },
  {
    id: "gold-silent-steal",
    label: "Silent Steal Gold",
    group: "Gold Quest",
    kind: "action",
    inputs: [
      { name: "player", label: "Player", type: "text" },
      { name: "amount", label: "Amount", type: "number", defaultValue: "500" },
    ],
    description: "Steals gold through the game's own swap protocol so it always confirms. The target sees the same steal notice a real Steal chest gives.",
    run(api, args) {
      const target = (args.player ?? "").trim();
      const amount = parseInt(args.amount, 10);
      if (!target || !Number.isFinite(amount) || amount <= 0) {
        api.log("Enter a player name and a positive amount.");
        return;
      }
      api.getVal("c", (players: any) => {
        if (!players) return;
        const found = findPlayer(players, target);
        if (!found) {
          api.log("Player not found: " + target);
          return;
        }
        const victimKey = found[0];
        const victimGold = found[1]?.g ?? 0;
        if (victimGold <= 0) {
          api.log(found[0] + " has no gold to steal.");
          return;
        }
        const steal = Math.min(amount, victimGold);
        const me = api.client().name;
        const myGold = players[me]?.g ?? api.node()?.state?.gold ?? 0;
        const newGold = myGold + steal;
        api.setVal(`c/${me}`, {
          b: api.client().blook,
          tat: `${victimKey}:swap:${victimGold - steal}`,
          g: newGold,
        });
        api.setState({ gold: newGold, gold2: newGold });
        api.log("Stole " + steal + " gold from " + victimKey + ".");
      });
    },
  },
  {
    id: "gold-silent-reset",
    label: "Silent Reset Gold",
    group: "Gold Quest",
    kind: "action",
    inputs: [{ name: "player", label: "Player", type: "text" }],
    description: "Zeroes the target's gold using the game's own swap protocol so it always confirms. Their counter will show 0 (a real reset can't be hidden).",
    run(api, args) {
      const target = (args.player ?? "").trim();
      if (!target) {
        api.log("Enter a player name.");
        return;
      }
      api.getVal("c", (players: any) => {
        if (!players) return;
        const found = findPlayer(players, target);
        if (!found) {
          api.log("Player not found: " + target);
          return;
        }
        api.setVal(`c/${api.client().name}/tat`, `${found[0]}:swap:0`);
        api.log("Reset " + found[0] + "'s gold to 0.");
      });
    },
  },
  {
    id: "gold-ruin",
    label: "Ruin Chests",
    group: "Gold Quest",
    kind: "toggle",
    inputs: [{ name: "player", label: "Player", type: "text" }],
    description: "The target's chests keep coming up bad: Lose 50%, Lose 25%, or Nothing, on a loop.",
    run(api, args) {
      let busy = false;
      return api.interval(() => {
        if (busy) return;
        const target = (args.player ?? "").trim();
        if (!target) return;
        busy = true;
        api.getVal("c", (players: any) => {
          try {
            if (!players) return;
            const found = findPlayer(players, target);
            if (!found) return;
            const gold = found[1]?.g ?? 0;
            if (gold <= 0) return;
            const roll = Math.random();
            if (roll < 0.4) {
              const halved = Math.floor(gold / 2);
              api.setVal(`c/${api.client().name}/tat`, `${found[0]}:swap:${halved}`);
              api.log(found[0] + " chest: Lose 50% (" + gold + " -> " + halved + ").");
            } else if (roll < 0.8) {
              const kept = Math.floor(gold * 0.75);
              api.setVal(`c/${api.client().name}/tat`, `${found[0]}:swap:${kept}`);
              api.log(found[0] + " chest: Lose 25% (" + gold + " -> " + kept + ").");
            } else {
              api.log(found[0] + " chest: Nothing.");
            }
          } finally {
            busy = false;
          }
        });
      }, 2500);
    },
  },
  {
    id: "gold-chest-esp",
    label: "Chest ESP",
    group: "Gold Quest",
    kind: "toggle",
    description: "Shows what is inside each chest.",
    run(api) {
      return api.interval(() => {
        const node = api.node();
        const choices: any[] = node?.state?.choices ?? [];
        choices.forEach((choice, i) => {
          const chest = document.querySelector(`div[class*='choice${i + 1}']`) as HTMLElement | null;
          if (!chest) return;
          let el = chest.querySelector(".cheetos-chest-esp") as HTMLElement | null;
          if (!el) {
            el = document.createElement("div");
            el.className = "cheetos-chest-esp";
            el.style.cssText =
              "color:#fff;font-family:Eczar,sans-serif;font-size:2em;display:flex;justify-content:center;transform:translateY(200px);";
            chest.append(el);
          }
          el.innerText = choice.text ?? "";
        });
      }, 300);
    },
  },
  {
    id: "gold-always-triple",
    label: "Always Triple",
    group: "Gold Quest",
    kind: "toggle",
    description: "Forces every chosen chest to be a triple multiplier.",
    run(api) {
      let patchedNode: any = null;
      let original: any = null;
      const triple = { type: "multiply", val: 3, text: "Triple Gold!", blook: "Unicorn" };
      const handle = api.interval(() => {
        if (patchedNode) return;
        const node = api.node();
        if (!node || typeof node.choosePrize !== "function") return;
        if ((node.state?.gold ?? 0) === 0) api.setState({ gold: 100, gold2: 100 });
        original = node.choosePrize;
        patchedNode = node;
        node.choosePrize = function (i: number) {
          if (node.state?.choices) node.state.choices[i] = triple;
          original.call(node, i);
        };
      }, 250);
      return {
        running: () => handle.running(),
        stop() {
          handle.stop();
          if (patchedNode && original) patchedNode.choosePrize = original;
        },
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
  {
    id: "gold-steal-all",
    label: "Steal All Gold",
    group: "Gold Quest",
    kind: "action",
    inputs: [{ name: "amount", label: "Amount per player", type: "number", defaultValue: "250" }],
    description: "Steals a set amount from every other player at once through the swap protocol. Overpowered, use carefully.",
    run(api, args) {
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount) || amount <= 0) {
        api.log("Enter a positive amount.");
        return;
      }
      api.getVal("c", (players: any) => {
        if (!players) return;
        const me = api.client().name;
        const others = Object.keys(players).filter((n) => n !== me);
        if (!others.length) {
          api.log("No other players found.");
          return;
        }
        let stolen = 0;
        const myGold = players[me]?.g ?? api.node()?.state?.gold ?? 0;
        others.forEach((name, i) => {
          const victimGold = players[name]?.g ?? 0;
          if (victimGold <= 0) return;
          const take = Math.min(amount, victimGold);
          stolen += take;
          setTimeout(() => {
            api.setVal(`c/${me}`, {
              b: api.client().blook,
              tat: `${name}:swap:${victimGold - take}`,
              g: myGold + stolen,
            });
          }, i * 120);
        });
        api.setState({ gold: myGold + stolen, gold2: myGold + stolen });
        api.log("Stole " + stolen + " gold total from " + others.length + " players.");
      });
    },
  },
  {
    id: "gold-no-bad-chests",
    label: "No Bad Chests",
    group: "Gold Quest",
    kind: "toggle",
    description: "Removes Lose 50% / Lose 25% / Nothing chests so every chest is a gain.",
    run(api) {
      return api.interval(() => {
        const node = api.node();
        const choices: any[] = node?.state?.choices ?? [];
        if (!choices.length || node?.state?.stage !== "prize") return;
        for (let i = choices.length - 1; i >= 0; i--) {
          const c = choices[i];
          if (c.type === "divide" || c.type === "nothing") choices.splice(i, 1);
        }
        if (choices.length && choices.length < 3) {
          api.setState({ choices });
        }
      }, 150);
    },
  },
  {
    id: "gold-auto-steal",
    label: "Auto Steal Richest",
    group: "Gold Quest",
    kind: "toggle",
    inputs: [{ name: "percent", label: "Steal %", type: "number", defaultValue: "25" }],
    description: "Every few seconds steals a percentage of the richest other player's gold. Overpowered - use carefully.",
    run(api, args) {
      const percent = Math.max(1, Math.min(parseInt(args.percent, 10) || 25, 100));
      let busy = false;
      return api.interval(() => {
        if (busy) return;
        if (!api.node()) return;
        busy = true;
        api.getVal("c", (players: any) => {
          try {
            if (!players) return;
            const me = api.client().name;
            if (!me) return;
            let richestKey: string | null = null;
            let richestGold = -1;
            for (const name of Object.keys(players)) {
              if (name === me) continue;
              const g = players[name]?.g ?? 0;
              if (g > richestGold) {
                richestGold = g;
                richestKey = name;
              }
            }
            if (!richestKey || richestGold <= 0) return;
            const steal = Math.max(1, Math.min(Math.floor((richestGold * percent) / 100), richestGold));
            const myGold = (players[me]?.g ?? api.node()?.state?.gold ?? 0) + steal;
            api.setVal(`c/${me}`, {
              b: api.client().blook,
              tat: `${richestKey}:swap:${richestGold - steal}`,
              g: myGold,
            });
            api.setState({ gold: myGold, gold2: myGold });
            api.log("Auto-stole " + steal + " gold from " + richestKey + ".");
          } finally {
            busy = false;
          }
        });
      }, 2500);
    },
  },
  {
    id: "gold-randomize-all",
    label: "Randomize All Gold",
    group: "Gold Quest",
    kind: "action",
    warn: true,
    description: "Sets every player's gold to a random amount. Total chaos.",
    run(api) {
      if (!api.node()) {
        api.log("Game state not found yet. Wait for the game to load, then run again.");
        return;
      }
      api.getVal("c", (players: any) => {
        if (!players) return;
        const me = api.client().name;
        const others = Object.keys(players).filter((n) => n !== me);
        const mine = Math.floor(Math.random() * 5000);
        api.setState({ gold: mine, gold2: mine });
        api.setVal(`c/${me}/g`, mine);
        others.forEach((name, i) => {
          const amount = Math.floor(Math.random() * 5000);
          setTimeout(() => api.setVal(`c/${me}/tat`, `${name}:swap:${amount}`), i * 120);
        });
        api.log("Randomized gold for " + others.length + " players.");
      });
    },
  },
  {
    id: "gold-give-all",
    label: "Give Everyone Gold",
    group: "Gold Quest",
    kind: "action",
    inputs: [{ name: "amount", label: "Gold", type: "number", defaultValue: "1000" }],
    description: "Sets every player's gold to the same amount.",
    run(api, args) {
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount) || amount < 0) {
        api.log("Enter a valid amount.");
        return;
      }
      if (!api.node()) {
        api.log("Game state not found yet. Wait for the game to load, then run again.");
        return;
      }
      api.getVal("c", (players: any) => {
        if (!players) return;
        const me = api.client().name;
        api.setState({ gold: amount, gold2: amount });
        api.setVal(`c/${me}/g`, amount);
        const others = Object.keys(players).filter((n) => n !== me);
        others.forEach((name, i) => {
          setTimeout(() => api.setVal(`c/${me}/tat`, `${name}:swap:${amount}`), i * 120);
        });
        api.log("Set everyone to " + amount + " gold.");
      });
    },
  },
  {
    id: "gold-kick",
    label: "Kick Player",
    group: "Gold Quest",
    kind: "action",
    warn: true,
    inputs: [{ name: "player", label: "Player", type: "text" }],
    description: "Removes a player from the match by deleting their game node (experimental).",
    run(api, args) {
      const target = (args.player ?? "").trim();
      if (!target) {
        api.log("Enter a player name.");
        return;
      }
      if (!api.node()) {
        api.log("Game state not found yet. Wait for the game to load, then run again.");
        return;
      }
      api.getVal("c", (players: any) => {
        if (!players) return;
        const found = findPlayer(players, target);
        if (!found) {
          api.log("Player not found: " + target);
          return;
        }
        api.setVal(`c/${found[0]}`, null);
        api.log("Kicked " + found[0] + " from the match.");
      });
    },
  },
];
