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

function isLiveGame(): boolean {
  const node = findStateNode();
  if (!node) return false;
  return !!(
    node.props?.liveGameController?._liveApp ||
    node.state?.stage ||
    node.state?.phase
  );
}
