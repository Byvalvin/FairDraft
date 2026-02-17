export function newId(prefix: string) {
  // good enough for offline local IDs
  return `${prefix}_${crypto.randomUUID()}`;
}
