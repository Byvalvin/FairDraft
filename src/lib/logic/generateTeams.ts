import type { Player, Team } from "../../types/domain";
import { shuffleInPlace } from "../utils";

export type GeneratedTeams = {
  teams: Team[];
  playersById: Record<string, Player>;
};

export function generateTeamsV0(
  players: Player[],
  numTeams: number,
//   seed?: string
): GeneratedTeams {
  // Seed support later; for now seed is unused (still keep param for future)
  const list = [...players];
  shuffleInPlace(list);

  const teams: Team[] = Array.from({ length: numTeams }, (_, i) => ({
    id: `team_${i + 1}`,
    name: `Team ${i + 1}`,
    playerIds: [],
  }));

  // round-robin distribution
  for (let i = 0; i < list.length; i++) {
    teams[i % numTeams].playerIds.push(list[i].id);
  }

  const playersById: Record<string, Player> = {};
  for (const p of players) playersById[p.id] = p;

  return { teams, playersById };
}
