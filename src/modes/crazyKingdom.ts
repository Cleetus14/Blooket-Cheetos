import type { CheatDef } from "../types";

function appendStat(container: HTMLElement | undefined, text: string, color: string): void {
  if (!container) return;
  const el = document.createElement("div");
  el.className = "choiceESP";
  el.style.cssText = `font-size:24px;color:${color};font-weight:bolder;`;
  el.innerText = text;
  container.appendChild(el);
}

export const crazyKingdomCheats: CheatDef[] = [
  {
    id: "kingdom-max-stats",
    label: "Max Stats",
    group: "Crazy Kingdom",
    kind: "action",
    description: "Sets materials, people, happiness, and gold to 100.",
    run(api) {
      api.setState({ materials: 100, people: 100, happiness: 100, gold: 100 });
    },
  },
  {
    id: "kingdom-choice-esp",
    label: "Choice ESP",
    group: "Crazy Kingdom",
    kind: "toggle",
    description: "Shows what each guest choice affects.",
    run(api) {
      return api.interval(() => {
        const node = api.node();
        if (!node || node.state?.phase !== "choice") return;
        document.querySelectorAll(".choiceESP").forEach((e) => e.remove());

        const stats = ["materials", "people", "happiness", "gold"];
        const containers: Record<string, HTMLElement> = {};
        Array.from(document.querySelectorAll("[class*=statContainer]")).forEach((c, i) => {
          containers[stats[i]] = c as HTMLElement;
        });

        const guest = node.state.guest ?? {};
        for (const [stat, value] of Object.entries(guest.yes ?? {})) {
          appendStat(containers[stat], String(value), "rgb(75, 194, 46)");
        }
        for (const [stat, value] of Object.entries(guest.no ?? {})) {
          appendStat(containers[stat], String(value), "darkred");
        }
      }, 300);
    },
  },
  {
    id: "kingdom-skip-guest",
    label: "Skip Guest",
    group: "Crazy Kingdom",
    kind: "action",
    description: "Skips the current guest.",
    run(api) {
      api.node()?.nextGuest?.();
    },
  },
];
