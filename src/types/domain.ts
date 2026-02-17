export type Id = string;

export type CriterionValue =
  | { type: "number"; value: number }
  | { type: "category"; value: string };

export type Player = {
  id: Id;
  name: string;
  criteria: Record<string, CriterionValue>;
  createdAt: number;
  updatedAt: number;
};

export type PlayerSet = {
  id: Id;
  name: string;
  playerIds: Id[];
  createdAt: number;
  updatedAt: number;
};

export type MissingHandling = "allow_unknown" | "exclude";

export type Preset = {
  id: Id;
  name: string;
  playerSetId: Id;
  numTeams: number;
  criteriaOrder: string[];
  missingHandling: Record<string, MissingHandling>;
  createdAt: number;
  updatedAt: number;
};

export type Team = {
  id: Id;
  name?: string;
  playerIds: Id[];
};

export type Fairness = {
  score: number; // 0-100
  breakdown: Record<string, number>;
  notes: string[];
};

export type GeneratedResult = {
  id: Id;
  createdAt: number;
  seed: string;

  presetSnapshot: Preset;
  playerSetSnapshot: PlayerSet;
  playersSnapshot: Player[];

  teams: Team[];
  fairness: Fairness;

  isSaved: boolean;
};
