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

export function detectContext(): AppContext {
  const host = window.location.hostname.toLowerCase();
  const path = window.location.pathname.toLowerCase();

  if (!host.includes("blooket.com")) {
    return { kind: "other", modeId: null, modeLabel: null, live: false, signature: "other" };
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
