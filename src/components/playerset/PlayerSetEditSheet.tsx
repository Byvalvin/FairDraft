import { useEffect, useMemo, useState } from "react";
import BottomSheet from "../BottomSheet";
import type { Player, PlayerSet } from "../../types/domain";
import { DEFAULT_PLAYERSET_ID } from "../../storage/playerSetHelpers";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerSet: PlayerSet | null;
  players: Player[];
  onRename: (setId: string, name: string) => Promise<void>;
  onTogglePlayer: (setId: string, playerId: string) => Promise<void>;
  onDelete: (setId: string) => Promise<void>;
};

export default function PlayerSetEditSheet({
  open,
  onOpenChange,
  playerSet,
  players,
  onRename,
  onTogglePlayer,
  onDelete,
}: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);

  useEffect(() => {
    setName(playerSet?.name ?? "");
    setQuery("");
    setSelectedOnly(false);
  }, [playerSet]);

  const selectedCount = playerSet?.playerIds.length ?? 0;
  const showSearch = players.length >= 5;
  const filteredPlayers = useMemo(() => {
    if (!playerSet) return players;
    let base = players;
    if (selectedOnly) {
      base = base.filter((p) => playerSet.playerIds.includes(p.id));
    }
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, playerSet, query, selectedOnly]);
  const canSave = useMemo(() => {
    if (!playerSet) return false;
    const trimmed = name.trim();
    return trimmed.length > 0 && trimmed !== playerSet.name && !saving;
  }, [name, playerSet, saving]);

  async function handleRename() {
    if (!playerSet) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === playerSet.name) return;
    setSaving(true);
    try {
      await onRename(playerSet.id, trimmed);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!playerSet) return;
    await onDelete(playerSet.id);
    onOpenChange(false);
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={playerSet ? playerSet.name : "Edit set"}
    >
      {!playerSet ? (
        <div className="text-sm text-slate-400">No set selected.</div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300">Set name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
            />
            <button
              type="button"
              onClick={handleRename}
              disabled={!canSave}
              className={[
                "mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
                canSave
                  ? "bg-slate-100 text-slate-950 hover:bg-white"
                  : "cursor-not-allowed bg-slate-800 text-slate-500",
              ].join(" ")}
            >
              Save name
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">Members</div>
              <div className="text-xs text-slate-400">
                {selectedCount} selected
              </div>
            </div>

            {players.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-400">
                No players yet. Add players first from the Players tab.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {showSearch && (
                  <div className="flex items-center gap-2">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search players…"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedOnly((v) => !v)}
                      className={[
                        "rounded-xl border px-3 py-2 text-xs font-semibold",
                        selectedOnly
                          ? "border-slate-300 bg-slate-100 text-slate-950"
                          : "border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800",
                      ].join(" ")}
                    >
                      Selected
                    </button>
                  </div>
                )}

                {filteredPlayers.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-400">
                    No matching players.
                  </div>
                ) : (
                  <div className="max-h-[45dvh] space-y-2 overflow-y-auto pr-1">
                    {filteredPlayers.map((p) => {
                      const checked = playerSet.playerIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-100">
                              {p.name}
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onTogglePlayer(playerSet.id, p.id)}
                            className="h-4 w-4 accent-slate-200"
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {playerSet.id !== DEFAULT_PLAYERSET_ID && (
            <button
              type="button"
              onClick={handleDelete}
              className="w-full rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-900/40"
            >
              Delete set
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
