import type { CheatDef } from "../types";

const FISH = [
  "Crab",
  "Jellyfish",
  "Frog",
  "Pufferfish",
  "Octopus",
  "Narwhal",
  "Megalodon",
  "Blobfish",
  "Baby Shark",
];

export const fishingFrenzyCheats: CheatDef[] = [
  {
    id: "fishing-weight",
    label: "Set Weight",
    group: "Fishing Frenzy",
    kind: "action",
    inputs: [{ name: "weight", label: "Weight", type: "number", defaultValue: "100000" }],
    run(api, args) {
      const weight = parseInt(args.weight, 10);
      if (!Number.isFinite(weight)) return;
      api.setState({ weight, weight2: weight });
      const client = api.client();
      api.setVal(`c/${client.name}`, {
        b: client.blook,
        w: weight,
        f: FISH[Math.floor(Math.random() * FISH.length)],
      });
    },
  },
  {
    id: "fishing-frenzy",
    label: "Frenzy",
    group: "Fishing Frenzy",
    kind: "action",
    description: "Triggers a frenzy catch.",
    run(api) {
      const node = api.node();
      const client = api.client();
      api.setVal(`c/${client.name}`, {
        b: client.blook,
        w: node?.state?.weight ?? 0,
        f: "Frenzy",
        s: true,
      });
    },
  },
  {
    id: "fishing-lure",
    label: "Set Lure",
    group: "Fishing Frenzy",
    kind: "action",
    inputs: [{ name: "lure", label: "Lure (1-5)", type: "number", defaultValue: "5" }],
    run(api, args) {
      const raw = parseInt(args.lure, 10);
      if (!Number.isFinite(raw)) return;
      api.setState({ lure: Math.max(0, Math.min(raw - 1, 4)) });
    },
  },
];
