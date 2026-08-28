import type { CheatDef } from "../types";
import { humanPause, shouldMiss, typeAnswerHuman } from "../core/human";
import { randomWrongIndex } from "../core/dom";
import { getSettings } from "../core/settings";

export const globalCheats: CheatDef[] = [
  {
    id: "global-auto-answer",
    label: "Auto Answer",
    group: "Global",
    kind: "toggle",
    description: "Answers with human-like pacing and optional occasional misses.",
    run(api) {
      let busy = false;
      return api.interval(() => {
        if (busy) return;
        const node = api.node();
        const q = api.question();
        if (!q) return;
        const onFeedback = node?.state?.stage === "feedback" || !!node?.state?.feedback;
        const s = getSettings();

        if (q.qType === "typing") {
          if (!q.answers[0]) return;
          busy = true;
          (async () => {
            try {
              if (s.typing) await typeAnswerHuman(q.answers[0]);
              else {
                await humanPause();
                api.answerTyping();
              }
            } finally {
              busy = false;
            }
          })();
        } else if (onFeedback) {
          busy = true;
          (async () => {
            try {
              await humanPause();
              api.advance();
            } finally {
              busy = false;
            }
          })();
        } else {
          busy = true;
          (async () => {
            try {
              await humanPause();
              if (shouldMiss(s.accuracy)) {
                const wrong = randomWrongIndex(q);
                if (wrong >= 0) api.answerIndex(wrong);
                else api.answerCurrent();
              } else {
                api.answerCurrent();
              }
            } finally {
              busy = false;
            }
          })();
        }
      }, 150);
    },
  },
  {
    id: "global-highlight",
    label: "Highlight Answers",
    group: "Global",
    kind: "toggle",
    description: "Colors correct answers green and wrong answers red.",
    run(api) {
      return api.interval(() => {
        const q = api.question();
        if (!q || q.qType === "typing") return;
        const holder = document.querySelector("[class*='answersHolder']") as HTMLElement | null;
        if (!holder) return;
        q.answers.forEach((answer, i) => {
          const el = holder.querySelector(`:nth-child(${i + 1}) > div`) as HTMLElement | null;
          if (!el) return;
          el.style.backgroundColor =
            q.correctAnswers.indexOf(answer) !== -1
              ? "rgb(0, 207, 119)"
              : "rgb(189, 15, 38)";
        });
      }, 50);
    },
  },
  {
    id: "global-every-correct",
    label: "Every Answer Correct",
    group: "Global",
    kind: "action",
    description: "Marks every answer in the current set as correct.",
    run(api) {
      const node = api.node();
      if (!node) return;
      const lists = [node.freeQuestions, node.questions, node.props?.client?.questions];
      for (const list of lists) {
        if (!Array.isArray(list)) continue;
        for (const q of list) {
          if (q && Array.isArray(q.answers)) q.correctAnswers = [...q.answers];
        }
      }
      node.forceUpdate?.();
    },
  },
];
