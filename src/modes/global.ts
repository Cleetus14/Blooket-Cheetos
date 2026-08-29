import type { CheatDef } from "../types";
import {
  clickAnswerText,
  clickAnswerContainerAt,
  clickFeedbackAdvance,
  correctIndex,
} from "../core/dom";
import { methodOwner } from "../core/state";

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

type Logger = (msg: string) => void;

async function addTokensReward(tokens: number, xp: number, log: Logger): Promise<void> {
  const rand = (l: number, h: number) => Math.floor(Math.random() * (h - l + 1)) + l;
  const gameId = GAME_IDS[Math.floor(Math.random() * GAME_IDS.length)];

  if (window.location.hostname.toLowerCase() !== "play.blooket.com") {
    window.open("https://play.blooket.com/", "_blank");
    log("Add Tokens only runs on play.blooket.com (lobby or in a game). Run the bookmark again on the tab that just opened.");
    return;
  }

  const fetchJson = async (path: string, init: RequestInit): Promise<{ status: number; body: any } | null> => {
    try {
      const r = await fetch(path, { credentials: "include", ...init });
      const text = await r.text();
      let body: any = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
      return { status: r.status, body };
    } catch {
      return null;
    }
  };

  try {
    const session = await fetchJson("https://play.blooket.com/api/playersessions/solo", {
      body: JSON.stringify({ gameMode: "Factory", questionSetId: gameId }),
      method: "POST",
    });
    const t = session?.body?.t;
    if (!t) {
      log(
        "Add Tokens failed: could not start a solo game session" +
          (session && session.status >= 400 ? " (server returned " + session.status + ")." : "."),
      );
      return;
    }
    await fetchJson("https://play.blooket.com/api/playersessions/landings", {
      body: JSON.stringify({ t }),
      method: "POST",
    });
    await fetchJson("https://play.blooket.com/api/playersessions/questions?t=" + t, {});
    await fetchJson("https://play.blooket.com/api/gamequestionsets?gameId=" + gameId, {});
    await fetchJson("https://play.blooket.com/api/users/factorystats", {
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
    });
    const res = await fetchJson("https://play.blooket.com/api/users/add-rewards", {
      body: JSON.stringify({ t, addedTokens: tokens, addedXp: xp }),
      method: "PUT",
    });
    if (!res) {
      log("Add Tokens failed: network error talking to play.blooket.com.");
      return;
    }
    const body = res.body ?? {};
    const raw = typeof body.raw === "string" ? body.raw : "";
    const errText = String(body.error ?? body.message ?? "");
    const onLimit =
      /limit|cooldown|daily|already|earned/i.test(errText) ||
      /limit|cooldown|daily|already|earned/i.test(raw);
    if (onLimit) {
      log("Add Tokens failed: you are currently on your tokens/XP daily limit, try again later.");
      return;
    }
    if (body.error || body.message) {
      log("Add Tokens failed: " + errText.slice(0, 200) + ".");
      return;
    }
    if (res.status >= 400) {
      log(
        "Add Tokens failed: server returned " + res.status +
          (raw ? " (" + raw.slice(0, 120) + ")" : "") + ".",
      );
      return;
    }
    if (typeof body.dailyReward !== "number") {
      log(
        "Add Tokens did not credit anything: the server did not confirm the reward" +
          (raw ? " (response: " + raw.slice(0, 160) + ")" : "") +
          ". You are likely on the tokens/XP daily limit — try again later.",
      );
      return;
    }
    log("Added " + tokens + " tokens and " + xp + " XP (+daily wheel: " + body.dailyReward + ").");
  } catch (err) {
    log("Add Tokens failed: " + (err as Error).message);
  }
}

