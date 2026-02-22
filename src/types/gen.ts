export type GenerationSettings = {
  playerSetId: string;      // Default for now
  numTeams: number;         // 2+
  criteriaOrder: string[];  // e.g. ["gender", "position"] (later includes "rating")
  epsilon: number; // tolerance for numeric balancing (0 = strict)
};
