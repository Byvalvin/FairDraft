import { DB } from "./DB";
import { newId } from "./utils";
import type { PlayerSet } from "../types/domain";

export const DEFAULT_PLAYERSET_ID = "playerset_default";
export const MAX_CUSTOM_PLAYERSETS_FREE = 5;

export async function ensureDefaultPlayerSet(): Promise<PlayerSet> {
  const existing = await DB.playerSets.get(DEFAULT_PLAYERSET_ID);
  if (existing) return existing;

  const now = Date.now();
  const created: PlayerSet = {
    id: DEFAULT_PLAYERSET_ID,
    name: "Default",
    playerIds: [],
    createdAt: now,
    updatedAt: now,
  };

  await DB.playerSets.add(created);
  return created;
}

export async function addPlayerToDefaultSet(playerId: string) {
  await ensureDefaultPlayerSet();

  await DB.playerSets.update(DEFAULT_PLAYERSET_ID, (set) => {
    if (!set) return;
    if (!set.playerIds.includes(playerId)) set.playerIds.push(playerId);
    set.updatedAt = Date.now();
  });
}

export async function removePlayerFromDefaultSet(playerId: string) {
  await ensureDefaultPlayerSet();

  await DB.playerSets.update(DEFAULT_PLAYERSET_ID, (set) => {
    if (!set) return;
    set.playerIds = set.playerIds.filter((id) => id !== playerId);
    set.updatedAt = Date.now();
  });
}

// ------------------
export async function createPlayerSet(name: string): Promise<PlayerSet> {
  await ensureDefaultPlayerSet();
  const total = await DB.playerSets.count();
  const maxTotal = 1 + MAX_CUSTOM_PLAYERSETS_FREE;
  if (total >= maxTotal) {
    throw new Error("Free limit reached (5 custom sets).");
  }

  const now = Date.now();
  const set: PlayerSet = {
    id: newId("playerset"),
    name: name.trim() || "Untitled",
    playerIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await DB.playerSets.add(set);
  return set;
}

export async function togglePlayerInSet(playerSetId: string, playerId: string) {
  await DB.playerSets.update(playerSetId, (set) => {
    if (!set) return;
    const has = set.playerIds.includes(playerId);
    set.playerIds = has
      ? set.playerIds.filter((id) => id !== playerId)
      : [...set.playerIds, playerId];
    set.updatedAt = Date.now();
  });
}

export async function removePlayerFromAllSets(playerId: string) {
  const sets = await DB.playerSets.toArray();
  await DB.transaction("rw", DB.playerSets, async () => {
    for (const s of sets) {
      if (s.playerIds.includes(playerId)) {
        await DB.playerSets.update(s.id, (set) => {
          if (!set) return;
          set.playerIds = set.playerIds.filter((id) => id !== playerId);
          set.updatedAt = Date.now();
        });
      }
    }
  });
}
