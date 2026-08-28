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

export const MODES: ModeDef[] = [
  { id: "gold", label: "Gold Quest", match: (p) => p.includes("/gold"), cheats: goldQuestCheats },
  { id: "crypto", label: "Crypto Hack", match: (p) => p.includes("/hack"), cheats: cryptoHackCheats },
  {
    id: "fishing",
    label: "Fishing Frenzy",
    match: (p) => p.includes("/fishing") || p.includes("/fish/play"),
    cheats: fishingFrenzyCheats,
  },
  {
    id: "defense",
    label: "Tower Defense",
    match: (p) => p.includes("/defense") && !p.includes("/defense2"),
    cheats: towerDefenseCheats,
  },
  { id: "brawl", label: "Monster Brawl", match: (p) => p.includes("/brawl"), cheats: monsterBrawlCheats },
  { id: "dino", label: "Deceptive Dinos", match: (p) => p.includes("/dino"), cheats: deceptiveDinosCheats },
  { id: "cafe", label: "Café", match: (p) => p.includes("/cafe"), cheats: cafeCheats },
  { id: "factory", label: "Factory", match: (p) => p.includes("/factory"), cheats: factoryCheats },
  { id: "rush", label: "Blook Rush", match: (p) => p.includes("/rush"), cheats: blookRushCheats },
  { id: "tower", label: "Tower of Doom", match: (p) => p.includes("/tower"), cheats: towerOfDoomCheats },
  { id: "kingdom", label: "Crazy Kingdom", match: (p) => p.includes("/kingdom"), cheats: crazyKingdomCheats },
  {
    id: "workshop",
    label: "Santa's Workshop",
    match: (p) => p.includes("/toy"),
    cheats: santaWorkshopCheats,
  },
];

export { globalCheats };
