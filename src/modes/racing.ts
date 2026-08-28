import type { CheatDef } from "../types";

export const racingCheats: CheatDef[] = [
  {
    id: "racing-instant-win",
    label: "Instant Win",
    group: "Racing",
    kind: "action",
    description: "Sets your progress to the goal and finishes the race.",
    run(api) {
      const node = api.node();
      const goal = node?.state?.goalAmount ?? node?.props?.client?.amount;
      if (!goal) {
        api.log("Goal not found - are you in a race?");
        return;
      }
      api.setState({ progress: goal });
      api.setVal(`c/${api.client().name}/pr`, goal);
      api.log("Progress set to " + goal + ".");
    },
  },
  {
    id: "racing-set-progress",
    label: "Set Progress",
    group: "Racing",
    kind: "action",
    inputs: [{ name: "left", label: "Questions left", type: "number", defaultValue: "0" }],
    description: "Sets how many questions remain (0 = finish line).",
    run(api, args) {
      const left = parseInt(args.left, 10);
      if (!Number.isFinite(left) || left < 0) {
        api.log("Enter a valid number of questions left.");
        return;
      }
      const node = api.node();
      const amount = node?.props?.client?.amount ?? node?.state?.goalAmount;
      if (!amount) {
        api.log("Race state not found.");
        return;
      }
      const progress = amount - left;
      if (progress < 0) {
        api.log("More questions left than the race has.");
        return;
      }
      api.setState({ progress });
      api.setVal(`c/${api.client().name}/pr`, progress);
      api.log("Progress set to " + progress + ".");
    },
  },
];
