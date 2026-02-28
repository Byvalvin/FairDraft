import type { GenerationSettings } from "../types/gen";
import type { CriterionDef, Player, PlayerSet } from "../types/domain";
import { useEffect, useState } from "react";
import { DB } from "../storage/DB";
import { ensureDefaultCriteria } from "../storage/criteriaHelpers";
import BottomSheet from "../components/BottomSheet";
import { getCache, setCache } from "../lib/cache";

type Props = {
  settings: GenerationSettings;
  onChangeSettings: (next: GenerationSettings) => void;
  onGenerate: (nextSettings?: GenerationSettings) => Promise<void>;
  onSavePreset: (name: string, nextSettings: GenerationSettings) => Promise<void>;
};

export default function SetupPage({
  settings,
  onChangeSettings,
  onGenerate,
  onSavePreset,
}: Props) {
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetError, setPresetError] = useState<string | null>(null);
  const [presetSaving, setPresetSaving] = useState(false);
  const cached = getCache<{
    sets: PlayerSet[];
    criteriaDefs: CriterionDef[];
  }>("setup_page");
  const [sets, setSets] = useState<PlayerSet[]>(cached?.sets ?? []);
  const [criteriaDefs, setCriteriaDefs] = useState<CriterionDef[]>(
    cached?.criteriaDefs ?? []
  );
  const [playersInSet, setPlayersInSet] = useState<Player[]>([]);

  useEffect(() => {
    void (async () => {
      const rows = await DB.playerSets.orderBy("createdAt").reverse().toArray();
      setSets(rows);
      setCache("setup_page", {
        sets: rows,
        criteriaDefs,
      });
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      await ensureDefaultCriteria();
      const rows = await DB.criteria.orderBy("createdAt").toArray();
      setCriteriaDefs(rows);
      setCache("setup_page", {
        sets,
        criteriaDefs: rows,
      });
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const set = await DB.playerSets.get(settings.playerSetId);
      const ids = set?.playerIds ?? [];
      const players = ids.length
        ? await DB.players
            .bulkGet(ids)
            .then((arr) => arr.filter(Boolean) as Player[])
        : [];
      setPlayersInSet(players);
    })();
  }, [settings.playerSetId]);

  useEffect(() => {
    if (criteriaDefs.length === 0) return;
    const ids = criteriaDefs.map((c) => c.id);
    const filtered = settings.criteriaOrder.filter((id) => ids.includes(id));
    if (filtered.length !== settings.criteriaOrder.length) {
      onChangeSettings({ ...settings, criteriaOrder: filtered });
    }
  }, [criteriaDefs, settings, onChangeSettings]);

  const enabled = settings.criteriaOrder
    .map((id) => criteriaDefs.find((c) => c.id === id))
    .filter(Boolean) as CriterionDef[];
  const disabled = criteriaDefs.filter(
    (c) => !settings.criteriaOrder.includes(c.id)
  );

  function setNumTeams(n: number) {
    onChangeSettings({ ...settings, numTeams: Math.max(2, n) });
  }

  function toggleCriterion(key: string) {
    const has = settings.criteriaOrder.includes(key);
    const next = has
      ? settings.criteriaOrder.filter((k) => k !== key)
      : [...settings.criteriaOrder, key];
    onChangeSettings({ ...settings, criteriaOrder: next });
  }

  function move(key: string, dir: -1 | 1) {
    const idx = settings.criteriaOrder.indexOf(key);
    if (idx < 0) return;
    const next = [...settings.criteriaOrder];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChangeSettings({ ...settings, criteriaOrder: next });
  }

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Setup</h2>
          <p className="text-sm text-slate-400">
            Choose team count and which criteria to consider (priority order).
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-sm font-semibold text-slate-100">Number of teams</div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setNumTeams(settings.numTeams - 1)}
              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
            >
              −
            </button>

            <div className="text-2xl font-semibold">{settings.numTeams}</div>

            <button
              type="button"
              onClick={() => setNumTeams(settings.numTeams + 1)}
              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
            >
              +
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-sm font-semibold text-slate-100">Player set</div>
          <select
            value={settings.playerSetId}
            onChange={(e) => onChangeSettings({ ...settings, playerSetId: e.target.value })}
            className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-sm font-semibold text-slate-100">Criteria</div>
          <div className="mt-1 text-xs text-slate-400">
            Enable criteria and reorder by importance (top = most important).
          </div>
          {settings.criteriaOrder.length === 0 && (
            <div className="mt-2 text-xs text-slate-500">
              No criteria selected — teams will be generated randomly.
            </div>
          )}

          {enabled.length > 0 && playersInSet.length > 0 && (
            (() => {
              const rows = enabled
                .map((c) => ({
                  id: c.id,
                  name: c.name,
                  missing: playersInSet.filter((p) => !p.criteria[c.id]).length,
                }))
                .filter((r) => r.missing > 0);
              if (rows.length === 0) return null;
              return (
                <div className="mt-3 space-y-1 rounded-2xl border border-amber-900/40 bg-amber-950/20 p-3 text-xs text-amber-200">
                  {rows.map((r) => (
                    <div key={r.id}>
                      Missing {r.name}: {r.missing}/{playersInSet.length}
                    </div>
                  ))}
                </div>
              );
            })()
          )}

          <div className="mt-3 min-h-[160px] space-y-2">
            {/* Enabled (ordered) */}
            {criteriaDefs.length === 0 && (
              <div className="space-y-2">
                <div className="h-12 rounded-2xl border border-slate-800 bg-slate-950/50" />
                <div className="h-12 rounded-2xl border border-slate-800 bg-slate-950/50" />
                <div className="h-12 rounded-2xl border border-slate-800 bg-slate-950/50" />
              </div>
            )}
            {enabled.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={() => toggleCriterion(c.id)}
                    className="h-4 w-4 accent-slate-200"
                  />
                  <div className="text-sm font-semibold text-slate-100">{c.name}</div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => move(c.id, -1)}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(c.id, 1)}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}

            {/* Disabled */}
            {disabled.length > 0 && (
              <div className="pt-2">
                <div className="mb-2 text-xs font-semibold text-slate-400">Available</div>
                <div className="space-y-2">
                  {disabled.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => toggleCriterion(c.id)}
                          className="h-4 w-4 accent-slate-200"
                        />
                        <div className="text-sm font-semibold text-slate-100">
                          {c.name}
                        </div>
                      </div>

                      <div className="text-xs text-slate-500">Enable</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-3">
        <button
          type="button"
          onClick={() => void onGenerate()}
          className="w-full rounded-2xl bg-slate-100 px-4 py-4 text-base font-semibold text-slate-950 hover:bg-white"
        >
          Generate teams
        </button>

        <button
          type="button"
          onClick={() => setPresetOpen(true)}
          className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
        >
          Save preset
        </button>
      </div>

      <BottomSheet open={presetOpen} onOpenChange={setPresetOpen} title="Save preset">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-300">Preset name</label>
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g. Co-ed 5v5"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
            />
          </div>
          {presetError && (
            <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-2 text-xs text-red-200">
              {presetError}
            </div>
          )}
          <button
            type="button"
            onClick={async () => {
              if (!presetName.trim()) return;
              setPresetSaving(true);
              setPresetError(null);
              try {
                await onSavePreset(presetName, settings);
                setPresetName("");
                setPresetOpen(false);
              } catch (e) {
                setPresetError(e instanceof Error ? e.message : "Failed to save");
              } finally {
                setPresetSaving(false);
              }
            }}
            disabled={!presetName.trim() || presetSaving}
            className={[
              "w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
              presetName.trim() && !presetSaving
                ? "bg-slate-100 text-slate-950 hover:bg-white"
                : "cursor-not-allowed bg-slate-800 text-slate-500",
            ].join(" ")}
          >
            Save
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
