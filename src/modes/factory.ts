import type { CheatDef } from "../types";

export const factoryCheats: CheatDef[] = [
  {
    id: "factory-cash",
    label: "Set Cash",
    group: "Factory",
    kind: "action",
    inputs: [{ name: "amount", label: "Cash", type: "number", defaultValue: "100000" }],
    run(api, args) {
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount)) return;
      api.setState({ cash: amount });
    },
  },
  {
    id: "factory-max-blooks",
    label: "Max Blooks",
    group: "Factory",
    kind: "action",
    description: "Sets every blook to max level.",
    run(api) {
      const blooks = api.state().blooks;
      if (!Array.isArray(blooks)) return;
      blooks.forEach((blook: any) => {
        blook.level = 4;
      });
    },
  },
  {
    id: "factory-free-upgrades",
    label: "Free Upgrades",
    group: "Factory",
    kind: "action",
    description: "Makes all blook upgrades cost zero.",
    run(api) {
      const blooks = api.state().blooks;
      if (!Array.isArray(blooks)) return;
      api.setState({
        blooks: blooks.map((blook: any) => {
          blook.price = [0, 0, 0, 0];
          return blook;
        }),
      });
    },
  },
];
