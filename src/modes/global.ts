import type { CheatDef } from "../types";
import { typeAnswerHuman } from "../core/human";
import { clickAnswerContainerAt, clickFeedbackAdvance } from "../core/dom";

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
    description: "Answers using the game's own live state (reference approach). Humanizer only adds optional pacing \u2014 it can't block the answer.",
    run(api) {
      return api.interval(() => {
        const node = api.node();
        if (!node) return;
        const state = node.state ?? {};

        // Reference order: live state.question first, then props.client.question.
        const q = state.question ?? node.props?.client?.question ?? null;
        if (!q || !Array.isArray(q.answers) || !q.answers.length) return;

        if (q.qType !== "typing") {
          if (state.stage === "feedback" || state.feedback) {
            // Reference: click the continue element every tick.
            clickFeedbackAdvance();
          } else {
            // Reference: index of the first answer present in correctAnswers.
            let ind = -1;
            for (let i = 0; i < q.answers.length; i++) {
              let found = false;
              for (let j = 0; j < q.correctAnswers.length; j++) {
                if (q.answers[i] == q.correctAnswers[j]) {
                  found = true;
                  break;
                }
              }
              if (found) {
                ind = i;
                break;
              }
            }
            if (ind >= 0) clickAnswerContainerAt(ind, q.answers[ind]);
          }
        } else {
          // Reference: submit through the wrapper's own sendAnswer.
          void typeAnswerHuman(q.answers[0]);
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
    description: "Marks every answer in the set correct as questions load (reference approach: live arrays patched in place + forceUpdate).",
    run(api) {
      return api.interval(() => {
        const node = api.node();
        if (!node) return;
        // Reference: patch the live lists in place with the same answers array
        // (unconditional, exactly like the reference), then forceUpdate.
        const lists = [node.freeQuestions, node.questions, node.props?.client?.questions];
        for (const list of lists) {
          if (!Array.isArray(list)) continue;
          for (let i = 0; i < list.length; i++) {
            const q = list[i];
            if (q && Array.isArray(q.answers)) q.correctAnswers = q.answers;
          }
        }
        // Current question (reference order: state first).
        const cur = node.state?.question ?? node.props?.client?.question;
        if (cur && Array.isArray(cur.answers)) cur.correctAnswers = cur.answers;
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
        api.log("Add Tokens works on any blooket.com page (dashboard, lobby, or a live game).");
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
