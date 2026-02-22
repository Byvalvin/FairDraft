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
  // category → counts
  // number → average (later also show sum/median)
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

export default function TeamsPage({
  settings,
  lastGenerated,
  onReroll,
  onGoToSetup,
}: Props) {

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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Teams</h2>
          <p className="text-sm text-slate-400">
            {teams.length} teams · criteria enabled:{" "}
            {settings.criteriaOrder.length ? settings.criteriaOrder.join(", ") : "none"}
          </p>
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
          const ratingEnabled = settings.criteriaOrder.includes("rating");

          let ratingSum = 0;
          let ratingCount = 0;
          if (ratingEnabled) {
            for (const p of players) {
              const v = readCriterion(p, "rating");
              if (typeof v === "number") {
                ratingSum += v;
                ratingCount += 1;
              }
            }
          }
          const ratingAvg = ratingCount ? ratingSum / ratingCount : null;


          return (
            <div
              key={t.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-100">{t.name}</div>
                <div className="text-right text-xs text-slate-400">
                <div>{players.length} players</div>
                  {ratingEnabled && (
                    <div>
                      rating sum: {ratingSum.toFixed(0)}
                      {ratingAvg != null ? ` · avg: ${ratingAvg.toFixed(1)}` : ""}
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
