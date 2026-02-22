import type { Player, Team } from "../../types/domain";
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