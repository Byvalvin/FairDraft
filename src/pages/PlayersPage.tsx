import { useEffect, useMemo, useState } from "react";
import { DB } from "../storage/DB";
import { newId } from "../storage/utils";
import type { CriterionDef, Player, PlayerSet } from "../types/domain";
import {
  addPlayerToDefaultSet,
  DEFAULT_PLAYERSET_ID,
  ensureDefaultPlayerSet,
  removePlayerFromAllSets,
} from "../storage/playerSetHelpers";
import { ensureDefaultCriteria } from "../storage/criteriaHelpers";
import PlayerEditSheet from "../components/player/PlayerEditSheet";
import PlayersFilterSheet, {
  type CategoryFilter,
  type CriteriaFilters,
  type NumberFilter,
} from "../components/player/PlayersFilterSheet";
import { getCache, setCache } from "../lib/cache";

type LoadState = "idle" | "loading" | "ready" | "error";

export default function PlayersPage() {
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const cached = getCache<{
    players: Player[];
    sets: PlayerSet[];
    criteriaDefs: CriterionDef[];
  }>("players_page");
  const [players, setPlayers] = useState<Player[]>(cached?.players ?? []);
  const [sets, setSets] = useState<PlayerSet[]>(cached?.sets ?? []);
  const [criteriaDefs, setCriteriaDefs] = useState<CriterionDef[]>(
    cached?.criteriaDefs ?? []
  );
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [setFilterId, setSetFilterId] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<CriteriaFilters>({});

  const canAdd = useMemo(() => name.trim().length > 0, [name]);

  const showSearch = players.length >= 5;
  const playersInSet = useMemo(() => {
    if (setFilterId === "all") return players;
    const set = sets.find((s) => s.id === setFilterId);
    if (!set) return [];
    const ids = new Set(set.playerIds);
    return players.filter((p) => ids.has(p.id));
  }, [players, sets, setFilterId]);

  const playersAfterCriteria = useMemo(() => {
    let base = playersInSet;
    for (const def of criteriaDefs) {
      const f = filters[def.id];
      if (!f) continue;
      if (def.type === "number" && f.type === "number") {
        const min = f.min.trim() === "" ? null : Number(f.min);
        const max = f.max.trim() === "" ? null : Number(f.max);
        if (min == null && max == null) continue;
        base = base.filter((p) => {
          const v = p.criteria[def.id];
          if (!v || v.type !== "number") return false;
          if (min != null && v.value < min) return false;
          if (max != null && v.value > max) return false;
          return true;
        });
      }
      if (def.type === "category" && f.type === "category") {
        if (f.selected.length === 0) continue;
        base = base.filter((p) => {
          const v = p.criteria[def.id];
          return v?.type === "category" && f.selected.includes(v.value);
        });
      }
    }
    return base;
  }, [playersInSet, criteriaDefs, filters]);

  const filteredPlayers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return playersAfterCriteria;
    return playersAfterCriteria.filter((p) => p.name.toLowerCase().includes(q));
  }, [playersAfterCriteria, query]);

  const optionsByCriterionId = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const def of criteriaDefs) {
      if (def.type !== "category") continue;
      const values = new Set<string>(def.options ?? []);
      for (const p of playersInSet) {
        const v = p.criteria[def.id];
        if (v?.type === "category") values.add(v.value);
      }
      map[def.id] = Array.from(values);
    }
    return map;
  }, [criteriaDefs, playersInSet]);

  const rangeByCriterionId = useMemo(() => {
    const map: Record<string, { min: number; max: number } | null> = {};
    for (const def of criteriaDefs) {
      if (def.type !== "number") continue;
      let min: number | null = null;
      let max: number | null = null;
      for (const p of playersInSet) {
        const v = p.criteria[def.id];
        if (v?.type !== "number") continue;
        min = min == null ? v.value : Math.min(min, v.value);
        max = max == null ? v.value : Math.max(max, v.value);
      }
      map[def.id] = min == null || max == null ? null : { min, max };
    }
    return map;
  }, [criteriaDefs, playersInSet]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    for (const def of criteriaDefs) {
      const f = filters[def.id];
      if (!f) continue;
      if (f.type === "number" && (f.min.trim() || f.max.trim())) count += 1;
      if (f.type === "category" && f.selected.length > 0) count += 1;
    }
    return count;
  }, [criteriaDefs, filters]);

  const setNamesByPlayerId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of sets) {
      for (const id of s.playerIds) {
        const list = map.get(id) ?? [];
        list.push(s.name);
        map.set(id, list);
      }
    }
    return map;
  }, [sets]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function refreshPlayers(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    if (!silent && players.length === 0) {
        setStatus("loading");
        setError(null);
    }

    try {
      const [playerRows, setRows, criteriaRows] = await Promise.all([
        DB.players.orderBy("createdAt").reverse().toArray(),
        DB.playerSets.orderBy("createdAt").reverse().toArray(),
        DB.criteria.orderBy("createdAt").toArray(),
      ]);
      setPlayers(playerRows);
      setSets(setRows);
      setCriteriaDefs(criteriaRows);
      setCache("players_page", {
        players: playerRows,
        sets: setRows,
        criteriaDefs: criteriaRows,
      });
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
      await removePlayerFromAllSets(id);
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
        await ensureDefaultPlayerSet();
        await ensureDefaultCriteria();
        await refreshPlayers(); // silent false for inital load
    })();
    }, []);

  useEffect(() => {
    if (sets.length === 0) return;
    if (setFilterId === "all") return;
    if (!sets.some((s) => s.id === setFilterId)) {
      setSetFilterId("all");
    }
  }, [sets, setFilterId]);

  useEffect(() => {
    if (criteriaDefs.length === 0) return;
    setFilters((prev) => {
      const next: CriteriaFilters = { ...prev };
      for (const def of criteriaDefs) {
        if (next[def.id]) continue;
        next[def.id] =
          def.type === "number"
            ? ({ type: "number", min: "", max: "" } as NumberFilter)
            : ({ type: "category", selected: [] } as CategoryFilter);
      }
      return next;
    });
  }, [criteriaDefs]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Players</h2>
        <p className="text-sm text-slate-400">
          Add and manage players. Saved locally for offline use.
        </p>
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
            {query.trim()
              ? `Players (${filteredPlayers.length} / ${players.length})`
              : `Players (${players.length})`}
          </div>
          <button
            type="button"
            onClick={() => refreshPlayers({ silent: true })}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={setFilterId}
            onChange={(e) => setSetFilterId(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="all">Default (All players)</option>
            {sets
              .filter((s) => s.id !== DEFAULT_PLAYERSET_ID)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Filters{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
          </button>
        </div>

        {showSearch && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players…"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
          />
        )}

        {players.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
            No players yet. Add your first player above.
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
            No matching players.
          </div>
        ) : (
          <div className="max-h-[55dvh] overflow-y-auto pr-1">
            <ul className="space-y-2">
            {filteredPlayers.map((p) => (
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
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(setNamesByPlayerId.get(p.id) ?? []).slice(0, 2).map((n) => (
                      <span
                        key={n}
                        className="rounded-full border border-slate-800 bg-slate-950 px-2 py-0.5 text-[10px] font-semibold text-slate-300"
                      >
                        {n}
                      </span>
                    ))}
                    {(setNamesByPlayerId.get(p.id) ?? []).length > 2 && (
                      <span className="rounded-full border border-slate-800 bg-slate-950 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        +{(setNamesByPlayerId.get(p.id) ?? []).length - 2}
                      </span>
                    )}
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
          </div>
        )}
      </div>
      <PlayerEditSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        player={selectedPlayer}
        criteriaDefs={criteriaDefs}
        onSave={savePlayer}
        />

      <PlayersFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        criteriaDefs={criteriaDefs}
        optionsByCriterionId={optionsByCriterionId}
        rangeByCriterionId={rangeByCriterionId}
        filters={filters}
        onChangeFilter={(id, next) =>
          setFilters((prev) => ({ ...prev, [id]: next }))
        }
        onClearAll={() =>
          setFilters((prev) => {
            const next: CriteriaFilters = { ...prev };
            for (const def of criteriaDefs) {
              next[def.id] =
                def.type === "number"
                  ? ({ type: "number", min: "", max: "" } as NumberFilter)
                  : ({ type: "category", selected: [] } as CategoryFilter);
            }
            return next;
          })
        }
      />
    </div>
  );
}
