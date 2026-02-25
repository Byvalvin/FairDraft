import type { CriterionDef, Player, Team } from "../../types/domain";
import { shuffleInPlace } from "../utils";

export type GeneratedTeams = {
  teams: Team[];
  playersById: Record<string, Player>;
};

function readNumberCriterion(p: Player, key: string): number | null {
  const v = p.criteria[key];
  return v?.type === "number" ? v.value : null;
}

function buildPlayersById(players: Player[]): Record<string, Player> {
  const playersById: Record<string, Player> = {};
  for (const p of players) playersById[p.id] = p;
  return playersById;
}

type NumericStat = {
  key: string;
  min: number;
  max: number;
  range: number;
  mean: number;
  stdev: number;
  epsNorm: number;
};

function computeNumericStats(players: Player[], key: string): NumericStat | null {
  const values: number[] = [];
  for (const p of players) {
    const v = p.criteria[key];
    if (v?.type === "number") values.push(v.value);
  }
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range <= 0) return null;
  const normalized = values.map((v) => (v - min) / range);
  const mean = normalized.reduce((a, b) => a + b, 0) / normalized.length;
  const variance =
    normalized.reduce((a, b) => a + (b - mean) ** 2, 0) / normalized.length;
  const stdev = Math.sqrt(variance);
  const epsNorm = Math.max(0.08, stdev);
  return { key, min, max, range, mean, stdev, epsNorm };
}

export function generateTeamsV0(players: Player[], numTeams: number): GeneratedTeams {
  const list = [...players];
  shuffleInPlace(list);

  const teams: Team[] = Array.from({ length: numTeams }, (_, i) => ({
    id: `team_${i + 1}`,
    name: `Team ${i + 1}`,
    playerIds: [],
  }));

  for (let i = 0; i < list.length; i++) {
    teams[i % numTeams].playerIds.push(list[i].id);
  }

  return { teams, playersById: buildPlayersById(players) };
}

/**
 * Phase 1: Rating-balanced teams (greedy)-ISH.
 * - Sort by rating desc (missing rating uses fallbackRating)
 * - Assign each player to the team with lowest current rating sum
 */
export function generateTeamsV1_numberGreedy(
  players: Player[],
  numTeams: number,
  numberKey: string,
  options?: {
    fallbackValue?: number; // used when player is missing this number criterion
    epsilon?: number;       // tolerance window for choosing among near-best teams
    rng?: () => number;     // injectable for testing / future seeding
  }
): GeneratedTeams {
  const fallbackValue = options?.fallbackValue ?? 50;
  const epsilon = options?.epsilon ?? 0;
  const rng = options?.rng ?? Math.random;

  const list = [...players];

  const valueOf = (p: Player) => readNumberCriterion(p, numberKey) ?? fallbackValue;

  // Sort high->low, break ties randomly so reroll can vary
  list.sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    if (vb !== va) return vb - va;
    return rng() < 0.5 ? -1 : 1;
  });

  const teams: Team[] = Array.from({ length: numTeams }, (_, i) => ({
    id: `team_${i + 1}`,
    name: `Team ${i + 1}`,
    playerIds: [],
  }));

  const sums = Array.from({ length: numTeams }, () => 0);

  for (const p of list) {
    const v = valueOf(p);

    // Find current minimum sum
    let min = sums[0];
    for (let i = 1; i < sums.length; i++) min = Math.min(min, sums[i]);

    // Choose randomly among teams whose sum is within min + epsilon
    const candidates: number[] = [];
    for (let i = 0; i < sums.length; i++) {
      if (sums[i] <= min + epsilon) candidates.push(i);
    }

    const chosen = candidates[Math.floor(rng() * candidates.length)];
    teams[chosen].playerIds.push(p.id);
    sums[chosen] += v;
  }

  return { teams, playersById: buildPlayersById(players) };
}

/**
 * Phase 2: Multi-criteria (numeric + category) soft balancing.
 * - Uses weighted penalty by criteria order
 * - Normalizes numeric criteria (0..1) and uses epsNorm as tolerance
 */
