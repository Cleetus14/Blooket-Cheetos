import { MODES } from "../modes";
import { findStateNode, gameDocument } from "./state";

export type PageKind = "game" | "lobby" | "dashboard" | "other";

export interface AppContext {
  kind: PageKind;
  modeId: string | null;
  modeLabel: string | null;
  live: boolean;
  signature: string;
}

const SUBDOMAIN_MODES: Record<string, string> = {
  gold: "gold",
  crypto: "crypto",
  hack: "crypto",
  fish: "fishing",
  fishing: "fishing",
  defense: "defense",
  defense2: "defense",
  brawl: "brawl",
  dino: "dino",
  dinos: "dino",
  cafe: "cafe",
  factory: "factory",
  rush: "rush",
  tower: "tower",
  doom: "tower",
  kingdom: "kingdom",
  toy: "workshop",
  santa: "workshop",
  voyage: "voyage",
  racing: "racing",
  classic: "global",
  royale: "global",
  "battle-royale": "global",
  battle: "global",
  candy: "global",
  pirate: "voyage",
};

function modeFromSubdomain(host: string): string | null {
  const sub = host.split(".")[0];
  return SUBDOMAIN_MODES[sub] ?? null;
}

export function detectContext(): AppContext {
  const host = window.location.hostname.toLowerCase();
  const path = window.location.pathname.toLowerCase();

  if (!host.includes("blooket.com")) {
    return { kind: "other", modeId: null, modeLabel: null, live: false, signature: "other" };
  }

  const subMode = modeFromSubdomain(host);
  if (subMode) {
    const live = isLiveGame();
    if (subMode === "global") {
      return {
        kind: "game",
        modeId: "global",
        modeLabel: "Quiz",
        live,
        signature: `game:global:${live ? 1 : 0}`,
      };
    }
    const def = MODES.find((m) => m.id === subMode);
    if (def) {
      return {
        kind: "game",
        modeId: def.id,
        modeLabel: def.label,
        live,
        signature: `game:${def.id}:${live ? 1 : 0}`,
      };
    }
  }

  const mode = MODES.find((m) => m.match(path)) ?? null;
  if (mode) {
    const live = isLiveGame();
    return {
      kind: "game",
      modeId: mode.id,
      modeLabel: mode.label,
      live,
      signature: `game:${mode.id}:${live ? 1 : 0}`,
    };
  }

  if (isQuizPath(path)) {
    const live = isLiveGame();
    return {
      kind: "game",
      modeId: "global",
      modeLabel: "Quiz",
      live,
      signature: `game:global:${live ? 1 : 0}`,
    };
  }

  const fromState = modeFromState();
  if (fromState) {
    const label = MODES.find((m) => m.id === fromState)?.label ?? fromState;
    return {
      kind: "game",
      modeId: fromState,
      modeLabel: label,
      live: true,
      signature: `game:${fromState}:1`,
    };
  }

  if (
    path.includes("/lobby") ||
    path === "/play" ||
    path.includes("/join") ||
    path.includes("/enter")
  ) {
    return { kind: "lobby", modeId: null, modeLabel: null, live: false, signature: "lobby" };
  }

  return { kind: "dashboard", modeId: null, modeLabel: null, live: false, signature: "dashboard" };
}

function isQuizPath(path: string): boolean {
  return (
    path.startsWith("/play/classic") ||
    path.startsWith("/classic/play/landing") ||
    path.startsWith("/play/racing") ||
    path.startsWith("/racing/play/landing")
  );
}

function looksLive(): boolean {
  const d = gameDocument();
  const markers = [
    "[class*='answer']", "[class*='question']", "[class*='choice']",
    "[class*='feedback']", "[class*='gold']", "[class*='crypto']",
    "[class*='token']", "[class*='fish']", "[class*='toys']",
    "[class*='cash']", "[class*='round']", "[class*='score']",
    "[class*='blook']", "[class*='questionContainer']",
  ];
  for (const marker of markers) {
    if (d.querySelector(marker)) return true;
  }
  return !!d.querySelector("canvas");
}

function pathLooksLive(): boolean {
  const path = window.location.pathname.toLowerCase();
  return path.includes("/play/") || path.includes("/game/");
}

function modeFromState(): string | null {
  const node = findStateNode();
  if (!node) return null;
  const s = node.state ?? {};
  const p = node.props ?? {};
  const raw =
    p.client?.type ??
    s.gameMode ??
    s.mode ??
    p.gameMode ??
    p.client?.gameMode ??
    p.liveGameController?.mode ??
    p.liveGameController?._gameMode ??
    null;
  if (typeof raw !== "string") return null;
  const m = raw.toLowerCase();
  if (m.includes("gold")) return "gold";
  if (m.includes("hack") || m.includes("crypto")) return "crypto";
  if (m.includes("fish")) return "fishing";
  if (m.includes("defense")) return "defense";
  if (m.includes("brawl")) return "brawl";
  if (m.includes("dino")) return "dino";
  if (m.includes("cafe")) return "cafe";
  if (m.includes("factory")) return "factory";
  if (m.includes("rush")) return "rush";
  if (m.includes("tower")) return "tower";
  if (m.includes("kingdom")) return "kingdom";
  if (m.includes("toy") || m.includes("workshop") || m.includes("santa")) return "workshop";
  if (m.includes("voyage") || m.includes("pirate") || m.includes("ship")) return "voyage";
  if (m.includes("racing") || m.includes("race")) return "racing";
  return null;
}

function isLiveGame(): boolean {
  const node = findStateNode();
  if (node) {
    const s = node.state ?? {};
    const client = node.props?.client ?? {};
    const props = node.props ?? {};
    if (props.liveGameController) return true;
    if (s.stage || s.phase || s.question || client.question || props.question) return true;
    if (Array.isArray(s.choices) || Array.isArray(client.questions)) return true;
    if (s.gold !== undefined || s.crypto !== undefined || s.cash !== undefined) return true;
    if (client.name && (s.gold !== undefined || s.crypto !== undefined || s.stage)) return true;
  }
  if (pathLooksLive()) return true;
  return looksLive();
}
