import Dexie, { type Table } from "dexie";
import type { GeneratedResult, PlayerSet, Player, Preset } from "../types/domain";

export class FairDraftDB extends Dexie {
  players!: Table<Player, string>;
  playerSets!: Table<PlayerSet, string>;
  presets!: Table<Preset, string>;
  results!: Table<GeneratedResult, string>;

  constructor() {
    super("fairdraft");

    this.version(1).stores({
      players: "id, name, createdAt, updatedAt",
      playerSets: "id, name, createdAt, updatedAt",
      presets: "id, name, playerSetId, createdAt, updatedAt",
      results: "id, createdAt, isSaved",
    });
  }
}

export const DB = new FairDraftDB();
