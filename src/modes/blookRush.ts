import type { CheatDef } from "../types";

export const blookRushCheats: CheatDef[] = [
  {
    id: "rush-defense",
    label: "Set Defense",
    group: "Blook Rush",
    kind: "action",
    inputs: [{ name: "amount", label: "Defense (0-4)", type: "number", defaultValue: "4" }],
    run(api, args) {
      const raw = parseInt(args.amount, 10);
      if (!Number.isFinite(raw)) return;
      const amount = Math.max(0, Math.min(raw, 4));
      const node = api.node();
      api.setState({ numDefense: amount });
      api.setVal(`${node?.isTeam ? "a/" : "c/"}${api.client().name}/d`, amount);
    },
  },
  {
    id: "rush-blooks",
    label: "Set Blooks",
    group: "Blook Rush",
    kind: "action",
    inputs: [{ name: "amount", label: "Blooks", type: "number", defaultValue: "100" }],
    run(api, args) {
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount)) return;
      const node = api.node();
      api.setState({ numBlooks: amount });
      api.setVal(`${node?.isTeam ? "a/" : "c/"}${api.client().name}/bs`, amount);
    },
  },
];
