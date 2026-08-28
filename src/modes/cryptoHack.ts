import type { CheatDef } from "../types";

export const cryptoHackCheats: CheatDef[] = [
  {
    id: "crypto-set",
    label: "Set Crypto",
    group: "Cyber Hack",
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
    id: "crypto-steal",
    label: "Steal Player's Crypto",
    group: "Cyber Hack",
    kind: "action",
    inputs: [{ name: "player", label: "Player", type: "text" }],
    description: "Takes all crypto from another player using the game's own steal protocol. Mess with them, not the server.",
    run(api, args) {
      const target = (args.player ?? "").trim();
      if (!target) {
        api.log("Enter a player name.");
        return;
      }
      api.getVal("c", (players: any) => {
        if (!players) return;
        const entry = Object.entries(players).find(
          (x) => (x[0] as string).toLowerCase() === target.toLowerCase(),
        );
        if (!entry) {
          api.log("Player not found: " + target);
          return;
        }
        const victimKey = entry[0];
        const cr = (entry[1] as any)?.cr ?? 0;
        if (cr <= 0) {
          api.log(victimKey + " has no crypto to steal.");
          return;
        }
        const node = api.node();
        const mine = (node?.state?.crypto ?? 0) + cr;
        api.setState({ crypto: mine, crypto2: mine });
        api.setVal(`c/${api.client().name}`, {
          b: api.client().blook,
          p: node?.state?.password ?? "",
          cr: mine,
          tat: victimKey + ":" + cr,
        });
        api.log("Stole " + cr + " crypto from " + victimKey + ".");
      });
    },
  },
  {
    id: "crypto-set-password",
    label: "Set Password",
    group: "Cyber Hack",
    kind: "action",
    inputs: [{ name: "password", label: "Password", type: "text", defaultValue: "Cheetos" }],
    description: "Sets your hack password so you always know it.",
    run(api, args) {
      const password = (args.password ?? "").trim();
      if (!password) return;
      api.setState({ password });
    },
  },
  {
    id: "crypto-remove-hack",
    label: "Remove Hack",
    group: "Cyber Hack",
    kind: "action",
    description: "Clears the current hack so nobody can crack your password.",
    run(api) {
      api.setState({ hack: "" });
    },
  },
  {
    id: "crypto-always-triple",
    label: "Always Triple",
    group: "Cyber Hack",
    kind: "toggle",
    description: "Forces the multiplier choice to always be Triple Crypto.",
    run(api) {
      return api.interval(() => {
        const node = api.node();
        if (!node) return;
        api.setState({
          choices: [{ type: "mult", val: 3, rate: 0.075, blook: "Brainy Bot", text: "Triple Crypto" }],
        });
      }, 300);
    },
  },
  {
    id: "crypto-auto-guess",
    label: "Auto Guess",
    group: "Cyber Hack",
    kind: "toggle",
    description: "Automatically clicks the correct password during the hack stage.",
    run(api) {
      return api.interval(() => {
        const node = api.node();
        if (node?.state?.stage !== "hack") return;
        const correct = node.state.correctPassword;
        const container = document.querySelector("div[class*=buttonContainer]");
        for (const button of Array.from(container?.children ?? [])) {
          const el = button as HTMLElement;
          if (el.innerText === correct) {
            el.click();
            return;
          }
        }
      }, 150);
    },
  },
  {
    id: "crypto-password-esp",
    label: "Password ESP",
    group: "Cyber Hack",
    kind: "toggle",
    description: "Highlights wrong password choices in red.",
    run(api) {
      return api.interval(() => {
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
      }, 200);
    },
  },
  {
    id: "crypto-choice-esp",
    label: "Choice ESP",
    group: "Cyber Hack",
    kind: "toggle",
    description: "Reveals the correct choice text.",
    run(api) {
      return api.interval(() => {
        const node = api.node();
        const container = document.querySelector("[class*=feedbackContainer]") as HTMLElement | null;
        if (!container || container.children.length > 4) return;
        const text = node?.state?.choices?.[0]?.text;
        if (!text) return;
        let el = container.querySelector(".cheetos-choice-esp") as HTMLElement | null;
        if (!el) {
          el = document.createElement("div");
          el.className = "cheetos-choice-esp";
          el.style.cssText =
            "color:#fff;font-family:Inconsolata,Helvetica,monospace,sans-serif;font-size:2em;display:flex;justify-content:center;margin-top:675px;";
          container.append(el);
        }
        el.innerText = text;
      }, 200);
    },
  },
  {
    id: "crypto-steal-all",
    label: "Steal All Crypto",
    group: "Cyber Hack",
    kind: "action",
    warn: true,
    description: "Steals every other player's crypto at once. Overpowered - use carefully.",
    run(api) {
      if (!api.node()) {
        api.log("Game state not found yet. Wait for the game to load, then run again.");
        return;
      }
      api.getVal("c", (players: any) => {
        if (!players) return;
        const me = api.client().name;
        const node = api.node();
        const others = Object.entries(players).filter(([k]) => k !== me);
        let total = 0;
        for (const [, v] of others) total += (v as any)?.cr ?? 0;
        const mine = (node?.state?.crypto ?? 0) + total;
        api.setState({ crypto: mine, crypto2: mine });
        let sent = 0;
        others.forEach(([name, v], i) => {
          const cr = (v as any)?.cr ?? 0;
          if (cr <= 0) return;
          sent++;
          setTimeout(() => {
            api.setVal(`c/${me}`, {
              b: api.client().blook,
              p: node?.state?.password ?? "",
              cr: mine,
              tat: name + ":" + cr,
            });
          }, i * 150);
        });
        api.log("Stole " + total + " crypto from " + sent + " players.");
      });
    },
  },
  {
    id: "crypto-reset-all",
    label: "Reset All Crypto",
    group: "Cyber Hack",
    kind: "action",
    warn: true,
    description: "Zeroes every other player's crypto.",
    run(api) {
      if (!api.node()) {
        api.log("Game state not found yet. Wait for the game to load, then run again.");
        return;
      }
      api.getVal("c", (players: any) => {
        if (!players) return;
        const me = api.client().name;
        const node = api.node();
        const others = Object.entries(players).filter(([k]) => k !== me);
        let sent = 0;
        others.forEach(([name, v], i) => {
          const cr = (v as any)?.cr ?? 0;
          if (cr <= 0) return;
          sent++;
          setTimeout(() => {
            api.setVal(`c/${me}`, {
              b: api.client().blook,
              p: node?.state?.password ?? "",
              cr: node?.state?.crypto ?? 0,
              tat: name + ":0",
            });
          }, i * 150);
        });
        api.log("Reset crypto for " + sent + " players.");
      });
    },
  },
  {
    id: "crypto-set-player",
    label: "Set Player Crypto",
    group: "Cyber Hack",
    kind: "action",
    inputs: [
      { name: "player", label: "Player", type: "text" },
      { name: "amount", label: "Crypto", type: "number", defaultValue: "0" },
    ],
    description: "Sets another player's crypto to a specific amount.",
    run(api, args) {
      const target = (args.player ?? "").trim();
      const amount = parseInt(args.amount, 10);
      if (!target || !Number.isFinite(amount) || amount < 0) {
        api.log("Enter a player name and a non-negative amount.");
        return;
      }
      if (!api.node()) {
        api.log("Game state not found yet. Wait for the game to load, then run again.");
        return;
      }
      api.getVal("c", (players: any) => {
        if (!players) return;
        const entry = Object.entries(players).find(
          (x) => (x[0] as string).toLowerCase() === target.toLowerCase(),
        );
        if (!entry) {
          api.log("Player not found: " + target);
          return;
        }
        const node = api.node();
        api.setVal(`c/${api.client().name}`, {
          b: api.client().blook,
          p: node?.state?.password ?? "",
          cr: node?.state?.crypto ?? 0,
          tat: entry[0] + ":" + amount,
        });
        api.log("Set " + entry[0] + "'s crypto to " + amount + ".");
      });
    },
  },
];
