import type { CheatDef } from "../types";

const GLITCHES: Record<string, string> = {
  lb: "Lunch Break",
  as: "Ad Spam",
  e37: "Error 37",
  nt: "Night Time",
  lo: "#LOL",
  j: "Jokester",
  sm: "Slow Mo",
  dp: "Dance Party",
  v: "Vortex",
  r: "Reverse",
  f: "Flip",
  m: "Micro",
};

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
  {
    id: "factory-all-mega-bot",
    label: "All Mega Bots",
    group: "Factory",
    kind: "action",
    description: "Replaces every blook with a max-level Mega Bot.",
    run(api) {
      api.setState({
        blooks: Array.from({ length: 10 }, () => ({
          name: "Mega Bot",
          color: "#d71f27",
          class: "\u{1F916}",
          rarity: "Legendary",
          cash: [8e4, 43e4, 42e5, 62e6, 1e9],
          time: [5, 5, 3, 3, 3],
          price: [7e6, 12e7, 19e8, 35e9],
          active: false,
          level: 4,
          bonus: 5.5,
        })),
      });
    },
  },
  {
    id: "factory-remove-glitches",
    label: "Remove Glitches",
    group: "Factory",
    kind: "action",
    description: "Clears every active glitch and hazard.",
    run(api) {
      api.setState({
        bits: 0,
        ads: [],
        hazards: [],
        color: "",
        lol: false,
        joke: false,
        slow: false,
        dance: false,
        glitch: "",
        glitcherName: "",
        glitcherBlook: "",
      });
    },
  },
  {
    id: "factory-send-glitch",
    label: "Send Glitch",
    group: "Factory",
    kind: "action",
    description: "Sends a random glitch to another player through the game's own mechanic.",
    run(api) {
      const node = api.node();
      if (node) node.safe = true;
      const keys = Object.keys(GLITCHES);
      const val = keys[Math.floor(Math.random() * keys.length)];
      api.setVal(`c/${api.client().name}/tat`, val);
      api.log("Sent glitch: " + GLITCHES[val] + ".");
    },
  },
];
