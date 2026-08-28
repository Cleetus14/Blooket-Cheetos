import type { CheatApi, Question } from "../types";
import { findStateNode } from "./state";
import { makeInterval } from "./interval";
import { advanceFeedback, clickAnswer, clickCorrect, submitTyping } from "./dom";
import { MODES, globalCheats } from "../modes";

export function createApi(): CheatApi {
  const node = () => findStateNode();
  const controller = () => node()?.props?.liveGameController ?? null;

  const api: CheatApi = {
    node,
    state: () => node()?.state ?? {},
    client: () => node()?.props?.client ?? {},
    setState: (patch) => node()?.setState?.(patch),
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
