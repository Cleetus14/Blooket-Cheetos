import type { CheatDef } from "../types";

const DISTRACTIONS: Record<string, string> = {
  c: "Oh Canada",
  b: "Blizzard",
  f: "Fog Spell",
  d: "Dark & Dusk",
  w: "Howling Wind",
  g: "Gift Time!",
  t: "TREES",
  s: "Snow Plow",
  fr: "Use The Force",
};

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
    id: "workshop-toys-per-q",
    label: "Set Toys Per Question",
    group: "Santa's Workshop",
    kind: "action",
    inputs: [{ name: "amount", label: "Toys per question", type: "number", defaultValue: "100" }],
    run(api, args) {
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount)) return;
      api.setState({ toysPerQ: amount });
    },
  },
  {
    id: "workshop-send-distraction",
    label: "Send Distraction",
    group: "Santa's Workshop",
    kind: "action",
    description: "Sends a random distraction to another player through the game's own mechanic.",
    run(api) {
      const node = api.node();
      if (node) node.safe = true;
      const keys = Object.keys(DISTRACTIONS);
      const val = keys[Math.floor(Math.random() * keys.length)];
      api.setVal(`c/${api.client().name}/tat`, val);
      api.log("Sent distraction: " + DISTRACTIONS[val] + ".");
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
