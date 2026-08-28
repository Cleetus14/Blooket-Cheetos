import type { CheatDef } from "../types";
import { globalCheats } from "./global";
import { goldQuestCheats } from "./goldQuest";
import { cryptoHackCheats } from "./cryptoHack";
import { cafeCheats } from "./cafe";
import { factoryCheats } from "./factory";
import { towerOfDoomCheats } from "./towerOfDoom";
import { towerDefenseCheats } from "./towerDefense";
import { crazyKingdomCheats } from "./crazyKingdom";
import { fishingFrenzyCheats } from "./fishingFrenzy";
import { blookRushCheats } from "./blookRush";
import { deceptiveDinosCheats } from "./deceptiveDinos";
import { monsterBrawlCheats } from "./monsterBrawl";
import { santaWorkshopCheats } from "./santaWorkshop";

export interface ModeDef {
  id: string;
  label: string;
  match(path: string): boolean;
  cheats: CheatDef[];
}

const any = (...prefixes: string[]) => (p: string) => prefixes.some((x) => p.startsWith(x));

export const MODES: ModeDef[] = [
  {
    id: "gold",
    label: "Gold Quest",
    match: any("/play/gold", "/gold/play/landing"),
    cheats: goldQuestCheats,
  },
  {
    id: "crypto",
    label: "Cyber Hack",
    match: any("/play/hack", "/hack/play/landing"),
    cheats: cryptoHackCheats,
  },
  {
    id: "fishing",
    label: "Fishing Frenzy",
    match: any("/play/fishing", "/fish/play/landing"),
    cheats: fishingFrenzyCheats,
  },
  {
    id: "defense",
    label: "Tower Defense",
    match: (p) => p.startsWith("/defense") && !p.startsWith("/defense2"),
    cheats: towerDefenseCheats,
  },
  {
    id: "brawl",
    label: "Monster Brawl",
    match: any("/play/brawl", "/brawl/play/landing"),
    cheats: monsterBrawlCheats,
  },
  {
    id: "dino",
    label: "Deceptive Dinos",
    match: any("/play/dino", "/dino/play/landing"),
    cheats: deceptiveDinosCheats,
  },
  {
    id: "cafe",
    label: "Café",
    match: (p) => p.startsWith("/cafe"),
    cheats: cafeCheats,
  },
  {
    id: "factory",
    label: "Factory",
    match: any("/play/factory", "/factory/play/landing"),
    cheats: factoryCheats,
  },
  {
    id: "rush",
    label: "Blook Rush",
    match: any("/play/rush", "/rush/play/landing"),
    cheats: blookRushCheats,
  },
  {
    id: "tower",
    label: "Tower of Doom",
    match: (p) => p.startsWith("/tower"),
    cheats: towerOfDoomCheats,
  },
  {
    id: "kingdom",
    label: "Crazy Kingdom",
    match: (p) => p.startsWith("/kingdom"),
    cheats: crazyKingdomCheats,
  },
  {
    id: "workshop",
    label: "Santa's Workshop",
    match: any("/play/toy", "/toy/play/landing"),
    cheats: santaWorkshopCheats,
  },
];

export { globalCheats };
