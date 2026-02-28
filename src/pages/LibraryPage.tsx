import { useEffect, useRef, useState } from "react";
import { DB } from "../storage/DB";
import BottomSheet from "../components/BottomSheet";

type Props = {
  onOpenPlayerSets: () => void;
  onOpenCriteria: () => void;
  onOpenPresets: () => void;
  onOpenResults: () => void;
};

export default function LibraryPage({
  onOpenPlayerSets,
  onOpenCriteria,
  onOpenPresets,
  onOpenResults,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [replaceAll, setReplaceAll] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [lastImportAt, setLastImportAt] = useState<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("fairdraft_last_backup_at");
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n)) setLastBackupAt(n);
    }
    const rawImport = localStorage.getItem("fairdraft_last_import_at");
    if (rawImport) {
      const n = Number(rawImport);
      if (Number.isFinite(n)) setLastImportAt(n);
    }
  }, []);

  async function handleExport() {
    setBackupError(null);
    setBackupStatus("Preparing export…");
    try {
      const [players, playerSets, criteria, presets, results] = await Promise.all([
        DB.players.toArray(),
        DB.playerSets.toArray(),
        DB.criteria.toArray(),
        DB.presets.toArray(),
        DB.results.toArray(),
      ]);

      const payload = {
        version: 1,
        exportedAt: Date.now(),
        data: { players, playerSets, criteria, presets, results },
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fairdraft-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const now = Date.now();
      localStorage.setItem("fairdraft_last_backup_at", String(now));
      setLastBackupAt(now);
      setBackupStatus("Exported.");
      setTimeout(() => setBackupStatus(null), 1500);
    } catch (e) {
      setBackupStatus(null);
      setBackupError(e instanceof Error ? e.message : "Failed to export");
    }
  }

  async function handleImportFile(file: File, mode: "merge" | "replace") {
    setBackupError(null);
    setBackupStatus("Importing…");
    try {
      const text = await file.text();
      const json = JSON.parse(text) as {
        version?: number;
        data?: {
          players?: unknown[];
          playerSets?: unknown[];
          criteria?: unknown[];
          presets?: unknown[];
          results?: unknown[];
        };
      };

      const data = json.data ?? {};
      await DB.transaction("rw", DB.players, DB.playerSets, DB.criteria, DB.presets, DB.results, async () => {
        if (mode === "replace") {
          await DB.players.clear();
          await DB.playerSets.clear();
          await DB.criteria.clear();
          await DB.presets.clear();
          await DB.results.clear();
        }
        if (Array.isArray(data.players) && data.players.length > 0) {
          // @ts-expect-error trusted import
          await DB.players.bulkPut(data.players);
        }
        if (Array.isArray(data.playerSets) && data.playerSets.length > 0) {
          // @ts-expect-error trusted import
          await DB.playerSets.bulkPut(data.playerSets);
        }
        if (Array.isArray(data.criteria) && data.criteria.length > 0) {
          // @ts-expect-error trusted import
          await DB.criteria.bulkPut(data.criteria);
        }
        if (Array.isArray(data.presets) && data.presets.length > 0) {
          // @ts-expect-error trusted import
          await DB.presets.bulkPut(data.presets);
        }
        if (Array.isArray(data.results) && data.results.length > 0) {
          // @ts-expect-error trusted import
          await DB.results.bulkPut(data.results);
        }
      });

      const now = Date.now();
      localStorage.setItem("fairdraft_last_import_at", String(now));
      setLastImportAt(now);
      setBackupStatus("Import complete.");
      setTimeout(() => setBackupStatus(null), 1500);
    } catch (e) {
      setBackupStatus(null);
      setBackupError(e instanceof Error ? e.message : "Failed to import");
    }
  }

  function buildSampleBackup() {
    const now = Date.now();
    const players = [
      { id: "player_demo_1", name: "Alex", criteria: { rating: { type: "number", value: 78 }, position: { type: "category", value: "Midfield" }, gender: { type: "category", value: "male" } }, createdAt: now, updatedAt: now },
      { id: "player_demo_2", name: "Jordan", criteria: { rating: { type: "number", value: 72 }, position: { type: "category", value: "Defense" }, gender: { type: "category", value: "female" } }, createdAt: now, updatedAt: now },
      { id: "player_demo_3", name: "Casey", criteria: { rating: { type: "number", value: 81 }, position: { type: "category", value: "Forward" }, gender: { type: "category", value: "male" } }, createdAt: now, updatedAt: now },
      { id: "player_demo_4", name: "Riley", criteria: { rating: { type: "number", value: 68 }, position: { type: "category", value: "Goalkeeper" }, gender: { type: "category", value: "female" } }, createdAt: now, updatedAt: now },
    ];
    const playerSets = [
      { id: "playerset_default", name: "Default", playerIds: players.map((p) => p.id), createdAt: now, updatedAt: now },
      { id: "playerset_demo", name: "Demo Set", playerIds: players.map((p) => p.id), createdAt: now, updatedAt: now },
    ];
    const criteria = [
      { id: "rating", name: "Rating", type: "number", createdAt: now, updatedAt: now },
      { id: "position", name: "Position", type: "category", options: ["Goalkeeper", "Defense", "Midfield", "Forward"], createdAt: now, updatedAt: now },
      { id: "gender", name: "Gender", type: "category", options: ["male", "female"], createdAt: now, updatedAt: now },
    ];
    const presets = [];
    const results = [];
    return {
      version: 1,
      exportedAt: now,
      data: { players, playerSets, criteria, presets, results },
    };
  }

  function handleDownloadSample() {
    const sample = buildSampleBackup();
    const blob = new Blob([JSON.stringify(sample, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fairdraft-sample-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

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

      <button
        type="button"
        onClick={onOpenPresets}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-left hover:bg-slate-800"
      >
        <div>
          <div className="text-sm font-semibold text-slate-100">Presets</div>
          <div className="text-xs text-slate-400">Save and reuse setups</div>
        </div>
        <div className="text-xs font-semibold text-slate-400">Open</div>
      </button>

      <button
        type="button"
        onClick={onOpenResults}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-left hover:bg-slate-800"
      >
        <div>
          <div className="text-sm font-semibold text-slate-100">Saved Results</div>
          <div className="text-xs text-slate-400">Teams you saved</div>
        </div>
        <div className="text-xs font-semibold text-slate-400">Open</div>
      </button>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="text-sm font-semibold text-slate-100">Backup</div>
        <div className="mt-1 text-xs text-slate-400">
          Your data is stored locally on this device. Export to keep a backup.
        </div>
        {lastBackupAt && (
          <div className="mt-1 text-xs text-slate-500">
            Last backup: {new Date(lastBackupAt).toLocaleString()}
          </div>
        )}
        {lastImportAt && (
          <div className="mt-1 text-xs text-slate-500">
            Last import: {new Date(lastImportAt).toLocaleString()}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Import JSON
          </button>
          <button
            type="button"
            onClick={handleDownloadSample}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Sample JSON
          </button>
        </div>
        {backupStatus && (
          <div className="mt-2 text-xs text-slate-400">{backupStatus}</div>
        )}
        {backupError && (
          <div className="mt-2 rounded-xl border border-red-900/40 bg-red-950/30 p-2 text-xs text-red-200">
            {backupError}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setPendingFile(file);
              setConfirmOpen(true);
            }
            e.currentTarget.value = "";
          }}
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="text-sm text-slate-300">
          Coming next: Tips, examples, and more tools.
        </div>
      </div>

        <BottomSheet
          open={confirmOpen}
          onOpenChange={(open) => {
            setConfirmOpen(open);
            if (!open) setPendingFile(null);
          }}
          title="Import backup"
        >
        <div className="space-y-3 text-sm text-slate-300">
          <div>
            This will merge data from your backup into this device. Items with
            the same IDs will be overwritten.
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={replaceAll}
              onChange={(e) => setReplaceAll(e.target.checked)}
              className="h-4 w-4 accent-slate-200"
            />
            Replace all existing data before import
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (pendingFile)
                  void handleImportFile(pendingFile, replaceAll ? "replace" : "merge");
                setConfirmOpen(false);
                setPendingFile(null);
                setReplaceAll(false);
              }}
              className="w-full rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-white"
            >
              Import
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
