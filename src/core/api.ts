import type { CheatApi, Question } from "../types";
import { findStateNode } from "./state";
import { makeInterval } from "./interval";
import { advanceFeedback, clickAnswer, clickCorrect, submitTyping } from "./dom";

export function createApi(): CheatApi {
  const node = () => findStateNode();

  const api: CheatApi = {
    node,
    state: () => node()?.state ?? {},
    client: () => node()?.props?.client ?? {},
    setState: (patch) => node()?.setState?.(patch),
    setVal: (path, val) => node()?.setVal?.(path, val),
    getVal: (path, cb) => node()?.getVal?.(path, cb),
    question: (): Question | null => {
      const n = node();
      const fromNode = n?.question?.();
      return (
        fromNode ??
        n?.props?.client?.question ??
        n?.state?.question ??
        n?.props?.question ??
        null
      );
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
    interval: makeInterval,
    log: (msg) => console.log("%c[Cheetos]%c " + msg, "color:#facc15", "color:inherit"),
  };

  return api;
}
