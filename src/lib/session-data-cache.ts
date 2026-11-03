/** Browser-owned cache: isolated by identity, shared by navigation, no timer refresh. */
export class SessionDataCache {
  private values = new Map<string, unknown>();
  private pending = new Map<string, Promise<unknown>>();
  private revisions = new Map<string, number>();
  private epoch = 0;
  private identity = "";

  useSession(identity: string) {
    if (identity === this.identity) return;
    this.identity = identity;
    this.clear();
  }

  clear() {
    this.epoch++;
    this.values.clear();
    this.pending.clear();
    this.revisions.clear();
  }

  invalidate(prefix: string) {
    const keys = new Set([...this.values.keys(), ...this.pending.keys(), ...this.revisions.keys()]);
    for (const key of keys) {
      if (!key.startsWith(prefix)) continue;
      this.revisions.set(key, (this.revisions.get(key) ?? 0) + 1);
      this.values.delete(key);
      this.pending.delete(key);
    }
  }

  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.values.has(key)) return this.values.get(key) as T;
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;
    const epoch = this.epoch;
    const revision = this.revisions.get(key) ?? 0;
    const promise = fetcher().then((value) => {
      if (epoch === this.epoch && revision === (this.revisions.get(key) ?? 0)) this.values.set(key, value);
      return value;
    }).finally(() => {
      if (this.pending.get(key) === promise) this.pending.delete(key);
    });
    this.pending.set(key, promise);
    return promise;
  }
}

export const sessionDataCache = new SessionDataCache();