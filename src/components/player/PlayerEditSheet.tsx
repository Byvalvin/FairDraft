import { useEffect, useMemo, useState } from "react";
import BottomSheet from "../BottomSheet";
import type { CriterionValue, Player } from "../../types/domain";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: Player | null;
  onSave: (updated: Player) => Promise<void>;
};

type FieldDef =
  | {
      key: string;
      label: string;
      kind: "number";
      placeholder?: string;
      inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
    }
  | {
      key: string;
      label: string;
      kind: "category";
      options: Array<{ value: string; label: string }>;
    };

// ✅ V2 fields (rating + gender). For V1, remove the gender def.
const FIELD_DEFS: FieldDef[] = [
//   {
//     key: "rating",
//     label: "Rating (optional)",
//     kind: "number",
//     placeholder: "e.g. 72",
//     inputMode: "numeric",
//   },
  {
    key: "gender",
    label: "Gender (optional)",
    kind: "category",
    options: [
      { value: "unspecified", label: "Unspecified" },
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
    //   { value: "other", label: "Other" },
    ],
  },
  {
    key: "position",
    label: "Position (optional)",
    kind: "category",
    options: [
      { value: "unspecified", label: "Unspecified" },
      { value: "Goalkeeper", label: "GK" },
      { value: "Defense", label: "DF" },
      { value: "Midfield", label: "MD" },
      { value: "Forward", label: "FW" },
    ],
  },
];

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
    for (const def of FIELD_DEFS) {
      if (def.kind === "number") {
        const n = readNumber(player, def.key);
        initial[def.key] = n == null ? "" : String(n);
      } else {
        const c = readCategory(player, def.key);
        // default to "unspecified" if not present
        initial[def.key] = c ?? "unspecified";
      }
    }
    setFieldValues(initial);
  }, [player]);

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

    for (const def of FIELD_DEFS) {
      const raw = fieldValues[def.key] ?? "";

      if (def.kind === "number") {
        if (raw.trim() === "") {
          delete nextCriteria[def.key];
          continue;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        nextCriteria[def.key] = { type: "number", value: n };
      } else {
        if (raw === "unspecified" || raw.trim() === "") {
          delete nextCriteria[def.key];
          continue;
        }
        nextCriteria[def.key] = { type: "category", value: raw };
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

          {FIELD_DEFS.map((def) => {
            if (def.kind === "number") {
              return (
                <div key={def.key}>
                  <label className="text-xs font-semibold text-slate-300">
                    {def.label}
                  </label>
                  <input
                    inputMode={def.inputMode}
                    value={fieldValues[def.key] ?? ""}
                    onChange={(e) => setField(def.key, e.target.value)}
                    placeholder={def.placeholder}
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
                  />
                </div>
              );
            }

            return (
              <div key={def.key}>
                <label className="text-xs font-semibold text-slate-300">
                  {def.label}
                </label>
                <select
                  value={fieldValues[def.key] ?? "unspecified"}
                  onChange={(e) => setField(def.key, e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
                >
                  {def.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
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
