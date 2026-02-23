import { useEffect, useMemo, useState } from "react";
import type { CriterionDef } from "../types/domain";
import { DB } from "../storage/DB";
import {
  createCriterion,
  ensureDefaultCriteria,
  MAX_CRITERIA_FREE,
  updateCriterion,
  deleteCriterion,
} from "../storage/criteriaHelpers";
import CriterionEditSheet from "../components/criteria/CriterionEditSheet";

type LoadState = "idle" | "loading" | "ready" | "error";

export default function CriteriaPage() {
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [criteria, setCriteria] = useState<CriterionDef[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<"number" | "category">("number");
  const [options, setOptions] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canCreate = useMemo(
    () => name.trim().length > 0 && criteria.length < MAX_CRITERIA_FREE,
    [name, criteria.length]
  );

  function parseOptions(raw: string) {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(parts));
  }

  async function refreshCriteria(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    if (!silent) {
      setStatus("loading");
      setError(null);
    }

    try {
      const rows = await DB.criteria.orderBy("createdAt").toArray();
      setCriteria(rows);
      if (!silent) setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to load criteria");
    }
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createCriterion(trimmed, type, type === "category" ? parseOptions(options) : undefined);
      setName("");
      setOptions("");
      setType("number");
      await refreshCriteria({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create criterion");
      setStatus("error");
    }
  }

  async function handleSave(id: string, updates: Partial<Omit<CriterionDef, "id" | "createdAt">>) {
    await updateCriterion(id, updates);
    await refreshCriteria({ silent: true });
  }

  async function handleDelete(id: string) {
    await deleteCriterion(id);
    await refreshCriteria({ silent: true });
  }

  const selectedCriterion = useMemo(
    () => criteria.find((c) => c.id === selectedId) ?? null,
    [criteria, selectedId]
  );

  useEffect(() => {
    if (sheetOpen && selectedId && !selectedCriterion) {
      setSheetOpen(false);
      setSelectedId(null);
    }
  }, [sheetOpen, selectedId, selectedCriterion]);

  useEffect(() => {
    void (async () => {
      await ensureDefaultCriteria();
      await refreshCriteria();
    })();
  }, []);

  const remaining = Math.max(0, MAX_CRITERIA_FREE - criteria.length);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Criteria</h2>
        <p className="text-sm text-slate-400">
          Customize the fields shown on players and used in generation.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="text-sm font-semibold text-slate-100">Add criterion</div>
        <div className="mt-3 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "number" | "category")}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="number">Number</option>
            <option value="category">Category</option>
          </select>
          {type === "category" && (
            <input
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder="Options (comma separated)"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
            />
          )}
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate}
            className={[
              "w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
              canCreate
                ? "bg-slate-100 text-slate-950 hover:bg-white"
                : "cursor-not-allowed bg-slate-800 text-slate-500",
            ].join(" ")}
          >
            Add
          </button>
          <div className="text-xs text-slate-500">
            Free limit: {MAX_CRITERIA_FREE} criteria total. {remaining} left.
          </div>
        </div>
      </div>

      {status === "loading" && (
        <div className="text-sm text-slate-400">Loading…</div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-200">
            Criteria ({criteria.length})
          </div>
          <button
            type="button"
            onClick={() => refreshCriteria({ silent: true })}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>

        {criteria.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
            No criteria yet. Add your first criterion above.
          </div>
        ) : (
          <ul className="space-y-2">
            {criteria.map((c) => (
              <li
                key={c.id}
                onClick={() => {
                  setSelectedId(c.id);
                  setSheetOpen(true);
                }}
                className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-100">
                    {c.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {c.type === "number" ? "Number" : "Category"}
                  </div>
                </div>

                <div className="text-xs font-semibold text-slate-400">Edit</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CriterionEditSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        criterion={selectedCriterion}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
