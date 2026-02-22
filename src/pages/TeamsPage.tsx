import { useState } from "react";
import type { GenerationSettings } from "../types/gen";
import type { Player } from "../types/domain";
import type { GeneratedTeams } from "../lib/logic/generateTeams";

type Props = {
  settings: GenerationSettings;
  lastGenerated: GeneratedTeams | null;
  onReroll: () => Promise<void>;
  onGoToSetup: () => void;
};

function readCriterion(p: Player, key: string): string | number | null {
  const v = p.criteria[key];
  if (!v) return null;
  if (v.type === "category") return v.value;
  if (v.type === "number") return v.value;
  return null;
}

function summarizeTeam(players: Player[], key: string) {
  const values = players
    .map((p) => readCriterion(p, key))
    .filter((v) => v !== null) as Array<string | number>;

  if (values.length === 0) return { kind: "empty" as const };

  const allNumbers = values.every((v) => typeof v === "number");
  if (allNumbers) {
    const nums = values as number[];
    const sum = nums.reduce((a, b) => a + b, 0);
    const avg = sum / nums.length;
    return { kind: "number" as const, count: nums.length, avg, sum };
  }

  const counts: Record<string, number> = {};
  for (const v of values) {
    const k = String(v);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return { kind: "category" as const, counts };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type FairnessDetails =
  | { kind: "none" }
  | {
      kind: "number";
      key: string;
      fairness: number; // 0..100
      spread: number;
      gapPct: number;
      minSum: number;
      maxSum: number;
      avgSum: number;
      missingCount: number;
      totalPlayers: number;
      fallbackValue: number;
    };

export default function TeamsPage({
  settings,
  lastGenerated,
  onReroll,
  onGoToSetup,
}: Props) {
  // ✅ Hooks must be inside component
  const [fairnessOpen, setFairnessOpen] = useState(false);

  if (!lastGenerated) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Teams</h2>
          <p className="text-sm text-slate-400">
            No teams generated yet. Go to Setup to generate.
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToSetup}
          className="w-full rounded-2xl bg-slate-100 px-4 py-4 text-base font-semibold text-slate-950 hover:bg-white"
        >
          Go to Setup
        </button>
      </div>
    );
  }

  const { teams, playersById } = lastGenerated;

  // Keep in sync with AppShell generator call
  const FALLBACK_VALUE = 60;

  // Choose first enabled numeric criterion by settings priority
  const numericKey =
    settings.criteriaOrder.find((key) =>
      teams.some((t) =>
        t.playerIds.some((id) => playersById[id]?.criteria[key]?.type === "number")
      )
    ) ?? null;

  // Compute fairness details
  let fairness: FairnessDetails = { kind: "none" };

  if (numericKey) {
    const teamSums: number[] = teams.map((t) => {
      let sum = 0;
      for (const id of t.playerIds) {
        const p = playersById[id];
        const v = p?.criteria[numericKey];
        if (v?.type === "number") sum += v.value;
        else sum += FALLBACK_VALUE;
      }
      return sum;
    });

    const maxSum = Math.max(...teamSums);
    const minSum = Math.min(...teamSums);
    const avgSum = teamSums.reduce((a, b) => a + b, 0) / teamSums.length;
    const spread = maxSum - minSum;
    const gapPct = avgSum > 0 ? spread / avgSum : 0;

    let totalPlayers = 0;
    let missingCount = 0;
    for (const t of teams) {
      for (const id of t.playerIds) {
        totalPlayers += 1;
        const p = playersById[id];
        const v = p?.criteria[numericKey];
        if (v?.type !== "number") missingCount += 1;
      }
    }

    const targetGap = 0.25;
    const fairnessScore = clamp(100 * (1 - gapPct / targetGap), 0, 100);

    fairness = {
      kind: "number",
      key: numericKey,
      fairness: fairnessScore,
      spread,
      gapPct,
      minSum,
      maxSum,
      avgSum,
      missingCount,
      totalPlayers,
      fallbackValue: FALLBACK_VALUE,
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Teams</h2>
          <p className="text-sm text-slate-400">
            {teams.length} teams · criteria enabled:{" "}
            {settings.criteriaOrder.length ? settings.criteriaOrder.join(", ") : "none"}
          </p>

          {fairness.kind === "number" && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setFairnessOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                aria-expanded={fairnessOpen}
              >
                <span>Fairness: {Math.round(fairness.fairness)}/100</span>
                <span className="text-slate-400">{fairnessOpen ? "▲" : "▼"}</span>
              </button>

              {fairnessOpen && (
                <div className="mt-2 space-y-1 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300">
                  <div>
                    <span className="font-semibold text-slate-100">Based on:</span>{" "}
                    {fairness.key}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-100">Spread:</span>{" "}
                    {fairness.spread.toFixed(0)}{" "}
                    <span className="text-slate-400">
                      ({(fairness.gapPct * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-100">
                      Min/Max team sum:
                    </span>{" "}
                    {fairness.minSum.toFixed(0)} / {fairness.maxSum.toFixed(0)}
                  </div>

                  {fairness.missingCount > 0 && (
                    <div className="mt-2 rounded-xl border border-amber-900/40 bg-amber-950/30 p-2 text-amber-200">
                      Missing {fairness.key} for {fairness.missingCount}/
                      {fairness.totalPlayers} players — using default{" "}
                      {fairness.fallbackValue}.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void onReroll()}
          className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
        >
          Re-roll
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {teams.map((t) => {
          const players = t.playerIds.map((id) => playersById[id]).filter(Boolean);

          const summaries = settings.criteriaOrder.map((key) => {
            const s = summarizeTeam(players, key);
            return { key, summary: s };
          });

          // numericKey sum/avg per team (use fallback for missing, consistent with fairness)
          let numSum = 0;
          if (numericKey) {
            for (const p of players) {
              const v = readCriterion(p, numericKey);
              if (typeof v === "number") numSum += v;
              else numSum += FALLBACK_VALUE;
            }
          }
          const numAvg = numericKey && players.length ? numSum / players.length : null;

          return (
            <div
              key={t.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-100">{t.name}</div>

                <div className="text-right text-xs text-slate-400">
                  <div>{players.length} players</div>
                  {numericKey && (
                    <div>
                      {numericKey} sum: {numSum.toFixed(0)}
                      {numAvg != null ? ` · avg: ${numAvg.toFixed(1)}` : ""}
                    </div>
                  )}
                </div>
              </div>

              <ul className="mt-3 space-y-2">
                {players.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"
                  >
                    <div className="text-sm font-semibold text-slate-100">
                      {p.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {settings.criteriaOrder.length === 0
                        ? "—"
                        : settings.criteriaOrder
                            .map((key) => {
                              const v = readCriterion(p, key);
                              return `${key}:${v ?? "—"}`;
                            })
                            .join(" · ")}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-400 sm:grid-cols-2">
                {summaries.map(({ key, summary }) => (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-2"
                  >
                    <div className="font-semibold text-slate-200">{key}</div>

                    {summary.kind === "empty" && <div className="mt-1">—</div>}

                    {summary.kind === "category" && (
                      <div className="mt-1">
                        {Object.entries(summary.counts)
                          .map(([k, v]) => `${k}:${v}`)
                          .join(" · ")}
                      </div>
                    )}

                    {summary.kind === "number" && (
                      <div className="mt-1">
                        avg:{summary.avg.toFixed(1)} · sum:{summary.sum.toFixed(1)} · n:{summary.count}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}