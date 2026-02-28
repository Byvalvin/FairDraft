import { useEffect, useMemo, useState } from "react";
import { DB } from "../storage/DB";
import type { Player, PlayerSet } from "../types/domain";
import {
  createPlayerSet,
  DEFAULT_PLAYERSET_ID,
  ensureDefaultPlayerSet,
  togglePlayerInSet,
} from "../storage/playerSetHelpers";
import PlayerSetEditSheet from "../components/playerset/PlayerSetEditSheet";
import { getCache, setCache } from "../lib/cache";

type LoadState = "idle" | "loading" | "ready" | "error";

type Props = {
  onGoToPlayers?: () => void;
};

export default function PlayerSetsPage({ onGoToPlayers }: Props) {
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const cached = getCache<{ sets: PlayerSet[]; players: Player[] }>(
    "playersets_page"
  );
  const [sets, setSets] = useState<PlayerSet[]>(cached?.sets ?? []);
  const [players, setPlayers] = useState<Player[]>(cached?.players ?? []);
  const [name, setName] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canCreate = useMemo(() => name.trim().length > 0, [name]);

  async function refreshAll(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    if (!silent && sets.length === 0 && players.length === 0) {
      setStatus("loading");
      setError(null);
    }

    try {
      const [setRows, playerRows] = await Promise.all([
        DB.playerSets.orderBy("createdAt").reverse().toArray(),
        DB.players.orderBy("createdAt").reverse().toArray(),
      ]);
      setSets(setRows);
      setPlayers(playerRows);
      setCache("playersets_page", { sets: setRows, players: playerRows });
      if (!silent) setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to load sets");
    }
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      await createPlayerSet(trimmed);
      setName("");
      await refreshAll({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create set");
      setStatus("error");
    }
  }

  async function handleRename(setId: string, nextName: string) {
    await DB.playerSets.update(setId, { name: nextName, updatedAt: Date.now() });
    await refreshAll({ silent: true });
  }

  async function handleTogglePlayer(setId: string, playerId: string) {
    await togglePlayerInSet(setId, playerId);
    await refreshAll({ silent: true });
  }

  async function handleDelete(setId: string) {
    if (setId === DEFAULT_PLAYERSET_ID) return;
    await DB.playerSets.delete(setId);
    await refreshAll({ silent: true });
  }

  const selectedSet = useMemo(
    () => sets.find((s) => s.id === selectedId) ?? null,
    [sets, selectedId]
  );

  const orderedSets = useMemo(() => {
    const defaultSet = sets.find((s) => s.id === DEFAULT_PLAYERSET_ID) ?? null;
    const custom = sets.filter((s) => s.id !== DEFAULT_PLAYERSET_ID);
    return defaultSet ? [defaultSet, ...custom] : custom;
  }, [sets]);

  useEffect(() => {
    if (sheetOpen && selectedId && !selectedSet) {
      setSheetOpen(false);
      setSelectedId(null);
    }
  }, [sheetOpen, selectedId, selectedSet]);

  useEffect(() => {
    void (async () => {
      await ensureDefaultPlayerSet();
      await refreshAll();
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Player Sets</h2>
        <p className="text-sm text-slate-400">
          Create collections from your global player list.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="text-sm font-semibold text-slate-100">Create set</div>
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Set name"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              canCreate
                ? "bg-slate-100 text-slate-950 hover:bg-white"
                : "cursor-not-allowed bg-slate-800 text-slate-500",
            ].join(" ")}
          >
            Add
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Free limit: 5 custom sets (Default is always available).
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
            Sets ({orderedSets.length})
          </div>
          <button
            type="button"
            onClick={() => refreshAll({ silent: true })}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>

        {orderedSets.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
            No sets yet. Create your first set above.
          </div>
        ) : (
          <ul className="space-y-2">
            {orderedSets.map((set) => (
              <li
                key={set.id}
                onClick={() => {
                  setSelectedId(set.id);
                  setSheetOpen(true);
                }}
                className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold text-slate-100">
                      {set.name}
                    </div>
                    {set.id === DEFAULT_PLAYERSET_ID && (
                      <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {set.playerIds.length} players
                  </div>
                </div>

                <div className="text-xs font-semibold text-slate-400">Edit</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PlayerSetEditSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        playerSet={selectedSet}
        players={players}
        onRename={handleRename}
        onTogglePlayer={handleTogglePlayer}
        onDelete={handleDelete}
        onGoToPlayers={onGoToPlayers}
      />
    </div>
  );
}
