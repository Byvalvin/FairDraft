import { DB } from "./DB";
import { newId } from "./utils";
import type { GenerationSettings } from "../types/gen";
import type { Preset } from "../types/domain";

export const MAX_PRESETS_FREE = 5;

export async function createPreset(
  name: string,
  settings: GenerationSettings
): Promise<Preset> {
  const total = await DB.presets.count();
  if (total >= MAX_PRESETS_FREE) {
    throw new Error("Free limit reached (5 presets).");
  }

  const now = Date.now();
  const preset: Preset = {
    id: newId("preset"),
    name: name.trim() || "Untitled",
    playerSetId: settings.playerSetId,
    numTeams: settings.numTeams,
    criteriaOrder: settings.criteriaOrder,
    missingHandling: {},
    createdAt: now,
    updatedAt: now,
  };

  await DB.presets.add(preset);
  return preset;
}
