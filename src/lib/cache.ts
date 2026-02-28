type CacheValue = unknown;

const cache = new Map<string, CacheValue>();

export function getCache<T>(key: string): T | null {
  return (cache.get(key) as T) ?? null;
}

export function setCache<T>(key: string, value: T) {
  cache.set(key, value);
}
