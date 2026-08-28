import type { CheatDef } from "../types";

export const cafeCheats: CheatDef[] = [
  {
    id: "cafe-cash",
    label: "Set Cash",
    group: "Café",
    kind: "action",
    inputs: [{ name: "amount", label: "Cash", type: "number", defaultValue: "100000" }],
    run(api, args) {
      const amount = parseInt(args.amount, 10);
      if (!Number.isFinite(amount)) return;
      api.setState({ cafeCash: amount });
      api.setVal(`c/${api.client().name}/ca`, amount);
    },
  },
  {
    id: "cafe-stock",
    label: "Stock Food",
    group: "Café",
    kind: "action",
    description: "Maxes stock and level for all food.",
    run(api) {
      if (window.location.pathname !== "/cafe") return;
      const foods = api.state().foods;
      if (!Array.isArray(foods)) return;
      api.setState({ foods: foods.map((f: any) => ({ ...f, stock: 99, level: 5 })) });
    },
  },
  {
    id: "cafe-max-items",
    label: "Max Items",
    group: "Café",
    kind: "action",
    description: "Sets every owned item to the max amount.",
    run(api) {
      if (window.location.pathname !== "/cafe/shop") return;
      const items = api.state().items ?? {};
      const next: Record<string, number> = {};
      for (const key of Object.keys(items)) next[key] = 5;
      api.setState({ items: next });
    },
  },
  {
    id: "cafe-remove-customers",
    label: "Remove Customers",
    group: "Café",
    kind: "action",
    warn: true,
    description: "Kicks every customer out of the café.",
    run(api) {
      const node = api.node();
      const customers: any[] = node?.state?.customers ?? [];
      if (!Array.isArray(customers)) {
        api.log("No customers found.");
        return;
      }
      customers.forEach((customer, i) => {
        setTimeout(() => {
          try {
            if (customer?.blook) node.removeCustomer(i, true);
          } catch {
            /* ignore */
          }
        }, i * 250);
      });
      api.log("Removing " + customers.length + " customers.");
    },
  },
];
