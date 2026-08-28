import type { CheatDef } from "../types";

export const towerOfDoomCheats: CheatDef[] = [
  {
    id: "doom-max-stats",
    label: "Max Stats",
    group: "Tower of Doom",
    kind: "action",
    description: "Maxes your card stats during attribute selection.",
    run(api) {
      const node = api.node();
      if (!node || node.state?.phase !== "select") return;
      const card = node.state.myCard ?? {};
      api.setState({ myCard: { ...card, strength: 20, charisma: 20, wisdom: 20 } });
    },
  },
  {
    id: "doom-coins",
    label: "Set Coins",
    group: "Tower of Doom",
    kind: "action",
    inputs: [{ name: "amount", label: "Coins", type: "number", defaultValue: "100000" }],
    description: "Sets your coins while in battle.",
    run(api, args) {
      if (window.location.pathname !== "/tower/battle") return;
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount)) return;
      api.node()?.props?.setTowerCoins?.(amount);
    },
  },
  {
    id: "doom-max-health",
    label: "Max Health",
    group: "Tower of Doom",
    kind: "action",
    description: "Restores your health while in battle.",
    run(api) {
      if (window.location.pathname !== "/tower/battle") return;
      api.setState({ myHealth: 100, myLife: 100 });
    },
  },
];
