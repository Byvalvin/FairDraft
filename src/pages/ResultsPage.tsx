import { useEffect, useMemo, useState } from "react";
import type { GeneratedResult, PlayerSet } from "../types/domain";
import { DB } from "../storage/DB";
import ResultDetailSheet from "../components/results/ResultDetailSheet";
import { getCache, setCache } from "../lib/cache";

type LoadState = "idle" | "loading" | "ready" | "error";

type Props = {
  criteriaDefs: Array<{ id: string; name: string }>;
};

export default function ResultsPage({ criteriaDefs }: Props) {
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const cached = getCache<{ results: GeneratedResult[] }>("results_page");
  const [results, setResults] = useState<GeneratedResult[]>(
    cached?.results ?? []
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function refresh(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    if (!silent && results.length === 0) {
      setStatus("loading");
      setError(null);
    }
    try {
      const rows = await DB.results.orderBy("createdAt").reverse().toArray();
      setResults(rows);
      setCache("results_page", { results: rows });
      if (!silent) setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to load results");
    }
  }

  async function deleteResult(id: string) {
    await DB.results.delete(id);
    await refresh({ silent: true });
  }

  const selected = useMemo(
    () => results.find((r) => r.id === selectedId) ?? null,
    [results, selectedId]
  );

  useEffect(() => {
    if (sheetOpen && selectedId && !selected) {
      setSheetOpen(false);
      setSelectedId(null);
    }
  }, [sheetOpen, selectedId, selected]);

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Saved Results</h2>
        <p className="text-sm text-slate-400">
          Your saved team generations.
        </p>
      </div>

      {status === "loading" && <div className="text-sm text-slate-400">Loading…</div>}
      {error && (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {results.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
          No saved results yet. Generate teams and tap “Save result”.
        </div>
      ) : (
        <ul className="space-y-2">
          {results.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">
                  {r.presetSnapshot?.name ?? "Saved result"}
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(r.createdAt).toLocaleString()}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Set: {r.playerSetSnapshot?.name ?? "Unknown"} · Criteria:{" "}
                  {r.presetSnapshot?.criteriaOrder?.length
                    ? r.presetSnapshot.criteriaOrder
                        .map((id) => criteriaDefs.find((c) => c.id === id)?.name ?? id)
                        .join(", ")
                    : "none"}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(r.id);
                    setSheetOpen(true);
                  }}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => deleteResult(r.id)}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ResultDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        result={selected}
      />
    </div>
  );
}
