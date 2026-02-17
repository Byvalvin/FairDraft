import { useEffect, useMemo, useState } from "react";
import { DB } from "../storage/DB";
import { newId } from "../storage/utils";
import type { Player } from "../types/domain";
import { addPlayerToDefaultSet, ensureDefaultPlayerSet, removePlayerFromDefaultSet } from "../storage/playerSetHelpers";
import PlayerEditSheet from "../components/player/PlayerEditSheet";

type LoadState = "idle" | "loading" | "ready" | "error";

export default function PlayersPage() {
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");

  const canAdd = useMemo(() => name.trim().length > 0, [name]);
  
  const [activeSetName, setActiveSetName] = useState<string>("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function refreshPlayers(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    if (!silent) {
        setStatus("loading");
        setError(null);
    }

    try {
      const rows = await DB.players.orderBy("createdAt").reverse().toArray();
      setPlayers(rows);
      if (!silent) setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to load players");
    }
  }

  async function addPlayer() {
    const trimmed = name.trim();
    if (!trimmed) return;

    const now = Date.now();
    const player: Player = {
      id: newId("player"),
      name: trimmed,
      criteria: {},
      createdAt: now,
      updatedAt: now,
    };

    try {
      await DB.players.add(player);
      await addPlayerToDefaultSet(player.id);
      setName("");
      await refreshPlayers({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add player");
      setStatus("error");
    }
  }

  async function savePlayer(updated: Player) {
    await DB.players.put(updated);
    await refreshPlayers({ silent: true });
  }

  async function deletePlayer(id: string) {
    try {
      await DB.players.delete(id);
      await removePlayerFromDefaultSet(id);
      await refreshPlayers({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete player");
      setStatus("error");
    }
  }
  const selectedPlayer = useMemo(
    () => players.find((p) => p.id === selectedId) ?? null,
    [players, selectedId]
  );

  useEffect(() => {
    if (sheetOpen && selectedId && !selectedPlayer) {
        setSheetOpen(false);
        setSelectedId(null);
    }
    }, [sheetOpen, selectedId, selectedPlayer]);
  useEffect(() => {
    void (async () => {
        const set = await ensureDefaultPlayerSet();
        setActiveSetName(set.name);
        await refreshPlayers(); // silent false for inital load
    })();
    }, []);




  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Players</h2>
        <p className="text-sm text-slate-400">
          Add and manage players. Saved locally for offline use.
        </p>
        <div className="mt-1 text-xs text-slate-500">Active set: {activeSetName}</div>
      </div>
      {/* Add player */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="text-sm font-semibold text-slate-100">Add player</div>
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
          />
          <button
            type="button"
            onClick={addPlayer}
            disabled={!canAdd}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              canAdd
                ? "bg-slate-100 text-slate-950 hover:bg-white"
                : "cursor-not-allowed bg-slate-800 text-slate-500",
            ].join(" ")}
          >
            Add
          </button>
        </div>
      </div>

      {/* Status / errors */}
      {status === "loading" && (
        <div className="text-sm text-slate-400">Loading…</div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Player list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-200">
            Players ({players.length})
          </div>
          <button
            type="button"
            onClick={() => refreshPlayers({ silent: true })}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>

        {players.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
            No players yet. Add your first player above.
          </div>
        ) : (
          <ul className="space-y-2">
            {players.map((p) => (
                <li
                    key={p.id}
                    onClick={() => {
                        setSelectedId(p.id);
                        setSheetOpen(true);
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"
                >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-100">
                    {p.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    Saved locally
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePlayer(p.id);
                  }}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PlayerEditSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        player={selectedPlayer}
        onSave={savePlayer}
        />
    </div>
  );
}
