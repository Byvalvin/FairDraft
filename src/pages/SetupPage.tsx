import type { GenerationSettings } from "../types/gen";

type Props = {
  settings: GenerationSettings;
  onChangeSettings: (next: GenerationSettings) => void;
  onGenerate: (nextSettings?: GenerationSettings) => Promise<void>;
};

const AVAILABLE_CRITERIA: Array<{ key: string; label: string }> = [
  { key: "gender", label: "Gender" },
  { key: "position", label: "Position" },
  // rating can be added later:
  { key: "rating", label: "Rating" },
  // { key: "balliq", label: "Balliq" },
];

export default function SetupPage({ settings, onChangeSettings, onGenerate }: Props) {
  const enabled = settings.criteriaOrder
    .map((key) => AVAILABLE_CRITERIA.find((c) => c.key === key))
    .filter(Boolean) as Array<{ key: string; label: string }>;
  const disabled = AVAILABLE_CRITERIA.filter(
    (c) => !settings.criteriaOrder.includes(c.key)
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
        <div className="text-sm font-semibold text-slate-100">Criteria</div>
        <div className="mt-1 text-xs text-slate-400">
          Enable criteria and reorder by importance (top = most important).
        </div>

        <div className="mt-3 space-y-2">
          {/* Enabled (ordered) */}
          {enabled.map((c) => (
            <div
              key={c.key}
              className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={true}
                  onChange={() => toggleCriterion(c.key)}
                  className="h-4 w-4 accent-slate-200"
                />
                <div className="text-sm font-semibold text-slate-100">{c.label}</div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => move(c.key, -1)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(c.key, 1)}
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
                    key={c.key}
                    className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggleCriterion(c.key)}
                        className="h-4 w-4 accent-slate-200"
                      />
                      <div className="text-sm font-semibold text-slate-100">
                        {c.label}
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

      <button
        type="button"
        onClick={() => void onGenerate()}
        className="w-full rounded-2xl bg-slate-100 px-4 py-4 text-base font-semibold text-slate-950 hover:bg-white"
      >
        Generate teams
      </button>
    </div>
  );
}
