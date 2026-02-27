import { useEffect, useMemo, useState } from "react";
import BottomSheet from "../BottomSheet";
import type { CriterionDef } from "../../types/domain";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criterion: CriterionDef | null;
  onSave: (id: string, updates: Partial<Omit<CriterionDef, "id" | "createdAt">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export default function CriterionEditSheet({
  open,
  onOpenChange,
  criterion,
  onSave,
  onDelete,
}: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"number" | "category">("number");
  const [options, setOptions] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(criterion?.name ?? "");
    setType(criterion?.type ?? "number");
    setOptions((criterion?.options ?? []).join(", "));
  }, [criterion]);

  const canSave = useMemo(() => {
    if (!criterion) return false;
    const trimmed = name.trim();
    if (!trimmed || saving) return false;
    if (trimmed !== criterion.name) return true;
    if (type !== criterion.type) return true;
    const currentOpts = (criterion.options ?? []).join(", ");
    return type === "category" && options.trim() !== currentOpts.trim();
  }, [criterion, name, type, options, saving]);

  function parseOptions(raw: string) {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(parts));
  }

  async function handleSave() {
    if (!criterion) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const updates: Partial<Omit<CriterionDef, "id" | "createdAt">> = {
      name: trimmed,
      type,
    };
    if (type === "category") {
      updates.options = parseOptions(options);
    } else {
      updates.options = undefined;
    }
    setSaving(true);
    try {
      await onSave(criterion.id, updates);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!criterion) return;
    await onDelete(criterion.id);
    onOpenChange(false);
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={criterion ? `Edit: ${criterion.name}` : "Edit criterion"}
    >
      {!criterion ? (
        <div className="text-sm text-slate-400">No criterion selected.</div>
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

          <div>
            <label className="text-xs font-semibold text-slate-300">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "number" | "category")}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
            >
              <option value="number">Number</option>
              <option value="category">Category</option>
            </select>
          </div>

          {type === "category" && (
            <div>
              <label className="text-xs font-semibold text-slate-300">
                Options (comma separated)
              </label>
              <input
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="e.g. Beginner, Intermediate, Advanced"
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
              />
            </div>
          )}

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

          <button
            type="button"
            onClick={handleDelete}
            className="w-full rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-900/40"
          >
            Delete
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
