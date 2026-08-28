import { MODES } from "../modes";
import { findStateNode } from "./state";

export type PageKind = "game" | "lobby" | "dashboard" | "other";

export interface AppContext {
  kind: PageKind;
  modeId: string | null;
  modeLabel: string | null;
  live: boolean;
  signature: string;
}

// Blooket now serves each game mode on its own subdomain
// (e.g. gold.blooket.com/<session>/play/<game>). The old /play/<mode>
// path routes still exist for a few legacy links, so both are matched.
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
  classic: "global",
  racing: "global",
  royale: "global",
  "battle-royale": "global",
  battle: "global",
  candy: "global",
  pirate: "global",
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
  const d = document;
  return !!(
    d.querySelector("[class*='answerContainer']") ||
    d.querySelector("[class*='typingAnswerWrapper']") ||
    d.querySelector("[class*='goldDisplay']") ||
    d.querySelector("canvas")
  );
}

function modeFromState(): string | null {
  const node = findStateNode();
  if (!node) return null;
  const s = node.state ?? {};
  const p = node.props ?? {};
  const raw =
    s.gameMode ?? s.mode ?? p.gameMode ?? p.client?.gameMode ?? p.liveGameController?.mode ?? null;
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
  return null;
}

function isLiveGame(): boolean {
  const node = findStateNode();
  if (!node) return looksLive();
  const s = node.state ?? {};
  if (node.props?.liveGameController) return true;
  if (s.stage || s.phase || s.question) return true;
  if (s.gold !== undefined || s.crypto !== undefined || s.cash !== undefined) return true;
  return looksLive();
}
