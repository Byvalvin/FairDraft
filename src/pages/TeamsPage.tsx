import { useState } from "react";
import type { GenerationSettings } from "../types/gen";
import type { Player } from "../types/domain";
import type { GeneratedTeams } from "../lib/logic/generateTeams";

type Props = {
  settings: GenerationSettings;
  lastGenerated: GeneratedTeams | null;
  criteriaDefs: Array<{ id: string; name: string }>;
  missingSummary?: {
    totalPlayers: number;
    rows: Array<{ id: string; name: string; missing: number }>;
  } | null;
  epsilonInfo?: {
    key: string;
    epsilon: number;
    epsNorm: number;
    stdevN: number;
    range: number;
  } | null;
  onSaveResult: () => Promise<void>;
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

type CategoryFairness = {
  key: string;
  score: number; // 0..100
  missingCount: number;
  totalPlayers: number;
};

export default function TeamsPage({
  settings,
  lastGenerated,
  criteriaDefs,
  missingSummary,
  epsilonInfo,
  onSaveResult,
  onReroll,
  onGoToSetup,
}: Props) {
  // ✅ Hooks must be inside component
  const [fairnessOpen, setFairnessOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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
  const labelFor = (id: string) =>
    criteriaDefs.find((c) => c.id === id)?.name ?? id;

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
  const categoryScores: CategoryFairness[] = [];

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

  const categoryKeys = settings.criteriaOrder.filter((key) =>
    teams.some((t) =>
      t.playerIds.some((id) => playersById[id]?.criteria[key]?.type === "category")
    )
  );

  for (const key of categoryKeys) {
    const countsTotal: Record<string, number> = {};
    let totalPlayers = 0;
    let missingCount = 0;

    for (const t of teams) {
      for (const id of t.playerIds) {
        totalPlayers += 1;
        const v = playersById[id]?.criteria[key];
        if (v?.type !== "category") {
          missingCount += 1;
          continue;
        }
        countsTotal[v.value] = (countsTotal[v.value] ?? 0) + 1;
      }
    }

    let scoreSum = 0;
    let scoreCount = 0;

    for (const [value, total] of Object.entries(countsTotal)) {
      const target = total / teams.length;
      if (target <= 0) continue;
      let deviationSum = 0;
      for (const t of teams) {
        const count = t.playerIds.reduce((acc, id) => {
          const v = playersById[id]?.criteria[key];
          return v?.type === "category" && v.value === value ? acc + 1 : acc;
        }, 0);
        deviationSum += Math.abs(count - target) / target;
      }
      const avgDeviation = deviationSum / teams.length;
      const score = clamp(100 * (1 - avgDeviation), 0, 100);
      scoreSum += score;
      scoreCount += 1;
    }

    const score = scoreCount > 0 ? scoreSum / scoreCount : 0;
    categoryScores.push({ key, score, missingCount, totalPlayers });
  }

  const overallFairness = (() => {
    const parts: Array<{ key: string; score: number }> = [];
    if (fairness.kind === "number") parts.push({ key: fairness.key, score: fairness.fairness });
    for (const c of categoryScores) parts.push({ key: c.key, score: c.score });
    if (parts.length === 0) return null;
    let totalWeight = 0;
    let weightedSum = 0;
    for (const p of parts) {
      const idx = settings.criteriaOrder.indexOf(p.key);
      const w = idx >= 0 ? 1 / (idx + 1) ** 2 : 0.2;
      totalWeight += w;
      weightedSum += w * p.score;
    }
    return weightedSum / totalWeight;
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Teams</h2>
          <p className="text-sm text-slate-400">
            {teams.length} teams · criteria enabled:{" "}
            {settings.criteriaOrder.length
              ? settings.criteriaOrder
                  .map((id) => criteriaDefs.find((c) => c.id === id)?.name ?? id)
                  .join(", ")
              : "none"}
          </p>

          {overallFairness != null && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setFairnessOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                aria-expanded={fairnessOpen}
              >
                <span>Fairness: {Math.round(overallFairness)}/100</span>
                <span className="text-slate-400">{fairnessOpen ? "▲" : "▼"}</span>
              </button>

              {fairnessOpen && (
                <div className="mt-2 space-y-1 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300">
                  {fairness.kind === "number" && (
                    <>
                      <div>
                        <span className="font-semibold text-slate-100">Numeric:</span>{" "}
                        {labelFor(fairness.key)} · {Math.round(fairness.fairness)}/100
                      </div>
                      {epsilonInfo && epsilonInfo.key === fairness.key && (
                        <div>
                          <span className="font-semibold text-slate-100">Epsilon:</span>{" "}
                          {epsilonInfo.epsilon.toFixed(2)}{" "}
                          <span className="text-slate-400">
                            (norm {epsilonInfo.epsNorm.toFixed(3)} · range{" "}
                            {epsilonInfo.range.toFixed(1)})
                          </span>
                        </div>
                      )}
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
                          Missing {labelFor(fairness.key)} for {fairness.missingCount}/
                          {fairness.totalPlayers} players — using default{" "}
                          {fairness.fallbackValue}.
                        </div>
                      )}
                    </>
                  )}

                  {categoryScores.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {categoryScores.map((c) => (
                        <div key={c.key}>
                          <span className="font-semibold text-slate-100">Category:</span>{" "}
                          {labelFor(c.key)} · {Math.round(c.score)}/100
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {missingSummary && missingSummary.rows.length > 0 && (
            <div className="mt-3 rounded-2xl border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
              <div className="font-semibold text-amber-100">Missing data</div>
              <div className="mt-1 space-y-1">
                {missingSummary.rows.map((r) => (
                  <div key={r.id}>
                    {r.name}: {r.missing}/{missingSummary.totalPlayers}
                  </div>
                ))}
              </div>
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

      <button
        type="button"
        onClick={async () => {
          setSaveError(null);
          setSaveStatus("Saving…");
          try {
            await onSaveResult();
            setSaveStatus("Saved.");
            setTimeout(() => setSaveStatus(null), 1500);
          } catch (e) {
            setSaveStatus(null);
            setSaveError(e instanceof Error ? e.message : "Failed to save");
          }
        }}
        className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
      >
        Save result
      </button>
      {saveStatus && (
        <div className="text-xs text-slate-400">{saveStatus}</div>
      )}
      {saveError && (
        <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-2 text-xs text-red-200">
          {saveError}
        </div>
      )}

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
                      {labelFor(numericKey)} sum: {numSum.toFixed(0)}
                      {numAvg != null ? ` · avg: ${numAvg.toFixed(1)}` : ""}
                    </div>
                  )}
                </div>
              </div>

              <ul className="mt-3 space-y-2">
                {players.map((p) => {
                  const missingKeys = settings.criteriaOrder.filter(
                    (key) => !p.criteria[key]
                  );
                  const hasMissing = missingKeys.length > 0;
                  return (
                    <li
                      key={p.id}
                      className={[
                        "rounded-xl border px-3 py-2",
                        hasMissing
                          ? "border-amber-900/50 bg-amber-950/20"
                          : "border-slate-800 bg-slate-950",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-100">
                          {p.name}
                        </div>
                        {hasMissing && (
                          <span className="rounded-full border border-amber-900/60 bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                            Missing {missingKeys.length}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {settings.criteriaOrder.length === 0
                          ? "—"
                          : settings.criteriaOrder
                              .map((key) => {
                                const v = readCriterion(p, key);
                                const label = labelFor(key);
                                const value = v ?? "—";
                                return `${label}:${value}`;
                              })
                              .join(" · ")}
                      </div>
                      {hasMissing && (
                        <div className="mt-1 text-[11px] text-amber-200/80">
                          Missing:{" "}
                          {missingKeys.map((key) => labelFor(key)).join(", ")}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-400 sm:grid-cols-2">
                {summaries.map(({ key, summary }) => (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-2"
                  >
                    <div className="font-semibold text-slate-200">{labelFor(key)}</div>

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
