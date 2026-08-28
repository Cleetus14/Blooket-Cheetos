import type { CheatDef } from "../types";

export const monsterBrawlCheats: CheatDef[] = [
  {
    id: "brawl-max-abilities",
    label: "Max Abilities",
    group: "Monster Brawl",
    kind: "action",
    description: "Maxes every ability level.",
    run(api) {
      const node = api.node();
      if (!node) return;
      const s = node.state;
      const scene = node.game?.current?.config?.sceneConfig;
      if (!scene?.game?.events) return;
      for (const [ability, level] of Object.entries(s.abilities ?? {})) {
        for (let i = 0; i < 10 - (level as number); i++) {
          scene.game.events.emit("level up", ability, s.abilities[ability]++);
        }
      }
      const targets = [1, 3, 5, 10, 15, 25, 35];
      const next =
        targets.slice().sort((a, b) => Math.abs(a - s.level) - Math.abs(b - s.level))[0] - 1;
      scene.level = next;
      api.setState({ level: next });
    },
  },
  {
    id: "brawl-instant-kill",
    label: "Instant Kill",
    group: "Monster Brawl",
    kind: "action",
    description: "Sets every enemy to one hit point.",
    run(api) {
      const node = api.node();
      const world = node?.game?.current?.config?.sceneConfig?.physics?.world;
      if (!world) return;
      const colliders = (world.colliders?._active ?? []).filter((x: any) =>
        x.callbackContext?.toString?.()?.includes?.("dmgCd"),
      );
      for (const collider of colliders) {
        const enemies = collider.object2;
        if (!enemies) continue;
        const proto = enemies.classType?.prototype;
        if (proto && !proto.__cheetosPatched) {
          const start = proto.start;
          proto.start = function (this: any, ...a: any[]) {
            start.apply(this, a);
            this.hp = 1;
          };
          proto.__cheetosPatched = true;
        }
        enemies.children?.entries?.forEach?.((e: any) => {
          e.hp = 1;
        });
      }
    },
  },
  {
    id: "brawl-invincibility",
    label: "Invincibility",
    group: "Monster Brawl",
    kind: "action",
    description: "Disables damage from enemy colliders.",
    run(api) {
      const node = api.node();
      const world = node?.game?.current?.config?.sceneConfig?.physics?.world;
      if (!world) return;
      const colliders = (world.colliders?._active ?? []).filter(
        (x: any) =>
          x.callbackContext?.toString?.()?.includes?.("invulnerableTime") ||
          x.callbackContext?.toString?.()?.includes?.("dmgCd"),
      );
      for (const collider of colliders) collider.collideCallback = () => {};
    },
  },
];
