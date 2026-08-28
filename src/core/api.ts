import type { CheatApi, Question } from "../types";
import { findStateNode } from "./state";
import { makeInterval } from "./interval";
import { advanceFeedback, clickAnswer, clickCorrect, submitTyping } from "./dom";
import { MODES, globalCheats } from "../modes";

export function createApi(): CheatApi {
  const node = () => findStateNode();
  // The reference never wraps the game node; it reads/writes straight through
  // `stateNode.props.liveGameController`. Keep a tiny helper for that.
  const controller = () => node()?.props?.liveGameController ?? null;

  const api: CheatApi = {
    node,
    state: () => node()?.state ?? {},
    client: () => node()?.props?.client ?? {},
    setState: (patch) => node()?.setState?.(patch),
    // Reference-exact write: liveGameController.setVal({ path, val }).
    setVal: (path, val) => {
      const c = controller();
      if (!c || typeof c.setVal !== "function") return;
      try {
        c.setVal({ path, val });
      } catch {
        try {
          c.setVal(path, val);
        } catch {
          /* ignore */
        }
      }
    },
    // Reference-exact read: liveGameController.getDatabaseVal(path, cb).
    getVal: (path, cb) => {
      const c = controller();
      const fn = c?.getDatabaseVal ?? c?.getVal;
      if (typeof fn !== "function") return;
      try {
        const r = fn.call(c, path, cb);
        if (r && typeof r.then === "function") r.then(cb).catch(() => {});
      } catch {
        /* ignore */
      }
    },
    // Reference order: state.question first, then props.client.question.
    question: (): Question | null => {
      const n = node();
      return n?.state?.question ?? n?.props?.client?.question ?? null;
    },
    answerCurrent: () => {
      const q = api.question();
      return q ? clickCorrect(q) : false;
    },
    answerIndex: (idx) => {
      const q = api.question();
      return q ? clickAnswer(q, idx) : false;
    },
    answerTyping: () => {
      const q = api.question();
      return q ? submitTyping(q.answers[0]) : false;
    },
    advance: () => advanceFeedback(),
    // Blooket has no host-kick protocol, so this tries every removal hook the
    // game might expose and then deletes the player's node. Returns the list
    // of strategies that were attempted so the caller can report them.
    kickPlayer: (name: string) => {
      const n = node();
      if (!n) return [];
      const c = controller();
      const attempts: string[] = [];
      const call = (fn: any, label: string) => {
        if (typeof fn !== "function") return;
        try {
          fn.call(c ?? n, name);
          attempts.push(label);
        } catch {
          /* ignore */
        }
      };
      call(c?.removePlayer, "removePlayer");
      call(c?.kickPlayer, "kickPlayer");
      call(c?.disconnectPlayer, "disconnectPlayer");
      call(n.kickPlayer, "game.kickPlayer");
      call(n.removePlayer, "game.removePlayer");
      try {
        api.setVal(`c/${name}`, null);
        attempts.push("nodeDelete");
      } catch {
        /* ignore */
      }
      try {
        api.setVal(`c/${name}/kicked`, true);
        attempts.push("kickedFlag");
      } catch {
        /* ignore */
      }
      return attempts;
    },
    interval: makeInterval,
    // Run any cheat by id from the console (useful for testing or keybinds).
    // Toggles return a handle you can .stop(); actions return true.
    runCheat: (id, args) => {
      const def = [...MODES.flatMap((m) => m.cheats), ...globalCheats].find(
        (c) => c.id === id,
      );
      if (!def) {
        api.log("Unknown cheat: " + id);
        return null;
      }
      try {
        const handle = def.run(api, args ?? {});
        api.log("Ran " + def.label + ".");
        return handle ?? true;
      } catch (err) {
        api.log("Cheat failed: " + String(err));
        return null;
      }
    },
    log: (msg) => console.log("%c[Cheetos]%c " + msg, "color:#facc15", "color:inherit"),
  };

  return api;
}