export const globalCheats: CheatDef[] = [
  {
    id: "global-auto-answer",
    label: "Auto Answer",
    group: "Global",
    kind: "toggle",
    description: "Answers automatically from the live game state. Humanizer only adds optional pacing.",
    run(api) {
      let lastSig = "";
      let lastWaitLog = 0;
      return api.interval(() => {
        const node = api.node();
        if (!node) return;
        const q = api.question();
        if (!q || !Array.isArray(q.answers) || !q.answers.length) {
          const now = Date.now();
          if (now - lastWaitLog > 6000) {
            lastWaitLog = now;
            api.log("Auto Answer: waiting for a question...");
          }
          return;
        }
        const sig = (q.question ?? "") + "|" + q.answers.join("~") + "|" + (q.correctAnswers ?? []).join("~");
        if (sig !== lastSig) {
          lastSig = sig;
          api.log(
            "Auto Answer: \u201c" + (q.question || "?") + "\u201d [" + (q.qType ?? "mc") + "]",
          );
        }
        const state = node.state ?? {};
        const inFeedback =
          state.stage === "feedback" ||
          !!state.feedback ||
          (state.stage === undefined && !!document.querySelector("[class*='feedback'], [id*='feedback']"));

        if (q.qType !== "typing") {
          if (inFeedback) {
            if (!api.advance()) clickFeedbackAdvance();
            return;
          }
          const ind = correctIndex(q);
          if (ind >= 0) {
            const text = q.answers[ind];
            if (!clickAnswerText(text) && !clickAnswerContainerAt(ind, text)) {
              const node = api.node();
              const fn = node.sendAnswer;
              if (typeof fn === "function") {
                try {
                  fn.call(null, text, true);
                } catch {
                  /* ignore */
                }
              } else {
                const owner = node.onAnswerOwner;
                const on = owner?.onAnswer;
                if (typeof on === "function") {
                  try {
                    on.call(owner, text, true);
                  } catch {
                    /* ignore */
                  }
                }
              }
            }
          }
        } else {
          void api.answerTyping();
        }
      }, 50);
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
        q.answers.forEach((answer, i) => {
          const el = document.querySelectorAll(
            "div,button,span,p,[role='button']",
          );
          let target: HTMLElement | null = null;
          for (const e of Array.from(el) as HTMLElement[]) {
            if ((e.textContent ?? "").trim().toLowerCase() === answer.trim().toLowerCase()) {
              target = e;
              break;
            }
          }
          if (!target) return;
          target.style.backgroundColor =
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
    description: "Marks every answer in the set correct as questions load.",
    run(api) {
      const wrapped = new WeakSet<object>();
      return api.interval(() => {
        const node = api.node();
        if (!node) return;
        const mark = (q: any) => {
          if (q && Array.isArray(q.answers)) q.correctAnswers = q.answers.slice();
        };
        for (const p of node.questions ?? []) mark(p);
        for (const l of node.lists ?? []) {
          if (Array.isArray(l)) l.forEach(mark);
        }
        const fq = node.freeQuestions;
        if (Array.isArray(fq)) fq.forEach(mark);
        const qs = node.questions;
        if (Array.isArray(qs)) qs.forEach(mark);
        mark(node.state?.question);
        const owner = node.onAnswerOwner ?? methodOwner("onAnswer");
        const orig = owner?.onAnswer;
        if (owner && typeof orig === "function" && !wrapped.has(owner)) {
          wrapped.add(owner);
          owner.onAnswer = function (this: unknown) {
            const args = Array.from(arguments);
            args[0] = true;
            return orig.apply(this, args);
          };
        }
        try {
          node.forceUpdate?.();
        } catch {
          /* ignore */
        }
      }, 150);
    },
  },
  {
    id: "global-change-blook",
    label: "Change Blook In Game",
    group: "Global",
    kind: "action",
    inputs: [{ name: "blook", label: "Blook name", type: "text", defaultValue: "Rainbow Astronaut" }],
    description: "Switches the blook you display in a live game (case sensitive).",
    run(api, args) {
      const blook = (args.blook ?? "").trim();
      if (!blook) return;
      const client = api.client();
      if (!client.name) {
        api.log("Not in a game yet.");
        return;
      }
      api.setVal(`c/${client.name}/b`, blook);
      client.blook = blook;
      api.log("Blook changed to " + blook + ".");
    },
  },
  {
    id: "global-remove-random-name",
    label: "Remove Random Name",
    group: "Global",
    kind: "action",
    description: "Removes your random name so your account name shows.",
    run(api) {
      api.setState({ isRandom: false, client: { name: "" } });
    },
  },
  {
    id: "global-use-any-blook",
    label: "Use Any Blook",
    group: "Global",
    kind: "action",
    description: "Unlocks every blook on the lobby or /blooks page (display only).",
    run(api) {
      const path = window.location.pathname;
      const lobby = path.startsWith("/play/lobby");
      const blooksPage = path.startsWith("/blooks");
      if (!lobby && !blooksPage) {
        api.log("Run this on the lobby or the /blooks page.");
        return;
      }
      const node = api.node();
      if (!node) return;
      const key = lobby ? "keys" : "entries";
      const old = (Object as any)[key];
      (Object as any)[key] = function (obj: any) {
        if (!obj?.Chick) return old.call(this, obj);
        const blooks = obj;
        (Object as any)[key] = old;
        if (lobby) {
          node.setState({ unlocks: Object.keys(blooks) });
        } else {
          node.setState({ blookData: Object.fromEntries(Object.keys(blooks).map((b: string) => [b, 1])) });
        }
        return old.call(this, obj);
      };
      try {
        node.render?.() ?? node.forceUpdate?.();
      } catch {
        /* ignore */
      }
      api.log("All blooks unlocked. Choose one on the lobby.");
    },
  },
  {
    id: "global-sell-dupes",
    label: "Sell Duplicate Blooks",
    group: "Global",
    kind: "action",
    description: "Sells every duplicate blook you own on the /blooks page (keeps legendaries).",
    run(api) {
      if (!window.location.pathname.startsWith("/blooks")) {
        api.log("Run this on the /blooks page.");
        return;
      }
      const node = api.node();
      if (!node) return;
      const blookData = node.state?.blookData ?? {};
      const toSell: Record<string, number> = {};
      for (const blook of Object.keys(blookData)) {
        if (blookData[blook] > 1) toSell[blook] = blookData[blook] - 1;
      }
      const total = Object.values(toSell).reduce((a, b) => a + b, 0);
      if (!total) {
        api.log("No duplicates to sell.");
        return;
      }
      const keys = Object.keys(toSell);
      let sold = 0;
      keys.forEach((blook, i) => {
        setTimeout(() => {
          try {
            node.sellBlook(blook, toSell[blook]);
          } catch {
            /* ignore */
          }
          sold += toSell[blook];
          if (i === keys.length - 1) api.log("Sold " + sold + " duplicate blooks.");
        }, i * 250);
      });
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
      if (!window.location.hostname.toLowerCase().includes("blooket.com")) {
        api.log("Add Tokens works on blooket.com. Run it on play.blooket.com.");
        return;
      }
      void addTokensReward(tokens, xp, api.log);
    },
  },
  {
    id: "global-kick-player",
    label: "Kick Player",
    group: "Global",
    kind: "action",
    warn: true,
    inputs: [{ name: "player", label: "Player", type: "text" }],
    description: "Best-effort removal. Blooket has no host-kick protocol, so this tries every removal hook the game exposes and then deletes the player's node; it may not visibly work.",
    run(api, args) {
      const target = (args.player ?? "").trim();
      if (!target) {
        api.log("Enter a player name.");
        return;
      }
      if (!api.node()) {
        api.log("Game state not found yet. Wait for the game to load, then run again.");
        return;
      }
      const attempts = api.kickPlayer(target);
      if (!attempts.length) {
        api.log("No removal hooks or Firebase write path were available.");
        return;
      }
      api.log("Kick attempted for " + target + " (" + attempts.join(", ") + ").");
    },
  },
];
