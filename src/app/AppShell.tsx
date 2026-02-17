import { useMemo, useState } from "react";
import PlayersPage from "../pages/PlayersPage";
import SetupPage from "../pages/SetupPage";
import TeamsPage from "../pages/TeamsPage";
import LibraryPage from "../pages/LibraryPage";

type TabKey = "players" | "setup" | "teams" | "library";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "players", label: "Players" },
  { key: "setup", label: "Setup" },
  { key: "teams", label: "Teams" },
];

export default function AppShell() {
  const [tab, setTab] = useState<TabKey>("players");

  const title = useMemo(() => {
    switch (tab) {
      case "players":
        return "Players";
      case "setup":
        return "Setup";
      case "teams":
        return "Teams";
      case "library":
        return "Library";
    }
  }, [tab]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* App frame (keeps desktop from looking too wide) */}
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex flex-col">
              <div className="text-xs font-medium tracking-wide text-slate-400">
                FairDraft
              </div>
              <div className="text-base font-semibold">{title}</div>
            </div>

            <button
              type="button"
              onClick={() => setTab("library")}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
            >
              Library
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 px-4 py-4">
          {tab === "players" && <PlayersPage />}
          {tab === "setup" && <SetupPage />}
          {tab === "teams" && <TeamsPage />}
          {tab === "library" && <LibraryPage />}
        </main>

        {/* Bottom tabs */}
        <nav className="sticky bottom-0 border-t border-slate-800 bg-slate-950/80 backdrop-blur">
          <div className="grid grid-cols-3 gap-2 px-3 py-2">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={[
                    "rounded-2xl px-3 py-3 text-sm font-semibold transition",
                    active
                      ? "bg-slate-100 text-slate-950"
                      : "bg-slate-900 text-slate-200 hover:bg-slate-800",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
