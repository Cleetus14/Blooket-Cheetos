import type { CheatDef } from "../types";

export const towerDefenseCheats: CheatDef[] = [
  {
    id: "td-tokens",
    label: "Set Tokens",
    group: "Tower Defense",
    kind: "action",
    inputs: [{ name: "amount", label: "Tokens", type: "number", defaultValue: "100000" }],
    run(api, args) {
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount)) return;
      api.setState({ tokens: amount });
    },
  },
  {
    id: "td-damage",
    label: "Set Damage",
    group: "Tower Defense",
    kind: "action",
    inputs: [{ name: "amount", label: "Damage", type: "number", defaultValue: "100000" }],
    run(api, args) {
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount)) return;
      const node = api.node();
      if (node) node.dmg = amount;
    },
  },
  {
    id: "td-max-towers",
    label: "Max Towers",
    group: "Tower Defense",
    kind: "action",
    description: "Maxes range, damage, and cooldown on every tower.",
    run(api) {
      const towers = api.node()?.towers;
      if (!Array.isArray(towers)) return;
      towers.forEach((tower: any) => {
        tower.range = 100;
        tower.fullCd = 0;
        tower.cd = 0;
        tower.damage = 1e6;
      });
    },
  },
  {
    id: "td-round",
    label: "Set Round",
    group: "Tower Defense",
    kind: "action",
    inputs: [{ name: "round", label: "Round", type: "number", defaultValue: "1" }],
    run(api, args) {
      const round = parseInt(args.round, 10);
      if (!Number.isFinite(round)) return;
      api.setState({ round });
    },
  },
  {
    id: "td-remove-enemies",
    label: "Remove Enemies",
    group: "Tower Defense",
    kind: "action",
    description: "Clears every enemy on the board.",
    run(api) {
      const node = api.node();
      if (!node) return;
      node.enemies = node.futureEnemies = [];
    },
  },
  {
    id: "td-remove-ducks",
    label: "Remove Ducks",
    group: "Tower Defense",
    kind: "action",
    description: "Removes all ducks and frees their tiles.",
    run(api) {
      const node = api.node();
      const ducks = node?.ducks;
      const tiles = node?.tiles;
      if (!Array.isArray(ducks) || !Array.isArray(tiles)) return;
      ducks.forEach((x: any) => {
        if (tiles[x.y]) tiles[x.y][x.x] = 0;
      });
      ducks.length = 0;
    },
  },
  {
    id: "td-remove-obstacles",
    label: "Remove Obstacles",
    group: "Tower Defense",
    kind: "action",
    description: "Clears every obstacle tile.",
    run(api) {
      const node = api.node();
      if (!Array.isArray(node?.tiles)) return;
      node.tiles = node.tiles.map((row: any[]) => row.fill(0));
    },
  },
];
