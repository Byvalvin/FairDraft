import { useEffect, useMemo, useState } from "react";
import PlayersPage from "../pages/PlayersPage";
import SetupPage from "../pages/SetupPage";
import TeamsPage from "../pages/TeamsPage";
import LibraryPage from "../pages/LibraryPage";
import PlayerSetsPage from "../pages/PlayerSetsPage";
import CriteriaPage from "../pages/CriteriaPage";

import type { GenerationSettings } from "../types/gen";
import type { Player } from "../types/domain";
import { DEFAULT_PLAYERSET_ID } from "../storage/playerSetHelpers";
import { DB } from "../storage/DB";
import { generateTeamsV0, generateTeamsV1_numberGreedy, type GeneratedTeams } from "../lib/logic/generateTeams";
import { ensureDefaultCriteria } from "../storage/criteriaHelpers";

type TabKey = "players" | "setup" | "teams" | "library" | "playerSets" | "criteria";

type EpsilonInfo = {
  key: string;
  epsilon: number;
  epsNorm: number;
  stdevN: number;
  range: number;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "players", label: "Players" },
  { key: "setup", label: "Setup" },
  { key: "teams", label: "Teams" },
];

export default function AppShell() {
  const [tab, setTab] = useState<TabKey>("players");

  const [settings, setSettings] = useState<GenerationSettings>({
    playerSetId: DEFAULT_PLAYERSET_ID,
    numTeams: 2,
    criteriaOrder: [],
  });

  const [lastGenerated, setLastGenerated] = useState<GeneratedTeams | null>(
    null
  );
  const [lastEpsilonInfo, setLastEpsilonInfo] = useState<EpsilonInfo | null>(
    null
  );

  useEffect(() => {
    void ensureDefaultCriteria();
  }, []);

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
      case "playerSets":
        return "Player Sets";
      case "criteria":
        return "Criteria";
    }
  }, [tab]);

  async function generateAndGoToTeams(nextSettings?: GenerationSettings) {
    const s = nextSettings ?? settings;

    // Load players from the selected set (Default for now)
    const set = await DB.playerSets.get(s.playerSetId);
    const ids = set?.playerIds ?? [];

    const players: Player[] = ids.length
      ? await DB.players.bulkGet(ids).then((arr) => arr.filter(Boolean) as Player[])
      : [];

    // const result = generateTeamsV0(players, Math.max(2, s.numTeams));
    const numTeams = Math.max(2, s.numTeams);
    // pick first enabled numeric criterion (for now: any key that exists as number on at least one player)
    const criteriaDefs = await DB.criteria.toArray();
    const numericKey =
      s.criteriaOrder.find((key) =>
        criteriaDefs.some((d) => d.id === key && d.type === "number") &&
        players.some((p) => p.criteria[key]?.type === "number")
      ) ?? null;

    function computeEpsilonRawForKey(key: string): EpsilonInfo | null {
      const values: number[] = [];
      for (const p of players) {
        const v = p.criteria[key];
        if (v?.type === "number") values.push(v.value);
      }
      if (values.length < 2) return null;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;
      if (range <= 0) return null;

      const normalized = values.map((v) => (v - min) / range);
      const mean = normalized.reduce((a, b) => a + b, 0) / normalized.length;
      const variance =
        normalized.reduce((a, b) => a + (b - mean) ** 2, 0) /
        normalized.length;
      const stdev = Math.sqrt(variance);
      const epsNorm = Math.max(0.08, stdev);
      const epsRaw = epsNorm * range;

      return {
        key,
        epsilon: epsRaw,
        epsNorm,
        stdevN: stdev,
        range,
      };
    }

    const epsInfo = numericKey ? computeEpsilonRawForKey(numericKey) : null;
    const result = numericKey
      ? generateTeamsV1_numberGreedy(players, numTeams, numericKey, {
          fallbackValue: 60,
          epsilon: epsInfo?.epsilon ?? 0,
        })
      : generateTeamsV0(players, numTeams);

    setLastGenerated(result);
    setLastEpsilonInfo(epsInfo);

    setTab("teams");
  }

  return (
    <div className="h-[100dvh] bg-slate-950 text-slate-50">
      <div className="mx-auto flex h-[100dvh] max-w-md flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex flex-col">
              <div className="text-xs font-medium tracking-wide text-slate-400">
                FairDraft
              </div>
              <div className="text-base font-semibold">{title}</div>
            </div>

            <button
              type="button"
              onClick={() =>
                setTab(tab === "playerSets" || tab === "criteria" ? "library" : "library")
              }
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
            >
              {tab === "playerSets" || tab === "criteria" ? "Back" : "Library"}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4">
          {tab === "players" && <PlayersPage />}

          {tab === "setup" && (
            <SetupPage
              settings={settings}
              onChangeSettings={setSettings}
              onGenerate={generateAndGoToTeams}
            />
          )}

          {tab === "teams" && (
            <TeamsPage
              settings={settings}
              lastGenerated={lastGenerated}
              epsilonInfo={lastEpsilonInfo}
              onReroll={() => generateAndGoToTeams()}
              onGoToSetup={() => setTab("setup")}
            />
          )}

          {tab === "library" && (
            <LibraryPage
              onOpenPlayerSets={() => setTab("playerSets")}
              onOpenCriteria={() => setTab("criteria")}
            />
          )}

          {tab === "playerSets" && (
            <PlayerSetsPage onGoToPlayers={() => setTab("players")} />
          )}

          {tab === "criteria" && <CriteriaPage />}
        </main>

        <nav className="sticky bottom-0 border-t border-slate-800 bg-slate-950/80 backdrop-blur pb-[env(safe-area-inset-bottom)]">
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