export function generateTeamsV2_multiCriteria(
  players: Player[],
  numTeams: number,
  criteriaOrder: string[],
  criteriaDefs: CriterionDef[],
  options?: {
    rng?: () => number;
  }
): GeneratedTeams {
  const rng = options?.rng ?? Math.random;
  const list = [...players];

  const defsById = new Map(criteriaDefs.map((d) => [d.id, d]));
  const orderedDefs = criteriaOrder
    .map((id) => defsById.get(id))
    .filter(Boolean) as CriterionDef[];

  const numericStats = new Map<string, NumericStat>();
  for (const d of orderedDefs) {
    if (d.type !== "number") continue;
    const stat = computeNumericStats(players, d.id);
    if (stat) numericStats.set(d.id, stat);
  }

  // Build caps for the top category criterion to enforce near-even splits
  const categoryCapsByKey = new Map<string, Record<string, number[]>>();
  const capTeamsForCategory = (
    counts: Record<string, number>,
    capPad: number
  ) => {
    const caps: Record<string, number[]> = {};
    for (const [value, total] of Object.entries(counts)) {
      const base = Math.floor(total / numTeams);
      const extra = total % numTeams;
      const capsForTeams = Array.from({ length: numTeams }, () => base + capPad);
      const indices = Array.from({ length: numTeams }, (_, i) => i);
      // Shuffle indices so extra slots are distributed without bias
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      for (let i = 0; i < extra; i++) {
        capsForTeams[indices[i]] += 1;
      }
      caps[value] = capsForTeams;
    }
    return caps;
  };
  orderedDefs.forEach((d, idx) => {
    if (d.type !== "category") return;
    const counts: Record<string, number> = {};
    for (const p of players) {
      const v = p.criteria[d.id];
      if (v?.type !== "category") continue;
      counts[v.value] = (counts[v.value] ?? 0) + 1;
    }
    if (Object.keys(counts).length === 0) return;
    const capPad = idx === 0 ? 0 : 1; // top category strict, others soft
    categoryCapsByKey.set(d.id, capTeamsForCategory(counts, capPad));
  });

  const weightOf = (idx: number) => 1 / (idx + 1);

  const scoreOf = (p: Player) => {
    let sum = 0;
    orderedDefs.forEach((d, idx) => {
      if (d.type !== "number") return;
      const stat = numericStats.get(d.id);
      if (!stat) return;
      const v = readNumberCriterion(p, d.id);
      if (v == null) return;
      const norm = (v - stat.min) / stat.range;
      sum += weightOf(idx) * norm;
    });
    return sum;
  };

  // Sort by composite numeric score (desc) to reduce randomness on strong players
  list.sort((a, b) => {
    const sa = scoreOf(a);
    const sb = scoreOf(b);
    if (sb !== sa) return sb - sa;
    return rng() < 0.5 ? -1 : 1;
  });

  const teams: Team[] = Array.from({ length: numTeams }, (_, i) => ({
    id: `team_${i + 1}`,
    name: `Team ${i + 1}`,
    playerIds: [],
  }));

  const maxTeamSize = Math.ceil(players.length / numTeams);

  const teamNumSums: Record<string, number[]> = {};
  const teamCatCounts: Record<string, Array<Record<string, number>>> = {};

  for (const d of orderedDefs) {
    if (d.type === "number") {
      teamNumSums[d.id] = Array.from({ length: numTeams }, () => 0);
    } else {
      teamCatCounts[d.id] = Array.from({ length: numTeams }, () => ({}));
    }
  }

  const totalsByKey: Record<string, number> = {};
  const totalsByKeyValue: Record<string, Record<string, number>> = {};
  for (const d of orderedDefs) {
    if (d.type === "number") {
      const stat = numericStats.get(d.id);
      if (!stat) continue;
      let total = 0;
      for (const p of players) {
        const v = readNumberCriterion(p, d.id);
        if (v == null) continue;
        total += (v - stat.min) / stat.range;
      }
      totalsByKey[d.id] = total;
    } else {
      const counts: Record<string, number> = {};
      for (const p of players) {
        const v = p.criteria[d.id];
        if (v?.type !== "category") continue;
        counts[v.value] = (counts[v.value] ?? 0) + 1;
      }
      totalsByKeyValue[d.id] = counts;
    }
  }

  for (const p of list) {
    const penaltiesByCriterion: number[][] = orderedDefs.map(
      () => Array.from({ length: numTeams }, () => 0)
    );

    for (let t = 0; t < numTeams; t++) {
      orderedDefs.forEach((d, idx) => {
        if (d.type === "number") {
          const stat = numericStats.get(d.id);
          if (!stat) return;
          const v = readNumberCriterion(p, d.id);
          if (v == null) return;
          const norm = (v - stat.min) / stat.range;
          const target = (totalsByKey[d.id] ?? 0) / numTeams;
          if (target <= 0) return;
          const current = teamNumSums[d.id][t];
          const diff = Math.abs(current + norm - target);
          const penalty = diff / target;
          penaltiesByCriterion[idx][t] = penalty;
        } else {
          const v = p.criteria[d.id];
          if (v?.type !== "category") return;
          const counts = totalsByKeyValue[d.id] ?? {};
          const target = (counts[v.value] ?? 0) / numTeams;
          if (target <= 0) return;
          const current = teamCatCounts[d.id][t][v.value] ?? 0;
          const diff = Math.abs(current + 1 - target);
          const penalty = diff / target;
          penaltiesByCriterion[idx][t] = penalty;
        }
      });
    }

    // Lexicographic priority: filter by best score per criterion in order
    let candidates: number[] = [];
    for (let i = 0; i < numTeams; i++) {
      if (teams[i].playerIds.length >= maxTeamSize) continue;
      candidates.push(i);
    }
    for (let idx = 0; idx < orderedDefs.length; idx++) {
      if (candidates.length <= 1) break;
      const d = orderedDefs[idx];
      let min = Number.POSITIVE_INFINITY;
      for (const t of candidates) {
        if (d.type === "category") {
          const capsForKey = categoryCapsByKey.get(d.id);
          const v = p.criteria[d.id];
          if (capsForKey && v?.type === "category") {
            const cap = capsForKey[v.value]?.[t];
            const current = teamCatCounts[d.id][t][v.value] ?? 0;
            if (cap != null && current >= cap) continue;
          }
        }
        min = Math.min(min, penaltiesByCriterion[idx][t]);
      }
      let tolerance = 0;
      if (d.type === "number") {
        const stat = numericStats.get(d.id);
        tolerance = stat?.epsNorm ?? 0;
      }
      candidates = candidates.filter(
        (t) => {
          if (d.type === "category") {
            const capsForKey = categoryCapsByKey.get(d.id);
            const v = p.criteria[d.id];
            if (capsForKey && v?.type === "category") {
              const cap = capsForKey[v.value]?.[t];
              const current = teamCatCounts[d.id][t][v.value] ?? 0;
              if (cap != null && current >= cap) return false;
            }
          }
          return penaltiesByCriterion[idx][t] <= min + tolerance;
        }
      );
    }
    if (candidates.length === 0) {
      for (let i = 0; i < numTeams; i++) {
        if (teams[i].playerIds.length < maxTeamSize) candidates.push(i);
      }
    }
    const chosen = candidates[Math.floor(rng() * candidates.length)];
    teams[chosen].playerIds.push(p.id);

    // Update running tallies
    orderedDefs.forEach((d) => {
      if (d.type === "number") {
        const stat = numericStats.get(d.id);
        if (!stat) return;
        const v = readNumberCriterion(p, d.id);
        if (v == null) return;
        const norm = (v - stat.min) / stat.range;
        teamNumSums[d.id][chosen] += norm;
      } else {
        const v = p.criteria[d.id];
        if (v?.type !== "category") return;
        const current = teamCatCounts[d.id][chosen][v.value] ?? 0;
        teamCatCounts[d.id][chosen][v.value] = current + 1;
      }
    });
  }

  return { teams, playersById: buildPlayersById(players) };
}
