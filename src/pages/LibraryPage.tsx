type Props = {
  onOpenPlayerSets: () => void;
  onOpenCriteria: () => void;
};

export default function LibraryPage({ onOpenPlayerSets, onOpenCriteria }: Props) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Library</h2>
      <p className="text-sm text-slate-400">
        Saved person-sets, presets, results, and export/import.
      </p>

      <button
        type="button"
        onClick={onOpenCriteria}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-left hover:bg-slate-800"
      >
        <div>
          <div className="text-sm font-semibold text-slate-100">Criteria</div>
          <div className="text-xs text-slate-400">Customize player fields</div>
        </div>
        <div className="text-xs font-semibold text-slate-400">Open</div>
      </button>

      <button
        type="button"
        onClick={onOpenPlayerSets}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-left hover:bg-slate-800"
      >
        <div>
          <div className="text-sm font-semibold text-slate-100">Player Sets</div>
          <div className="text-xs text-slate-400">Create and manage sets</div>
        </div>
        <div className="text-xs font-semibold text-slate-400">Open</div>
      </button>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="text-sm text-slate-300">
          Coming next: Saved items + Export/Import
        </div>
      </div>
    </div>
  );
}
