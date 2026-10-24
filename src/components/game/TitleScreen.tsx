import { useRef, useState } from "react";
import { displayName, nicknameOf } from "@/lib/game/teams.ts";
import type { TeamId } from "@/lib/game/types.ts";
import { gradeDynasty } from "@/lib/game/grade.ts";
import { displaySaveByteLength, formatBytes } from "@/lib/game/saveFormat.ts";
import { HISTORY_LAST, ROSTERS_LAST } from "@/lib/game/historyYears.ts";
import { useGameStore } from "@/lib/game-store";
import { emptySlot } from "@/lib/save-slots";
import { NetworkBug } from "./Broadcast";
import { SaveSlots } from "./SaveSlots";
import { Btn, Logo } from "./chrome";

const START_YEARS = Array.from({ length: ROSTERS_LAST - 1966 + 1 }, (_, index) => 1966 + index);
export function TitleScreen() {
  const {
    save,
    setScreen,
    continueGame,
    exportJson,
    importJson,
    hasHydrated,
    newSandbox,
    newHistory,
    newLeagueSandbox,
    historyLoading,
    startYear,
    eraBuilding,
    engineLoading,
  } = useGameStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [watchReady, setWatchReady] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [leagueReady, setLeagueReady] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const watching = !!save?.sandbox && !save?.leagueSandbox;
  const realHistory = !!save?.realHistory;
  const [importError, setImportError] = useState("");
  const download = () => {
    const json = exportJson();
    if (!json || json === "null") return;
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nfl-rewind-${save?.leagueSandbox ? "league-architect" : save?.sandbox ? "watch" : (save?.userTeamId ?? "dynasty")}-${save?.year ?? 1966}.json`;
    a.click();
  };
  const grade = save ? gradeDynasty(save) : null;
  const bytes = save ? displaySaveByteLength(save) : 0;
  return (
    <main className="next-title">
      <div className="next-title-scene" aria-hidden />
      <header className="next-title-header">
        <NetworkBug />
        <span className="next-edition">
          <span className="next-edition-label">FRANCHISE FOOTBALL</span>
          <i /> 1966—2040
        </span>
      </header>
      <div className="next-title-layout">
        <div className="next-title-copy">
          <p className="next-kicker">
            <span /> THE FRANCHISE IS YOURS
          </p>
          <h1 className="next-wordmark">
            <span>NFL</span>
            <strong>
              REWIND<span className="next-wordmark-dot">.</span>
            </strong>
          </h1>
          <p className="next-title-tagline">
            History made them legends.
            <br />
            <strong>Your decisions change everything.</strong>
          </p>
          <p className="next-title-description">
            Take the front office. Draft the real classes. Build a dynasty from the first Super Bowl
            to a new era of football.
          </p>
          <StartYearPicker />
          <div className="next-mode-heading">
            <span>CHOOSE YOUR BROADCAST</span>
            <i /> <span>FOUR GAME MODES · RESUME YOUR SEASON</span>
          </div>
          <div className="next-title-actions">
            <Btn kind="primary" className="next-mode-franchise" onClick={() => setScreen("select")}>
              <span className="next-mode-title">Franchise Dynasty</span>
              <span className="next-mode-detail">Run one club. Rewrite history.</span>
              <span className="next-mode-arrow" aria-hidden>
                ↗
              </span>
            </Btn>
            <Btn
              className="next-mode-timeline"
              onClick={() => {
                if (save && !emptySlot() && !watchReady) {
                  setWatchReady(true);
                  return;
                }
                void newSandbox();
              }}
              disabled={eraBuilding || engineLoading}
            >
              <span className="next-mode-title">
                {eraBuilding
                  ? `Building the ${startYear} league…`
                  : engineLoading
                    ? "Loading simulation…"
                    : save && watchReady
                      ? "Replace save and open Alternate Timeline"
                      : startYear === 1966
                        ? "Alternate Timeline"
                        : `Alternate Timeline · ${startYear}`}
              </span>
              <span className="next-mode-detail">Let the league write a new history.</span>
              <span className="next-mode-arrow" aria-hidden>
                ▸
              </span>
            </Btn>
            <Btn
              className="next-mode-record"
              disabled={historyLoading}
              onClick={() => {
                if (save && !emptySlot() && !historyReady) {
                  setHistoryReady(true);
                  return;
                }
                setHistoryError("");
                newHistory().catch(() =>
                  setHistoryError(
                    "History mode's record couldn't be loaded. Check your connection and try again.",
                  ),
                );
              }}
            >
              <span className="next-mode-title">
                {historyLoading
                  ? "Loading the record…"
                  : save && historyReady
                    ? "Replace save and open The Record"
                    : "The Record"}
              </span>
              <span className="next-mode-detail">Relive the NFL, season by season.</span>
              <span className="next-mode-arrow" aria-hidden>
                ⏮
              </span>
            </Btn>
            <Btn
              className="next-mode-architect"
              onClick={() => {
                if (save && !emptySlot() && !leagueReady) {
                  setLeagueReady(true);
                  return;
                }
                void newLeagueSandbox();
              }}
              disabled={eraBuilding || engineLoading}
            >
              <span className="next-mode-title">
                {eraBuilding
                  ? `Building the ${startYear} league…`
                  : engineLoading
                    ? "Loading simulation…"
                    : save && leagueReady
                      ? "Replace save and open League Architect"
                      : "League Architect"}
              </span>
              <span className="next-mode-detail">Run every team. Shape every decision.</span>
              <span className="next-mode-arrow" aria-hidden>
                ◇
              </span>
            </Btn>
            <Btn className="next-mode-continue" onClick={continueGame} disabled={!save}>
              <span className="next-mode-title">Continue Franchise</span>
              <span className="next-mode-detail">Pick up where your season left off.</span>
              <span className="next-mode-arrow" aria-hidden>
                ↗
              </span>
            </Btn>
          </div>
          {watchReady && save && (
            <p role="alert" className="text-sm text-brass">
              All five save slots are full: watching history replaces the save in this one. Clear a
              slot below to keep it.
            </p>
          )}
          {historyReady && save && (
            <p role="alert" className="text-sm text-brass">
              All five save slots are full: History mode replaces the save in this one. Clear a slot
              below to keep it.
            </p>
          )}
          {leagueReady && save && (
            <p role="alert" className="text-sm text-brass">
              All five save slots are full: League Architect replaces the save in this one. Clear a
              slot below to keep it.
            </p>
          )}
          {historyError && (
            <p role="alert" className="text-sm text-brick">
              {historyError}
            </p>
          )}
          <p className="text-sm text-muted">
            <strong>Franchise Dynasty</strong>: run one club and rewrite history.{" "}
            <strong>Alternate Timeline</strong>: let the CPU run every club from your chosen start
            year and watch a new league unfold.
          </p>
          <p className="text-sm text-muted">
            Start years after 1966 open on the real rosters of that season, with every real stat
            line, champion and Hall of Famer before it. Real draft classes come in through 2025;
            after that the scouts find their own. Seasons run to 2040.
          </p>
          <p className="text-sm text-muted">
            <strong>The Record</strong>: replay the NFL exactly as it happened, 1966 to{" "}
            {HISTORY_LAST}. Real rosters, scores, playoffs, drafts, awards, stats and Hall of Fame
            classes. <strong>League Architect</strong>: switch among clubs and assign each
            front-office job to you or the CPU.
          </p>
          <SaveSlots />
          <div className="next-file-actions">
            <Btn onClick={download} disabled={!save}>
              Export dynasty JSON
            </Btn>
            <Btn onClick={() => fileRef.current?.click()}>Import dynasty JSON</Btn>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setImportError("");
                void f
                  .text()
                  .then(importJson)
                  .catch(() =>
                    setImportError(
                      "This file could not be imported. Choose a valid NFL Rewind dynasty JSON. Your current dynasty has not been replaced.",
                    ),
                  );
                e.target.value = "";
              }}
            />
          </div>
          {importError && (
            <p role="alert" className="text-sm text-brick">
              {importError}
            </p>
          )}
          {!hasHydrated && <p className="text-sm text-muted">Reading the file…</p>}
          {hasHydrated && historyLoading && !save && (
            <p className="text-sm text-muted">Rewinding History mode to where you left it…</p>
          )}
          {save && hasHydrated && (
            <p className="text-sm text-paper">
              {realHistory
                ? "The Record"
                : watching
                  ? "Alternate Timeline"
                  : save.leagueSandbox
                    ? `League Architect · ${displayName(save.year, save.userTeamId)}`
                    : displayName(save.year, save.userTeamId)}{" "}
              · {save.year} · {save.weekLabel}
              {!watching && !save.leagueSandbox && grade && grade.seasons > 0
                ? ` · ${grade.letter}`
                : ""}
              {bytes ? ` · ${formatBytes(bytes)}` : ""}
            </p>
          )}
        </div>
        <aside className="next-dynasty-card" aria-label="Your dynasty">
          <div className="next-card-label">
            <span>{save ? "YOUR FRANCHISE" : "THE OPENING CHAPTER"}</span>
            <span className="next-status-dot" />
          </div>
          {save && watching ? (
            <>
              <div className="next-resume-club">
                <div>
                  <span>
                    {save.year} / {save.weekLabel}
                  </span>
                  <h2>{realHistory ? "The Record" : "Alternate Timeline"}</h2>
                </div>
              </div>
              <div className="next-resume-stats">
                <div>
                  <span>SEASONS</span>
                  <strong>{save.history.superBowls.length}</strong>
                </div>
                <div>
                  <span>LAST CHAMP</span>
                  <strong>
                    {(() => {
                      const b = save.history.superBowls.at(-1);
                      return b
                        ? nicknameOf(
                            b.year,
                            (b.homeScore >= b.awayScore ? b.homeId : b.awayId) as TeamId,
                          )
                        : "—";
                    })()}
                  </strong>
                </div>
              </div>
              <button className="next-card-action" onClick={continueGame}>
                Back to the broadcast <span aria-hidden>↗</span>
              </button>
            </>
          ) : save ? (
            <>
              <div className="next-resume-club">
                <Logo id={save.userTeamId} year={save.year} size={72} />
                <div>
                  <span>
                    {save.year} / {save.weekLabel}
                  </span>
                  <h2>
                    {save.leagueSandbox
                      ? "League Architect"
                      : displayName(save.year, save.userTeamId)}
                  </h2>
                </div>
              </div>
              <div className="next-resume-stats">
                <div>
                  <span>{save.leagueSandbox ? "ACTIVE CLUB" : "RECORD"}</span>
                  <strong>
                    {save.leagueSandbox
                      ? displayName(save.year, save.userTeamId)
                      : `${save.teams[save.userTeamId].wins}–${save.teams[save.userTeamId].losses}${save.teams[save.userTeamId].ties ? `–${save.teams[save.userTeamId].ties}` : ""}`}
                  </strong>
                </div>
                <div>
                  <span>{save.leagueSandbox ? "CONTROL" : "DYNASTY GRADE"}</span>
                  <strong>{save.leagueSandbox ? "YOU + CPU" : (grade?.letter ?? "—")}</strong>
                </div>
              </div>
              <button className="next-card-action" onClick={continueGame}>
                {save.leagueSandbox ? "Return to the league office" : "Return to the front office"}{" "}
                <span aria-hidden>↗</span>
              </button>
            </>
          ) : (
            <>
              <span className="next-year">1966</span>
              <h2>
                A new league.
                <br />
                An unwritten legacy.
              </h2>
              <p>24 clubs. The first Super Bowl. Every future draft class waiting for your call.</p>
              <button className="next-card-action" onClick={() => setScreen("select")}>
                Choose your franchise <span aria-hidden>↗</span>
              </button>
            </>
          )}
        </aside>
      </div>
      <div className="next-title-bottom">
        <div className="title-pillars">
          <div>
            <span className="next-feature-number">01 / BUILD</span>
            <strong>The front office</strong>
            <span>Real draft classes. Your roster. Your identity.</span>
          </div>
          <div>
            <span className="next-feature-number">02 / COMPETE</span>
            <strong>Every Sunday matters</strong>
            <span>Set the call sheet. Watch the story unfold.</span>
          </div>
          <div>
            <span className="next-feature-number">03 / BECOME</span>
            <strong>A lasting dynasty</strong>
            <span>Six decades of football. One legacy.</span>
          </div>
        </div>
        <div className="next-title-footnote">
          <span>HISTORICAL DYNASTY EXPERIENCE</span>
          <span>
            1966 <i /> 2040
          </span>
        </div>
      </div>
    </main>
  );
}

/** The season to start in: 1966, or any later year built from the real rosters. A decade, then its seasons. */
export function StartYearPicker() {
  const year = useGameStore((s) => s.startYear);
  const setYear = useGameStore((s) => s.setStartYear);
  const decadeOf = (y: number) => Math.floor(y / 10) * 10;
  // The decade follows the chosen season, so it survives the title screen redrawing.
  const decade = decadeOf(year);
  const decades = [...new Set(START_YEARS.map(decadeOf))];
  const seasons = START_YEARS.filter((y) => decadeOf(y) === decade);
  return (
    <div className="k5-years" role="radiogroup" aria-label="Start year">
      <p>
        <span>START YEAR</span>{" "}
        {year === 1966 ? "The first Super Bowl season" : `The real ${year} rosters`}
      </p>
      <div className="k5-decades" role="tablist" aria-label="Decade">
        {decades.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={decade === d}
            className={decade === d ? "is-open" : ""}
            onClick={() => decade !== d && setYear(START_YEARS.find((y) => decadeOf(y) === d)!)}
          >
            {d === 2000
              ? "2000s"
              : d === 2010
                ? "2010s"
                : d === 2020
                  ? "2020s"
                  : `'${String(d).slice(2)}s`}
          </button>
        ))}
      </div>
      <div>
        {seasons.map((y) => (
          <button
            key={y}
            type="button"
            role="radio"
            aria-checked={year === y}
            className={year === y ? "is-on" : ""}
            onClick={() => setYear(y)}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  );
}
