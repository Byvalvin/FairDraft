import { useState } from "react";
import BottomSheet from "../BottomSheet";
import type { GeneratedResult, Player } from "../../types/domain";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: GeneratedResult | null;
  onSave?: (result: GeneratedResult) => Promise<void>;
};

function playersById(players: Player[]) {
  const map: Record<string, Player> = {};
  for (const p of players) map[p.id] = p;
  return map;
}

export default function ResultDetailSheet({
  open,
  onOpenChange,
  result,
  onSave,
}: Props) {
  const [saving, setSaving] = useState(false);
  const players = result?.playersSnapshot ?? [];
  const byId = playersById(players);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={result ? "Saved teams" : "Saved teams"}
    >
      {!result ? (
        <div className="text-sm text-slate-400">No result selected.</div>
      ) : (
        <div className="space-y-3">
          {onSave ? (
            <button
              type="button"
              onClick={async () => {
                if (saving) return;
                setSaving(true);
                try {
                  await onSave(result);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className={[
                "w-full rounded-xl border px-3 py-2 text-xs font-semibold",
                saving
                  ? "cursor-not-allowed border-slate-800 bg-slate-800 text-slate-500"
                  : "border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800",
              ].join(" ")}
            >
              {saving ? "Saving…" : "Save this roll"}
            </button>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300">
              Saved
            </div>
          )}
          {result.teams.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-3"
            >
              <div className="text-sm font-semibold text-slate-100">{t.name}</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-300">
                {t.playerIds.map((id) => (
                  <li key={id}>{byId[id]?.name ?? "Unknown"}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
