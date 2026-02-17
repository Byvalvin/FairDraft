import { DB } from "./DB";
// import { newId } from "./utils";
import type { PlayerSet } from "../types/domain";

export const DEFAULT_PLAYERSET_ID = "playerset_default";

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

