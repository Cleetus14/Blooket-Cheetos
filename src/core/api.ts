import type { CheatApi, Question } from "../types";
import {
  findStateNode,
  findInstanceWithMethod,
  stateDiagnostics,
  gameDocument,
} from "./state";
import { makeInterval } from "./interval";
import {
  advanceFeedback,
  clickCorrect,
  clickAnswerText,
  clickAnswerContainerAt,
  answerTextOnScreen,
  submitTyping,
} from "./dom";
import { MODES, globalCheats } from "../modes";

let lastSetValWarn = 0;

function answerStrings(raw: any): string[] {
  for (const k of ["answers", "choices", "options", "answerChoices", "responses"]) {
    const a = raw[k];
    if (!Array.isArray(a) || !a.length) continue;
    const out: string[] = [];
    for (const item of a) {
      if (typeof item === "string" || typeof item === "number") {
        out.push(String(item));
      } else if (item && typeof item === "object") {
        const t = item.text ?? item.answerText ?? item.label ?? item.value ?? item.name;
        if (t !== undefined && t !== null) out.push(String(t));
      }
    }
    if (out.length) return out;
  }
  return [];
}

function normalizeQuestion(raw: any): Question | null {
  if (!raw || typeof raw !== "object") return null;
  const answers = answerStrings(raw);
  if (!answers.length) return null;

  const texts: string[] = [];
  const addText = (c: any) => {
    if (typeof c === "number") {
      const t = answers[c];
      if (t !== undefined) texts.push(String(t));
    } else if (typeof c === "string") {
      texts.push(c);
    }
  };

  const corrects = raw.correctAnswers ?? raw.correctAnswer ?? raw.correct ?? raw.answer;
  if (Array.isArray(corrects)) {
    for (const c of corrects) addText(c);
  } else if (corrects !== undefined && corrects !== null) {
    addText(corrects);
  }

  const idx = raw.answerIndex ?? raw.correctIndex;
  if (!texts.length && typeof idx === "number") addText(idx);
  if (!texts.length && typeof raw.solution === "string") texts.push(raw.solution);
  if (!texts.length && typeof raw.solution === "number") addText(raw.solution);

  if (!texts.length) {
    for (const k of ["answers", "choices", "options", "answerChoices", "responses"]) {
      const a = raw[k];
      if (!Array.isArray(a)) continue;
      for (let i = 0; i < a.length; i++) {
        const item = a[i];
        if (item && typeof item === "object" && (item.correct === true || item.isCorrect === true)) {
          texts.push(answers[i]);
        }
      }
    }
  }

  let prompt = "";
  for (const k of ["question", "text", "prompt", "title"]) {
    if (typeof raw[k] === "string" && raw[k]) {
      prompt = raw[k];
      break;
    }
  }
  return {
    qType: typeof raw.qType === "string" ? raw.qType : "mc",
    question: prompt,
    answers,
    correctAnswers: texts,
  };
}

