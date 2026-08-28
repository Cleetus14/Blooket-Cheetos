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
    kind: "toggle",
    description: "Sets every enemy to one hit point.",
    run(api) {
      let patchedProto: any = null;
      let originalStart: any = null;
      const handle = api.interval(() => {
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
          if (proto && !patchedProto) {
            originalStart = proto.start;
            patchedProto = proto;
            proto.start = function (this: any, ...a: any[]) {
              originalStart.apply(this, a);
              this.hp = 1;
            };
          }
          enemies.children?.entries?.forEach?.((e: any) => {
            e.hp = 1;
          });
        }
      }, 300);
      return {
        running: () => handle.running(),
        stop() {
          handle.stop();
          if (patchedProto && originalStart) patchedProto.start = originalStart;
        },
      };
    },
  },
  {
    id: "brawl-invincibility",
    label: "Invincibility",
    group: "Monster Brawl",
    kind: "toggle",
    description: "Disables damage from enemy colliders.",
    run(api) {
      return api.interval(() => {
        const node = api.node();
        const world = node?.game?.current?.config?.sceneConfig?.physics?.world;
        if (!world) return;
        const colliders = (world.colliders?._active ?? []).filter(
          (x: any) =>
            x.callbackContext?.toString?.()?.includes?.("invulnerableTime") ||
            x.callbackContext?.toString?.()?.includes?.("dmgCd"),
        );
        for (const collider of colliders) collider.collideCallback = () => {};
      }, 300);
    },
  },
  {
    id: "brawl-kill-enemies",
    label: "Kill Enemies",
    group: "Monster Brawl",
    kind: "action",
    description: "Deals lethal damage to every enemy on the map.",
    run(api) {
      const node = api.node();
      const bodies = node?.game?.current?.config?.sceneConfig?.physics?.world?.bodies?.entries;
      if (!bodies) return;
      bodies.forEach((x: any) => x?.gameObject?.receiveDamage?.(x.gameObject.hp, 1));
    },
  },
  {
    id: "brawl-next-level",
    label: "Next Level",
    group: "Monster Brawl",
    kind: "action",
    description: "Spawns the XP you need to level up.",
    run(api) {
      const node = api.node();
      const scene = node?.game?.current?.config?.sceneConfig;
      const collider = scene?.physics?.world?.colliders?._active?.find((x: any) =>
        x.collideCallback?.toString().includes('emit("xp'),
      );
      if (!collider) return;
      const player = collider.object1;
      const xp = collider.object2;
      xp.get().spawn(
        player.x,
        player.y,
        ((e: number) =>
          1 === e ? 1 : e < 5 ? 5 : e < 10 ? 10 : e < 20 ? 20 : e < 30 ? 30 : e < 40 ? 40 : e < 50 ? 50 : 100)(
          node.state.level,
        ) - node.xp,
      );
    },
  },
  {
    id: "brawl-double-xp",
    label: "Double Enemy XP",
    group: "Monster Brawl",
    kind: "action",
    description: "Doubles the XP every enemy drops.",
    run(api) {
      const node = api.node();
      const colliders =
        node?.game?.current?.config?.sceneConfig?.physics?.world?.colliders?._active?.filter(
          (x: any) => x.callbackContext?.toString?.()?.includes?.("dmgCd"),
        ) ?? [];
      for (const collider of colliders) {
        const enemies = collider.object2;
        if (!enemies?.classType?.prototype) continue;
        const start = enemies.classType.prototype.start;
        enemies.classType.prototype.start = function (this: any, ...a: any[]) {
          start.apply(this, a);
          this.val *= 2;
        };
        enemies.children?.entries?.forEach((e: any) => {
          e.val *= 2;
        });
      }
    },
  },
  {
    id: "brawl-invincibility",
    label: "Invincibility",
    group: "Monster Brawl",
    kind: "toggle",
    description: "Disables every damage collider so nothing can hurt you.",
    run(api) {
      let patched: Array<{ collider: any; original: any }> = [];
      const handle = api.interval(() => {
        if (patched.length) return;
        const node = api.node();
        const colliders =
          node?.game?.current?.config?.sceneConfig?.physics?.world?.colliders?._active ?? [];
        for (const collider of colliders) {
          const cb = collider?.collideCallback?.toString?.() ?? "";
          if (cb.includes("invulnerableTime") || cb.includes("dmgCd")) {
            patched.push({ collider, original: collider.collideCallback });
            collider.collideCallback = () => {};
          }
        }
      }, 300);
      return {
        running: () => handle.running(),
        stop() {
          handle.stop();
          patched.forEach(({ collider, original }) => {
            collider.collideCallback = original;
          });
          patched = [];
        },
      };
    },
  },
  {
    id: "brawl-half-speed",
    label: "Half Enemy Speed",
    group: "Monster Brawl",
    kind: "action",
    description: "Halves the movement speed of every enemy.",
    run(api) {
      const node = api.node();
      const colliders =
        node?.game?.current?.config?.sceneConfig?.physics?.world?.colliders?._active?.filter(
          (x: any) => x.callbackContext?.toString?.()?.includes?.("dmgCd"),
        ) ?? [];
      for (const collider of colliders) {
        const enemies = collider.object2;
        if (!enemies?.classType?.prototype) continue;
        const start = enemies.classType.prototype.start;
        enemies.classType.prototype.start = function (this: any, ...a: any[]) {
          start.apply(this, a);
          this.speed *= 0.5;
        };
        enemies.children?.entries?.forEach((e: any) => {
          e.speed *= 0.5;
        });
      }
    },
  },
  {
    id: "brawl-reset-health",
    label: "Reset Health",
    group: "Monster Brawl",
    kind: "action",
    description: "Respawns you at full health.",
    run(api) {
      const events = api.node()?.game?.current?.events?._events;
      events?.respawn?.fn?.();
    },
  },
  {
    id: "brawl-magnet",
    label: "Magnet",
    group: "Monster Brawl",
    kind: "action",
    description: "Pulls all XP to you for the magnet duration.",
    run(api) {
      const node = api.node();
      const collider = node?.game?.current?.config?.sceneConfig?.physics?.world?.colliders?._active?.find(
        (x: any) => x.collideCallback?.toString().includes("magnetTime"),
      );
      if (!collider) return;
      collider.collideCallback(
        { active: true },
        { active: true, setActive() {}, setVisible() {} },
      );
    },
  },
  {
    id: "brawl-remove-obstacles",
    label: "Remove Obstacles",
    group: "Monster Brawl",
    kind: "action",
    description: "Destroys every obstacle on the map.",
    run(api) {
      const node = api.node();
      const bodies = node?.game?.current?.config?.sceneConfig?.physics?.world?.bodies?.entries;
      if (!bodies) return;
      bodies.forEach((body: any) => {
        try {
          if (body.gameObject?.frame?.texture?.key?.includes("obstacle")) {
            body.gameObject.destroy();
          }
        } catch {
          /* ignore */
        }
      });
    },
  },
];
