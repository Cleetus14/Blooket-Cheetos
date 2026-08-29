import type { CheatApi, Question } from "../types";
import { findStateNode, findInstanceWithMethod, stateDiagnostics, gameDocument } from "./state";
import { makeInterval } from "./interval";
import { advanceFeedback, clickAnswer, clickCorrect, submitTyping } from "./dom";
import { isQuestionOnScreen } from "./dom";
import { MODES, globalCheats } from "../modes";

let lastSetValWarn = 0;

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
      if (!c || typeof c.setVal !== "function") {
        const now = Date.now();
        if (now - lastSetValWarn > 5000) {
          lastSetValWarn = now;
          api.log("setVal skipped: no live game controller found (path " + path + ").");
        }
        return;
      }
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
      if (!n) return null;
      const direct = n?.state?.question ?? n?.props?.client?.question ?? null;
      if (direct && Array.isArray(direct.answers) && direct.answers.length) return direct;
      const candidates: any[] = [];
      const states = n.states ?? [];
      for (const s of states) {
        if (s && typeof s === "object") {
          if (s.question && Array.isArray(s.question.answers)) candidates.push(s.question);
          if (Array.isArray(s.questions)) candidates.push(...s.questions);
          if (Array.isArray(s.freeQuestions)) candidates.push(...s.freeQuestions);
        }
      }
      const props = n.props ?? {};
      const lists = [props.questions, props.freeQuestions, props.client?.questions, ...(n.lists ?? [])];
      for (const l of lists) if (Array.isArray(l)) candidates.push(...l);
      const seen = new Set<any>();
      for (const q of candidates) {
        if (!q || seen.has(q) || !Array.isArray(q.answers) || !q.answers.length) continue;
        seen.add(q);
        if (!Array.isArray(q.correctAnswers) || !q.correctAnswers.length) continue;
        if (q.question && isQuestionOnScreen(q)) return q;
      }
      for (const q of candidates) {
        if (!q || seen.has(q) || !Array.isArray(q.answers) || !q.answers.length) continue;
        seen.add(q);
        if (Array.isArray(q.correctAnswers) && q.correctAnswers.length && !q.question) return q;
      }
      return null;
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
    test: () => {
      const n = node();
      const diag = stateDiagnostics();
      const c = controller();
      const client = api.client();
      const report: Record<string, any> = {
        found: diag.found,
        strong: diag.strong,
        source: diag.source,
        controller: diag.controller,
        clientName: client?.name ?? null,
        clientType: client?.type ?? null,
        hasQuestion: diag.hasQuestion,
        hasGold: diag.hasGold,
        stage: diag.stage,
        stateKeys: diag.stateKeys,
        states: diag.states,
        methods: diag.methods,
      };
      const gd = gameDocument();
      try {
        report.answerContainers = gd.querySelectorAll("[class*='answerContainer']").length;
      } catch {
        report.answerContainers = 0;
      }
      try {
        report.typingWrapper = !!gd.querySelector("[class*='typingAnswerWrapper']");
      } catch {
        report.typingWrapper = false;
      }
      try {
        report.choiceDivs = gd.querySelectorAll("div[class*='choice']").length;
      } catch {
        report.choiceDivs = 0;
      }
      try {
        report.feedback = !!gd.querySelector("[class*='feedback'], [id*='feedback']");
      } catch {
        report.feedback = false;
      }
      report.sendAnswer = typeof findInstanceWithMethod("sendAnswer") === "function";

      const emit = () => {
        api.log("[Cheetos test] " + JSON.stringify(report));
      };

      const finishSetVal = () => {
        if (c && typeof c.setVal === "function" && client?.name) {
          const path = "c/" + client.name + "/g";
          const read = (cb: (v: any) => void) => {
            const fn = c.getDatabaseVal ?? c.getVal;
            if (typeof fn !== "function") {
              cb(undefined);
              return;
            }
            try {
              const r = fn.call(c, path, cb);
              if (r && typeof r.then === "function") r.then(cb).catch(() => cb(undefined));
            } catch {
              cb(undefined);
            }
          };
          read((v) => {
            if (typeof v !== "number") {
              report.setVal = { skipped: true, reason: "no numeric value at " + path };
              emit();
              return;
            }
            const target = v;
            try {
              c.setVal({ path, val: target + 1 });
            } catch {
              report.setVal = { skipped: true, reason: "setVal threw" };
              emit();
              return;
            }
            setTimeout(() => {
              read((v2) => {
                report.setVal = {
                  path,
                  wrote: v2 === target + 1,
                  restored: false,
                };
                try {
                  c.setVal({ path, val: target });
                  report.setVal.restored = true;
                } catch {
                  /* ignore */
                }
                emit();
              });
            }, 120);
          });
        } else {
          report.setVal = { skipped: true, reason: c ? "no client name" : "no controller" };
          emit();
        }
      };

      const st = n?.state ?? null;
      if (st && typeof st === "object" && Object.keys(st).length) {
        const key = "__cheetosTest";
        const value = Date.now();
        api.setState({ [key]: value });
        setTimeout(() => {
          const st2 = node()?.state ?? null;
          report.dispatch = {
            applied: !!(st2 && st2[key] === value),
            on: diag.source,
          };
          try {
            delete st[key];
          } catch {
            /* ignore */
          }
          if (st2 && st2 !== st) {
            try {
              delete st2[key];
            } catch {
              /* ignore */
            }
          }
          finishSetVal();
        }, 60);
      } else {
        report.dispatch = { applied: false, reason: "no state object to patch" };
        finishSetVal();
      }
    },
    log: (msg) => console.log("%c[Cheetos]%c " + msg, "color:#facc15", "color:inherit"),
  };

  return api;
}
