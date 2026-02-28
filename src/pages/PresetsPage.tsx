import { useEffect, useMemo, useState } from "react";
import type { Preset, CriterionDef } from "../types/domain";
import { DB } from "../storage/DB";
import BottomSheet from "../components/BottomSheet";
import { getCache, setCache } from "../lib/cache";

type Props = {
  criteriaDefs: CriterionDef[];
  onApplyPreset: (preset: Preset) => void;
};

type LoadState = "idle" | "loading" | "ready" | "error";

export default function PresetsPage({ criteriaDefs, onApplyPreset }: Props) {
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const cached = getCache<{ presets: Preset[] }>("presets_page");
  const [presets, setPresets] = useState<Preset[]>(cached?.presets ?? []);
  const [query, setQuery] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<Preset | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  async function refresh(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    if (!silent && presets.length === 0) {
      setStatus("loading");
      setError(null);
    }
    try {
      const rows = await DB.presets.orderBy("createdAt").reverse().toArray();
      setPresets(rows);
      setCache("presets_page", { presets: rows });
      if (!silent) setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to load presets");
    }
  }

  async function deletePreset(id: string) {
    await DB.presets.delete(id);
    await refresh({ silent: true });
  }

  const criteriaIds = useMemo(() => new Set(criteriaDefs.map((c) => c.id)), [criteriaDefs]);

  const filteredPresets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter((p) => p.name.toLowerCase().includes(q));
  }, [presets, query]);

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Presets</h2>
        <p className="text-sm text-slate-400">
          Saved setup configurations you can reuse quickly.
        </p>
      </div>

      {status === "loading" && <div className="text-sm text-slate-400">Loading…</div>}
      {error && (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {presets.length >= 5 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search presets…"
          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
        />
      )}

      {filteredPresets.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
          No presets saved yet. Use “Save preset” on Setup.
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredPresets.map((p) => {
            const missing = p.criteriaOrder.filter((id) => !criteriaIds.has(id));
            return (
              <li
                key={p.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-100">
                      {p.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {p.numTeams} teams · {p.criteriaOrder.length} criteria
                    </div>
                    {missing.length > 0 && (
                      <div className="mt-1 text-[11px] text-amber-200/80">
                        {missing.length} missing criteria will be skipped.
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const set = await DB.playerSets.get(p.playerSetId);
                        if (!set) {
                          setConfirmMsg("This preset’s player set no longer exists. Continue anyway?");
                        } else {
                          setConfirmMsg(
                            `Apply preset “${p.name}” with set “${set.name}”?`
                          );
                        }
                        setPendingPreset(p);
                        setConfirmOpen(true);
                      }}
                      className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      Use
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePreset(p.id)}
                      className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <BottomSheet
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) {
            setPendingPreset(null);
            setConfirmMsg(null);
          }
        }}
        title="Apply preset"
      >
        <div className="space-y-3 text-sm text-slate-300">
          <div>{confirmMsg ?? "Apply this preset?"}</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (pendingPreset) onApplyPreset(pendingPreset);
                setConfirmOpen(false);
                setPendingPreset(null);
                setConfirmMsg(null);
              }}
              className="w-full rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-white"
            >
              Apply
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
