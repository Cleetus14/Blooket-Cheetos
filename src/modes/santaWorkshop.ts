import type { CheatDef } from "../types";

export const santaWorkshopCheats: CheatDef[] = [
  {
    id: "workshop-toys",
    label: "Set Toys",
    group: "Santa's Workshop",
    kind: "action",
    inputs: [{ name: "amount", label: "Toys", type: "number", defaultValue: "100000" }],
    run(api, args) {
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount)) return;
      api.setState({ toys: amount });
      api.setVal(`c/${api.client().name}/t`, amount);
    },
  },
  {
    id: "workshop-clear",
    label: "Remove Distractions",
    group: "Santa's Workshop",
    kind: "action",
    description: "Clears weather and tree obstacles.",
    run(api) {
      api.setState({
        fog: false,
        dusk: false,
        wind: false,
        plow: false,
        blizzard: false,
        force: false,
        canada: false,
        trees: [false, false, false, false, false, false, false, false, false, false],
      });
    },
  },
  {
    id: "workshop-swap-toys",
    label: "Swap Toys",
    group: "Santa's Workshop",
    kind: "action",
    description: "Opens the swap menu to take another player's toys.",
    run(api) {
      const node = api.node();
      if (!node) return;
      api.getVal("c", (val: any) => {
        if (!val) return;
        const me = api.client().name;
        const players: any[] = [];
        for (const name of Object.keys(val)) {
          if (name === me) continue;
          players.push({ name, blook: val[name].b, toys: val[name].t ?? 0 });
        }
        api.setState({
          choosingPlayer: false,
          players,
          phaseTwo: true,
          stage: "prize",
          choiceObj: { type: "swap" },
        });
        setTimeout(() => api.setState({ choosingPlayer: true }), 300);
      });
    },
  },
];
