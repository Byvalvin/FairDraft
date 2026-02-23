import { useEffect, useMemo, useState } from "react";
import BottomSheet from "../BottomSheet";
import type { CriterionDef, CriterionValue, Player } from "../../types/domain";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: Player | null;
  criteriaDefs: CriterionDef[];
  onSave: (updated: Player) => Promise<void>;
};

function readNumber(player: Player, key: string): number | null {
  const v = player.criteria[key];
  return v?.type === "number" ? v.value : null;
}

function readCategory(player: Player, key: string): string | null {
  const v = player.criteria[key];
  return v?.type === "category" ? v.value : null;
}

export default function PlayerEditSheet({
  open,
  onOpenChange,
  player,
  criteriaDefs,
  onSave,
}: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Store raw field values by key (string form)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!player) return;

    setName(player.name);

    const initial: Record<string, string> = {};
    for (const def of criteriaDefs) {
      if (def.type === "number") {
        const n = readNumber(player, def.id);
        initial[def.id] = n == null ? "" : String(n);
      } else {
        const c = readCategory(player, def.id);
        initial[def.id] = c ?? "unspecified";
      }
    }
    setFieldValues(initial);
  }, [player, criteriaDefs]);

  const canSave = useMemo(
    () => name.trim().length > 0 && !saving,
    [name, saving]
  );

  function setField(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!player) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const nextCriteria: Record<string, CriterionValue> = { ...player.criteria };

    for (const def of criteriaDefs) {
      const raw = fieldValues[def.id] ?? "";

      if (def.type === "number") {
        if (raw.trim() === "") {
          delete nextCriteria[def.id];
          continue;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        nextCriteria[def.id] = { type: "number", value: n };
      } else {
        if (raw === "unspecified" || raw.trim() === "") {
          delete nextCriteria[def.id];
          continue;
        }
        nextCriteria[def.id] = { type: "category", value: raw };
      }
    }

    const updated: Player = {
      ...player,
      name: trimmed,
      criteria: nextCriteria,
      updatedAt: Date.now(),
    };

    setSaving(true);
    try {
      await onSave(updated);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={player ? `Edit: ${player.name}` : "Edit player"}
    >
      {!player ? (
        <div className="text-sm text-slate-400">No player selected.</div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
            />
          </div>

          {criteriaDefs.map((def) => {
            if (def.type === "number") {
              return (
                <div key={def.id}>
                  <label className="text-xs font-semibold text-slate-300">
                    {def.name} (optional)
                  </label>
                  <input
                    inputMode="numeric"
                    value={fieldValues[def.id] ?? ""}
                    onChange={(e) => setField(def.id, e.target.value)}
                    placeholder="e.g. 72"
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
                  />
                </div>
              );
            }

            return (
              <div key={def.id}>
                <label className="text-xs font-semibold text-slate-300">
                  {def.name} (optional)
                </label>
                <select
                  value={fieldValues[def.id] ?? "unspecified"}
                  onChange={(e) => setField(def.id, e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
                >
                  <option value="unspecified">Unspecified</option>
                  {(def.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={[
              "w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
              canSave
                ? "bg-slate-100 text-slate-950 hover:bg-white"
                : "cursor-not-allowed bg-slate-800 text-slate-500",
            ].join(" ")}
          >
            Save
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
