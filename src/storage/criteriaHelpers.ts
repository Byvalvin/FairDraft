import { DB } from "./DB";
import { newId } from "./utils";
import type { CriterionDef } from "../types/domain";

export const MAX_CRITERIA_FREE = 3;

const DEFAULT_CRITERIA: CriterionDef[] = [
  {
    id: "rating",
    name: "Rating",
    type: "number",
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "position",
    name: "Position",
    type: "category",
    options: ["Goalkeeper", "Defense", "Midfield", "Forward"],
    createdAt: 0,
    updatedAt: 0,
  },
];

export async function ensureDefaultCriteria(): Promise<CriterionDef[]> {
  const existing = await DB.criteria.toArray();
  if (existing.length > 0) return existing;

  const now = Date.now();
  const rows = DEFAULT_CRITERIA.map((c) => ({
    ...c,
    createdAt: now,
    updatedAt: now,
  }));

  await DB.criteria.bulkAdd(rows);
  return rows;
}

export async function createCriterion(
  name: string,
  type: "number" | "category",
  options?: string[]
): Promise<CriterionDef> {
  const total = await DB.criteria.count();
  if (total >= MAX_CRITERIA_FREE) {
    throw new Error("Free limit reached (2 criteria).");
  }

  const now = Date.now();
  const row: CriterionDef = {
    id: newId("criterion"),
    name: name.trim() || "Untitled",
    type,
    options: type === "category" ? options ?? [] : undefined,
    createdAt: now,
    updatedAt: now,
  };
  await DB.criteria.add(row);
  return row;
}

export async function updateCriterion(
  id: string,
  updates: Partial<Omit<CriterionDef, "id" | "createdAt">>
) {
  await DB.criteria.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteCriterion(id: string) {
  await DB.criteria.delete(id);
}
