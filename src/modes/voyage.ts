import type { CheatDef } from "../types";

function findDoubloonsPlayer(
  players: Record<string, any>,
  name: string,
): [string, number] | null {
  const key = Object.keys(players).find((k) => k.toLowerCase() === name.toLowerCase());
  if (!key) return null;
  return [key, players[key]?.d ?? 0];
}

function otherPlayers(players: Record<string, any>, me: string): Array<[string, number]> {
  return Object.keys(players)
    .filter((n) => n !== me)
    .map((n) => [n, players[n]?.d ?? 0] as [string, number]);
}

function richest(players: Array<[string, number]>): [string, number] {
  return players.slice().sort((a, b) => b[1] - a[1])[0];
}

export const voyageCheats: CheatDef[] = [
  {
    id: "voyage-set",
    label: "Set Doubloons",
    group: "Voyage",
    kind: "action",
    inputs: [{ name: "amount", label: "Doubloons", type: "number", defaultValue: "100000" }],
    run(api, args) {
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount)) return;
      api.setState({ doubloons: amount });
      api.setVal(`c/${api.client().name}/d`, amount);
    },
  },
  {
    id: "voyage-steal",
    label: "Steal Doubloons",
    group: "Voyage",
    kind: "action",
    warn: true,
    inputs: [{ name: "player", label: "Player (blank = richest)", type: "text" }],
    description: "Takes all of a player's doubloons through the game's own raid field. Defaults to the richest player.",
    run(api, args) {
      const target = (args.player ?? "").trim();
      api.getVal("c", (players: any) => {
        if (!players) {
          api.log("No player list found - are you in a game?");
          return;
        }
        const me = api.client().name;
        if (!me) return;
        const others = otherPlayers(players, me);
        if (!others.length) {
          api.log("No other players.");
          return;
        }
        const entry = target ? findDoubloonsPlayer(players, target) ?? richest(others) : richest(others);
        const [victim, d] = entry;
        const mine = players[me]?.d ?? api.node()?.state?.doubloons ?? 0;
        const newD = mine + d;
        api.setVal(`c/${me}`, {
          b: api.client().blook,
          d: newD,
          tat: `${victim}:${d}`,
        });
        api.setState({ doubloons: newD });
        api.log("Took " + d + " doubloons from " + victim + ".");
      });
    },
  },
  {
    id: "voyage-swap",
    label: "Swap Doubloons",
    group: "Voyage",
    kind: "action",
    warn: true,
    inputs: [{ name: "player", label: "Player (blank = richest)", type: "text" }],
    description: "Swaps your doubloons with another player's. Defaults to the richest player.",
    run(api, args) {
      const target = (args.player ?? "").trim();
      api.getVal("c", (players: any) => {
        if (!players) {
          api.log("No player list found - are you in a game?");
          return;
        }
        const me = api.client().name;
        if (!me) return;
        const others = otherPlayers(players, me);
        if (!others.length) {
          api.log("No other players.");
          return;
        }
        const entry = target ? findDoubloonsPlayer(players, target) ?? richest(others) : richest(others);
        const [victim, d] = entry;
        const mine = players[me]?.d ?? api.node()?.state?.doubloons ?? 0;
        api.setVal(`c/${me}`, {
          b: api.client().blook,
          d,
          tat: `${victim}:${d - mine}`,
        });
        api.setState({ doubloons: d });
        api.log("Swapped doubloons with " + victim + ".");
      });
    },
  },
  {
    id: "voyage-heist",
    label: "Start Heist",
    group: "Voyage",
    kind: "action",
    warn: true,
    inputs: [{ name: "player", label: "Player (blank = richest)", type: "text" }],
    description: "Forces a heist on a player's island for their doubloons.",
    run(api, args) {
      const target = (args.player ?? "").trim();
      api.getVal("c", (players: any) => {
        if (!players) {
          api.log("No player list found - are you in a game?");
          return;
        }
        const me = api.client().name;
        if (!me) return;
        const others = otherPlayers(players, me);
        if (!others.length) {
          api.log("No other players.");
          return;
        }
        const entry = target ? findDoubloonsPlayer(players, target) ?? richest(others) : richest(others);
        api.setState({
          stage: "heist",
          heistInfo: { name: entry[0], blook: players[entry[0]]?.b ?? "Chick" },
          prizeAmount: Math.max(1000, entry[1]),
        });
        api.log("Heist on " + entry[0] + " for " + Math.max(1000, entry[1]) + " doubloons.");
      });
    },
  },
  {
    id: "voyage-max-levels",
    label: "Max Island Levels",
    group: "Voyage",
    kind: "action",
    description: "Sets every island to max level.",
    run(api) {
      const node = api.node();
      const levels: any[] = node?.state?.islandLevels;
      if (!Array.isArray(levels)) return;
      api.setState({ islandLevels: levels.map(() => 5) });
      try {
        node.updateBoatLevel?.();
      } catch {
        /* ignore */
      }
    },
  },
];
