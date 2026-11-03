type Listener = () => void;
let ready = false;
let apply: (() => Promise<void>) | undefined;
const listeners = new Set<Listener>();
export const subscribePwaUpdate = (listener: Listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const isPwaUpdateReady = () => ready;
export const getServerPwaUpdateReady = () => false;
export function offerPwaUpdate(update: () => Promise<void>) { apply = update; ready = true; for (const listener of listeners) listener(); }
export async function applyPwaUpdate() { if (apply) await apply(); }