function collectQuestionPool(n: any): any[] {
  const pool: any[] = [];
  const push = (o: any) => {
    if (o && typeof o === "object" && !pool.includes(o)) pool.push(o);
  };
  const pushList = (l: any) => {
    if (Array.isArray(l)) for (const q of l) push(q);
  };
  const st = n?.state ?? {};
  push(st.question);
  push(st.currentQuestion);
  push(st.questionData);
  for (const s of n?.states ?? []) {
    if (!s || typeof s !== "object") continue;
    push(s.question);
    push(s.currentQuestion);
    push(s.questionData);
    pushList(s.questions);
    pushList(s.freeQuestions);
  }
  for (const q of n?.questions ?? []) push(q);
  const props = n?.props ?? {};
  push(props.question);
  push(props.currentQuestion);
  push(props.client?.question);
  pushList(props.questions);
  pushList(props.freeQuestions);
  pushList(props.client?.questions);
  for (const a of n?.answerSources ?? []) push(a.obj);
  for (const l of n?.lists ?? []) pushList(l);
  return pool;
}

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
      if (c && typeof c.setVal === "function") {
        try {
          c.setVal({ path, val });
          return;
        } catch {
          /* ignore */
        }
        try {
          c.setVal(path, val);
          return;
        } catch {
          /* ignore */
        }
      }
      const fb = node()?.firebase ?? null;
      if (fb && typeof fb.database === "function") {
        try {
          const ref = fb.database().ref(path);
          if (ref && typeof ref.set === "function") {
            ref.set(val);
            return;
          }
        } catch {
          /* ignore */
        }
      }
      const now = Date.now();
      if (now - lastSetValWarn > 5000) {
        lastSetValWarn = now;
        api.log("setVal skipped: no live game controller or firebase found (path " + path + ").");
      }
    },
    getVal: (path, cb) => {
      const c = controller();
      const fn = c?.getDatabaseVal ?? c?.getVal;
      if (typeof fn === "function") {
        try {
          const r = fn.call(c, path, cb);
          if (r && typeof r.then === "function") r.then(cb).catch(() => {});
          return;
        } catch {
          /* ignore */
        }
      }
      const fb = node()?.firebase ?? null;
      if (fb && typeof fb.database === "function") {
        try {
          const ref = fb.database().ref(path);
          if (ref && typeof ref.once === "function") {
            ref.once("value").then((snap: any) => cb(snap?.val ? snap.val() : snap)).catch(() => {});
            return;
          }
        } catch {
          /* ignore */
        }
      }
      const now = Date.now();
      if (now - lastSetValWarn > 5000) {
        lastSetValWarn = now;
        api.log("getVal skipped: no live game controller or firebase found (path " + path + ").");
      }
      cb(undefined);
    },
    question: (): Question | null => {
      const n = node();
      if (!n) return null;
      const pool = collectQuestionPool(n);
      const scored = pool
        .map((raw) => ({ raw, q: normalizeQuestion(raw) }))
        .filter((x) => x.q);
      let best: Question | null = null;
      let bestScore = -1;
      for (const x of scored) {
        let onScreen = 0;
        for (const a of x.q!.answers) {
          if (answerTextOnScreen(a)) onScreen += 1;
        }
        const score =
          onScreen * 10 + (x.q!.question ? 3 : 0) + Math.min(x.q!.correctAnswers.length, 4);
        if (score > bestScore) {
          bestScore = score;
          best = x.q;
        }
      }
      if (best) {
        if (!best.correctAnswers.length) {
          const prompt = (best.question ?? "").trim().toLowerCase();
          for (const x of scored) {
            const qq = x.q!;
            if (
              qq.correctAnswers.length &&
              prompt &&
              (qq.question ?? "").trim().toLowerCase() === prompt
            ) {
              return qq;
            }
          }
        }
        return best;
      }
      for (const x of scored) {
        if (x.q!.question) return x.q;
      }
      return scored.length ? scored[0].q : null;
    },
    answerCurrent: () => {
      const q = api.question();
      return q ? clickCorrect(q) : false;
    },
    answerIndex: (idx) => {
      const q = api.question();
      if (!q || !q.answers[idx]) return false;
      const text = q.answers[idx];
      if (clickAnswerText(text)) return true;
      if (clickAnswerContainerAt(idx, text)) return true;
      const fn = findInstanceWithMethod("sendAnswer");
      if (typeof fn === "function") {
        try {
          fn.call(null, text, true);
          return true;
        } catch {
          /* ignore */
        }
      }
      return false;
    },
    answerTyping: () => {
      const q = api.question();
      if (!q) return false;
      const fn = findInstanceWithMethod("sendAnswer");
      if (typeof fn === "function") {
        try {
          fn.call(null, q.answers[0]);
          return true;
        } catch {
          /* ignore */
        }
      }
      return submitTyping(q.answers[0]);
    },
    advance: () => {
      if (advanceFeedback()) return true;
      const fn = findInstanceWithMethod("sendAnswerNext");
      if (typeof fn === "function") {
        try {
          fn.call(null);
          return true;
        } catch {
          /* ignore */
        }
      }
      return false;
    },
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
        version: diag.version,
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
        topStates: diag.topStates,
        states: diag.states,
        questionPool: diag.questionPool,
        methods: diag.methods,
        onAnswer: diag.onAnswer,
        sendAnswerNext: diag.sendAnswerNext,
        ctrlCandidates: diag.ctrlCandidates,
        ctrlKeys: diag.ctrlKeys,
        firebase: diag.firebase,
        contextValues: diag.contextValues,
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
      const q = api.question();
      report.resolvedQuestion = q
        ? { question: q.question, answers: q.answers, correctAnswers: q.correctAnswers }
        : null;
      report.answersOnScreen = q
        ? q.answers.filter((a) => answerTextOnScreen(a)).length
        : 0;

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
      report.dispatch = {
        applied: false,
        reason:
          st && typeof st === "object" && Object.keys(st).length
            ? "disabled (read-only diagnostic; destructive write removed)"
            : "no state object to patch",
      };
      finishSetVal();
    },
    log: (msg) => console.log("%c[Cheetos]%c " + msg, "color:#facc15", "color:inherit"),
  };

  return api;
}
