import { DB } from "./DB";
import type { GeneratedResult } from "../types/domain";

export const MAX_RESULTS_FREE = 20;

export async function saveResult(result: GeneratedResult): Promise<void> {
  const total = await DB.results.count();
  if (total >= MAX_RESULTS_FREE) {
    throw new Error("Free limit reached (20 saved results).");
  }
  await DB.results.add(result);
}
