import type { CheatDef } from "../types";
import { humanPause, shouldMiss, typeAnswerHuman } from "../core/human";
import { randomWrongIndex } from "../core/dom";
import { getSettings } from "../core/settings";

const GAME_IDS = [
  "60101da869e8c70013913b59", "625db660c6842334835cb4c6", "60268f8861bd520016eae038",
  "611e6c804abdf900668699e3", "60ba5ff6077eb600221b7145", "642467af9b704783215c1f1b",
  "605bd360e35779001bf57c5e", "6234cc7add097ff1c9cff3bd", "600b1491d42a140004d5215a",
  "5db75fa3f1fa190017b61c0c", "5fac96fe2ca0da00042b018f", "600b14d8d42a140004d52165",
  "5f88953cdb209e00046522c7", "600b153ad42a140004d52172", "5fe260e72a505b00040e2a11",
  "5fe3d085a529560004cd3076", "5f5fc017aee59500041a1456", "608b0a5863c4f2001eed43f4",
  "5fad491512c8620004918ace", "5fc91a9b4ea2e200046bd49a", "5c5d06a7deebc70017245da7",
  "5ff767051b68750004a6fd21", "5fdcacc85d465a0004b021b9", "5fb7eea20bd44300045ba495",
];

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
    kind: "toggle",
    description: "Keeps every answer in the set marked correct as questions load.",
    run(api) {
      let warned = false;
      return api.interval(() => {
        const node = api.node();
        if (!node) {
          if (!warned) {
            warned = true;
            api.log("Waiting for the game to load before marking answers.");
          }
          return;
        }
        const lists = [node.freeQuestions, node.questions, node.props?.client?.questions];
        for (const list of lists) {
          if (!Array.isArray(list)) continue;
          for (const q of list) {
            if (q && Array.isArray(q.answers)) q.correctAnswers = [...q.answers];
          }
        }
        node.forceUpdate?.();
      }, 250);
    },
  },
  {
    id: "global-add-tokens",
    label: "Add Tokens (+XP)",
    group: "Rewards",
    kind: "action",
    inputs: [
      { name: "tokens", label: "Tokens", type: "number", defaultValue: "500" },
      { name: "xp", label: "XP", type: "number", defaultValue: "300" },
    ],
    description: "Runs a spoofed solo Factory game and credits tokens + XP to your account.",
    run(api, args) {
      const tokens = parseInt(args.tokens, 10);
      const xp = parseInt(args.xp, 10);
      if (!Number.isFinite(tokens) || tokens <= 0) return;
      if (!Number.isFinite(xp) || xp < 0) return;
      if (tokens > 500 || xp > 300) {
        api.log("Heads up: the server caps rewards at 500 tokens / 300 XP per run \u2014 larger values get clamped or rejected.");
      }
      if (!window.location.hostname.toLowerCase().includes("play.blooket.com")) {
        api.log("Add Tokens works on play.blooket.com (host or join any game page).");
        return;
      }
      void (async () => {
        try {
          const rand = (l: number, h: number) => Math.floor(Math.random() * (h - l + 1)) + l;
          const gameId = GAME_IDS[Math.floor(Math.random() * GAME_IDS.length)];
          const session = await fetch("https://play.blooket.com/api/playersessions/solo", {
            body: JSON.stringify({ gameMode: "Factory", questionSetId: gameId }),
            method: "POST",
            credentials: "include",
          })
            .then((r) => r.json())
            .catch(() => null);
          const t = session?.t;
          if (!t) throw new Error("could not create solo session");
          await fetch("https://play.blooket.com/api/playersessions/landings", {
            body: JSON.stringify({ t }),
            method: "POST",
            credentials: "include",
          }).catch(() => null);
          await fetch("https://play.blooket.com/api/playersessions/questions?t=" + t, {
            credentials: "include",
          }).catch(() => null);
          await fetch("https://play.blooket.com/api/gamequestionsets?gameId=" + gameId, {
            credentials: "include",
          }).catch(() => null);
          await fetch("https://play.blooket.com/api/users/factorystats", {
            body: JSON.stringify({
              t,
              place: 1,
              cash: rand(10000000, 100000000),
              playersDefeated: 0,
              correctAnswers: rand(500, 2000),
              upgrades: rand(250, 750),
              blookUsed: "Chick",
              nameUsed: "You",
              mode: "Time-Solo",
            }),
            method: "PUT",
            credentials: "include",
          }).catch(() => null);
          const res = await fetch("https://play.blooket.com/api/users/add-rewards", {
            body: JSON.stringify({ t, addedTokens: tokens, addedXp: xp }),
            method: "PUT",
            credentials: "include",
          })
            .then((r) => r.json())
            .catch(() => null);
          api.log(
            "Added " + tokens + " tokens and " + xp + " XP" +
              (res?.dailyReward ? " (+daily wheel: " + res.dailyReward + ")" : "") + ".",
          );
        } catch (err) {
          api.log("Add Tokens failed: " + (err as Error).message);
        }
      })();
    },
  },
];
