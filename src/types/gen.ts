export type GenerationSettings = {
  playerSetId: string;      // Default for now
  numTeams: number;         // 2+
  criteriaOrder: string[];  // e.g. ["gender", "position"] (later includes "rating")
};
