import type { CheatDef } from "../types";

export const towerOfDoomCheats: CheatDef[] = [
  {
    id: "doom-max-stats",
    label: "Max Stats",
    group: "Tower of Doom",
    kind: "action",
    description: "Maxes your card stats during attribute selection.",
    run(api) {
      const node = api.node();
      if (!node || node.state?.phase !== "select") return;
      const card = node.state.myCard ?? {};
      api.setState({ myCard: { ...card, strength: 20, charisma: 20, wisdom: 20 } });
    },
  },
  {
    id: "doom-coins",
    label: "Set Coins",
    group: "Tower of Doom",
    kind: "action",
    inputs: [{ name: "amount", label: "Coins", type: "number", defaultValue: "100000" }],
    description: "Sets your coins while in battle.",
    run(api, args) {
      if (window.location.pathname !== "/tower/battle") return;
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount)) return;
      api.node()?.props?.setTowerCoins?.(amount);
    },
  },
  {
    id: "doom-max-health",
    label: "Max Health",
    group: "Tower of Doom",
    kind: "action",
    description: "Restores your health while in battle.",
    run(api) {
      if (window.location.pathname !== "/tower/battle") return;
      api.setState({ myHealth: 100, myLife: 100 });
    },
  },
  {
    id: "doom-fill-deck",
    label: "Fill Deck",
    group: "Tower of Doom",
    kind: "action",
    description: "Fills your deck with every artifact and maxed card on the map.",
    run(api) {
      if (window.location.pathname !== "/tower/map") return;
      const tower = api.node()?.props?.tower;
      if (!tower) return;
      tower.artifacts =
        "Medical Kit|Fury Relic|Survival Guide|Steel Socks|Piggy Bank|Lucky Feather|Coupon|Cheese|Tasty Egg|Training Weights|Mighty Shield|Toxic Waste|Lifeline Totem|Cursed Hourglass|Band-Aid|Elder Coins|Captain's Anchor|Chess Pieces|Pink Hippo|Anorak's Wizard Cap|Dave's Doggo|Anubis' Obelisk|Farm Tractor|Magic Seedling|Just A Bone|Cozy Igloo|King's Crown|Sacred Scroll".split(
          "|",
        );
      tower.cards =
        "Chick,\u{1F33D}|Chicken,\u{1F33D}|Cow,\u{1F33D}|Goat,\u{1F33D}|Horse,\u{1F33D}|Pig,\u{1F33D}|Sheep,\u{1F33D}|Duck,\u{1F33D}|Dog,\u{1F33D}|Cat,\u{1F43E}|Rabbit,\u{1F43E}|Goldfish,\u{1F43E}|Hamster,\u{1F43E}|Turtle,\u{1F43E}|Kitten,\u{1F43E}|Puppy,\u{1F43E}|Bear,\u{1F33E}|Moose,\u{1F33E}|Fox,\u{1F33E}|Raccoon,\u{1F33E}|Squirrel,\u{1F33E}|Owl,\u{1F33E}|Hedgehog,\u{1F33E}|Baby Penguin,\u{2744}\u{FE0F}|Penguin,\u{2744}\u{FE0F}|Arctic Fox,\u{2744}\u{FE0F}|Snowy Owl,\u{2744}\u{FE0F}|Polar Bear,\u{2744}\u{FE0F}|Arctic Hare,\u{2744}\u{FE0F}|Seal,\u{2744}\u{FE0F}|Walrus,\u{2744}\u{FE0F}|Tiger,\u{1F334}|Panther,\u{1F334}|Cockatoo,\u{1F334}|Orangutan,\u{1F334}|Anaconda,\u{1F334}|Macaw,\u{1F334}|Jaguar,\u{1F334}|Capuchin,\u{1F334}|Toucan,\u{1F334}|Parrot,\u{1F334}|Elf,\u{2694}\u{FE0F}|Witch,\u{2694}\u{FE0F}|Wizard,\u{2694}\u{FE0F}|Fairy,\u{2694}\u{FE0F}|Slime Monster,\u{2694}\u{FE0F}|Jester,\u{2694}\u{FE0F}|Dragon,\u{2694}\u{FE0F}|Unicorn,\u{2694}\u{FE0F}|Queen,\u{2694}\u{FE0F}|King,\u{2694}\u{FE0F}|Snow Globe,\u{2603}\u{FE0F}|Holiday Gift,\u{2603}\u{FE0F}|Hot Chocolate,\u{2603}\u{FE0F}|Gingerbread Man,\u{2603}\u{FE0F}|Gingerbread House,\u{2603}\u{FE0F}|Holiday Wreath,\u{2603}\u{FE0F}|Snowman,\u{2603}\u{FE0F}|Santa Claus,\u{2603}\u{FE0F}|Two of Spades,\u{1F3F0}|Eat Me,\u{1F3F0}|Drink Me,\u{1F3F0}|Alice,\u{1F3F0}|Queen of Hearts,\u{1F3F0}|Dormouse,\u{1F3F0}|White Rabbit,\u{1F3F0}|Cheshire Cat,\u{1F3F0}|Caterpillar,\u{1F3F0}|Mad Hatter,\u{1F3F0}|King of Hearts,\u{1F3F0}".split(
          "|",
        )
        .map((x) => {
          const [blook, c] = x.split(",");
          return { strength: 20, charisma: 20, wisdom: 20, class: c, blook };
        });
    },
  },
  {
    id: "doom-max-cards",
    label: "Max Cards",
    group: "Tower of Doom",
    kind: "action",
    description: "Sets every card in your deck to max stats on the map.",
    run(api) {
      if (window.location.pathname !== "/tower/map") return;
      const cards = api.node()?.props?.tower?.cards;
      if (!Array.isArray(cards)) return;
      cards.forEach((card: any) => {
        card.strength = 20;
        card.charisma = 20;
        card.wisdom = 20;
      });
    },
  },
  {
    id: "doom-min-enemy",
    label: "Min Enemy",
    group: "Tower of Doom",
    kind: "action",
    description: "Zeros the enemy card's stats during selection. Messes with your opponent.",
    run(api) {
      const node = api.node();
      if (!node || node.state?.phase !== "select") return;
      api.setState({
        enemyCard: { ...(node.state.enemyCard ?? {}), strength: 0, charisma: 0, wisdom: 0 },
      });
    },
  },
];
