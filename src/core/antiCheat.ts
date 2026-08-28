export function installAntiCheatPatch(): void {
  const fetchAny = window.fetch as any;
  if (!fetchAny || typeof fetchAny !== "function") return;
  if (fetchAny.call?.toString?.() !== "function call() { [native code] }") return;

  const nativeCall = fetchAny.call;
  fetchAny.call = function (thisArg: any, ...args: any[]) {
    const input = args[0];
    const url: string = typeof input === "string" ? input : input?.url ?? "";
    if (url.includes("s.blooket.com/rc")) return undefined;
    return nativeCall.apply(this, [thisArg, ...args]);
  };
}
