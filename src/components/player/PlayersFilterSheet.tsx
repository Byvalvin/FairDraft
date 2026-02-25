import BottomSheet from "../BottomSheet";
import type { CriterionDef } from "../../types/domain";

export type NumberFilter = { type: "number"; min: string; max: string };
export type CategoryFilter = { type: "category"; selected: string[] };
export type CriteriaFilters = Record<string, NumberFilter | CategoryFilter>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criteriaDefs: CriterionDef[];
  optionsByCriterionId: Record<string, string[]>;
  rangeByCriterionId: Record<string, { min: number; max: number } | null>;
  filters: CriteriaFilters;
  onChangeFilter: (id: string, next: NumberFilter | CategoryFilter) => void;
  onClearAll: () => void;
};

export default function PlayersFilterSheet({
  open,
  onOpenChange,
  criteriaDefs,
  optionsByCriterionId,
  rangeByCriterionId,
  filters,
  onChangeFilter,
  onClearAll,
}: Props) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Filters">
      <div className="space-y-4">
        {criteriaDefs.length === 0 ? (
          <div className="text-sm text-slate-400">No criteria available.</div>
        ) : (
          <>
            <button
              type="button"
              onClick={onClearAll}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Clear all filters
            </button>

            {criteriaDefs.map((c) => {
              if (c.type === "number") {
                const f = filters[c.id] as NumberFilter | undefined;
                const range = rangeByCriterionId[c.id];
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-3"
                  >
                    <div className="text-sm font-semibold text-slate-100">{c.name}</div>
                    {range && (
                      <button
                        type="button"
                        onClick={() =>
                          onChangeFilter(c.id, {
                            type: "number",
                            min: range.min.toFixed(1),
                            max: range.max.toFixed(1),
                          })
                        }
                        className="mt-1 inline-flex items-center rounded-full border border-slate-800 bg-slate-950 px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:bg-slate-900"
                      >
                        Range: {range.min.toFixed(1)} – {range.max.toFixed(1)} · Autofill
                      </button>
                    )}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        inputMode="numeric"
                        value={f?.min ?? ""}
                        onChange={(e) =>
                          onChangeFilter(c.id, {
                            type: "number",
                            min: e.target.value,
                            max: f?.max ?? "",
                          })
                        }
                        placeholder="Min"
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
                      />
                      <input
                        inputMode="numeric"
                        value={f?.max ?? ""}
                        onChange={(e) =>
                          onChangeFilter(c.id, {
                            type: "number",
                            min: f?.min ?? "",
                            max: e.target.value,
                          })
                        }
                        placeholder="Max"
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
                      />
                    </div>
                  </div>
                );
              }

              const f = filters[c.id] as CategoryFilter | undefined;
              const opts = optionsByCriterionId[c.id] ?? [];
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-3"
                >
                  <div className="text-sm font-semibold text-slate-100">{c.name}</div>
                  {opts.length === 0 ? (
                    <div className="mt-2 text-xs text-slate-500">No values yet.</div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {opts.map((opt) => {
                        const active = (f?.selected ?? []).includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const current = new Set(f?.selected ?? []);
                              if (current.has(opt)) current.delete(opt);
                              else current.add(opt);
                              onChangeFilter(c.id, {
                                type: "category",
                                selected: Array.from(current),
                              });
                            }}
                            className={[
                              "rounded-full border px-3 py-1 text-xs font-semibold",
                              active
                                ? "border-slate-300 bg-slate-100 text-slate-950"
                                : "border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-800",
                            ].join(" ")}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
