import { DraftAnnouncerProvider } from "./DraftAnnouncer";
import { useEffect, useMemo, useRef, useState } from "react";
import { FranchiseHQ, OpponentPreview } from './FranchiseHQ';
import {
  ACTIVE_1966,
  activateFromIR,
  activeRosterOf,
  activeTeamIds,
  allDecadeTeam,
  availableCoaches,
  availableDecades,
  canReturnFromIR,
  careerRecordBook,
  careerTotals,
  playerName,
  cutPlayer,
  depthChart,
  deskFire,
  deskHire,
  deskScheme,
  deskPlan,
  deskResetPlan,
  deskHoles,
  planFor,
  playbookOf,
  staffPlan,
  staffSystems,
  displayName,
  END_YEAR,
  formatBytes,
  formatMoney,
  gameRecordBook,
  gamesForTeam,
  playoffTotals,
  type SeasonStats,
  gameDateLabel,
  realResultFor,
  gamesInWeek,
  gradeDynasty,
  hasSeasonWork,
  isStarter,
  locationOf,
  moveDepth,
  nicknameOf,
  originalLeague,
  placeOnIR,
  ROSTER_TARGET,
  rosterOf,
  saveByteLength,
  standingRows,
  starterCount,
  statCols,
  statGroup,
  teamPayroll,
  venueOf,
  visibleOvr,
  weekIsInTheBooks,
  type Player,
  type Pos,
  type TeamId,
  type Gameplan,
  type HofMember,
} from "@/lib/game";
import { useGameStore, type Tab } from "@/lib/game-store";
import { MarketDesk } from "./MarketDesk";
import { TeamHistory } from "./TeamHistory";
import { CoachingTrees } from "./CoachingTrees";
import { HotNames } from "./HotNames";
import { DraftReportCard } from "./DraftReportCard";
import { HallOfFame } from "./HallOfFame";
import { HISTORY_LAST, leagueHistoryHtml, roman, seasonLeaders, seasonRecordBook, superBowlSite } from "@/lib/game";
import { PrimetimeShow, PrimetimeTeaser } from "./PrimetimeShow";
import { OwnersBox, RelocationOffer } from "./OwnersBox";
import { CrunchCall } from "./CrunchCall";
import { BottomLine, ClubPlate, NetworkBug, WatchPlate, TabStrip } from "./Broadcast";
import { MatchupNotes, SeasonPlanCard, TrophyCase } from "./Storylines";
import { TimelineSection } from "./Timeline";
import { LegacySection } from "./Legacy";
import { PhoneLine } from "./MarketLife";
import { byeNote, clubInk, endHoldout, holdoutAsk } from "@/lib/game";
import { DraftNight } from "./DraftNight";
import { SuperBowlNight } from "./SuperBowlNight";
import { GameNight } from "./GameNight";
import { GameWeekPrep } from "./Gameday";
import { DepthField } from "./DepthField";
import { FilmStill } from "./Art";
import { KitChips, CoachChips } from "./KitChips";
import { HistoryBoxModal } from "./HistoryLive";
import { PlayerLink, PlayerProfile } from "./PlayerProfile";
import { TeamRosterModal } from "./TeamRoster";
import { LeagueDirectory } from "./LeagueDirectory";
import { ExpansionNight } from "./ExpansionNight";
import { GradeCard } from "./GradeCard";
import { FranchiseBook } from "./FranchiseBook";
import { FreeAgencyNight } from "./FreeAgencyNight";
import { CampNight } from "./CampNight";
import { DeadlineNight } from "./DeadlineNight";
import { SundayNight } from "./SundayNight";
import { HistoryCheck, WatchBar, WatchDesk, WatchMoves } from "./Sandbox";
import { HistoryDesk, HistoryDraft } from "./HistoryMode";
import { SaveSlots } from "./SaveSlots";
import { WatchTV } from "./WatchTV";
import { Rulebook } from "./WatchStories";
import { SettingsSheet } from "./SettingsSheet";
import { Tour } from "./Tour";
import { WATCH_TOUR } from "./tours";
import { Btn, ClubDesk, ClubHash, ClubRibbon, Logo } from "./chrome";
import { gradeTone } from "./tone";
import {
  AwardsNight,
  CarouselNight,
  HofNight,
  ProBowlNight,
  RelocationNight,
  RetirementNight,
} from "./WinterNights";

function TitleScreen() {
  const { save, setScreen, continueGame, exportJson, importJson, hasHydrated, newSandbox, newHistory, historyLoading } = useGameStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [watchReady, setWatchReady] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const watching = !!save?.sandbox;
  const realHistory = !!save?.realHistory;
  const [importError, setImportError] = useState('');
  const download = () => {
    const json = exportJson();
    if (!json || json === "null") return;
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nfl-rewind-${save?.sandbox ? "watch" : save?.userTeamId ?? "dynasty"}-${save?.year ?? 1966}.json`;
    a.click();
  };
  const grade = save ? gradeDynasty(save) : null;
  const bytes = save ? saveByteLength(save) : 0;
  return (
    <main className="next-title">
      <div className="next-title-scene" aria-hidden />
      <header className="next-title-header"><NetworkBug /><span className="next-edition"><span className="next-edition-label">FRANCHISE FOOTBALL</span><i /> 1966—2027</span></header>
      <div className="next-title-layout">
      <div className="next-title-copy">
      <p className="next-kicker"><span /> THE FRANCHISE IS YOURS</p>
      <h1 className="next-wordmark"><span>NFL</span><strong>REWIND<span className="next-wordmark-dot">.</span></strong></h1>
      <p className="next-title-tagline">History made them legends.<br /><strong>Your decisions change everything.</strong></p>
      <p className="next-title-description">Take the front office. Draft the real classes. Build a dynasty from the first Super Bowl to a new era of football.</p>
      <div className="next-title-actions">
        <Btn kind="primary" onClick={() => setScreen("select")}>
          New dynasty <span aria-hidden>↗</span>
        </Btn>
        <Btn
          onClick={() => {
            if (save && !watchReady) {
              setWatchReady(true);
              return;
            }
            newSandbox();
          }}
        >
          {save && watchReady ? "Replace save and watch" : "Watch history"} <span aria-hidden>▸</span>
        </Btn>
        <Btn
          disabled={historyLoading}
          onClick={() => {
            if (save && !historyReady) {
              setHistoryReady(true);
              return;
            }
            setHistoryError("");
            newHistory().catch(() => setHistoryError("History mode's record couldn't be loaded. Check your connection and try again."));
          }}
        >
          {historyLoading ? "Loading the record…" : save && historyReady ? "Replace save and open History mode" : "History mode"} <span aria-hidden>⏮</span>
        </Btn>
        <Btn onClick={continueGame} disabled={!save}>
          Continue
        </Btn>
      </div>
      {watchReady && save && (
        <p role="alert" className="text-sm text-brass">
          Watching history starts a new league and replaces the save in this slot. Pick an empty slot below to keep it.
        </p>
      )}
      {historyReady && save && (
        <p role="alert" className="text-sm text-brass">
          History mode starts at the 1966 draft and replaces the save in this slot. Pick an empty slot below to keep it.
        </p>
      )}
      {historyError && <p role="alert" className="text-sm text-brick">{historyError}</p>}
      <p className="text-sm text-muted">Watch history: no team to run. The computer runs every club from 1966 on, and you watch it unfold.</p>
      <p className="text-sm text-muted">History mode: the NFL exactly as it happened, 1966 to {HISTORY_LAST}. Real rosters, scores, playoffs, drafts, awards, stats and Hall of Fame classes, step by step. Nothing simulated.</p>
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
            setImportError('');
            void f.text().then(importJson).catch(() => setImportError('This file could not be imported. Choose a valid NFL Rewind dynasty JSON. Your current dynasty has not been replaced.'));
            e.target.value = '';
          }}
        />
      </div>
      {importError && <p role="alert" className="text-sm text-brick">{importError}</p>}
      {!hasHydrated && <p className="text-sm text-muted">Reading the file…</p>}
      {hasHydrated && historyLoading && !save && <p className="text-sm text-muted">Rewinding History mode to where you left it…</p>}
      {save && hasHydrated && (
        <p className="text-sm text-paper">
          {realHistory ? "History mode" : watching ? "Watching history" : displayName(save.year, save.userTeamId)} · {save.year} · {save.weekLabel}
          {!watching && grade && grade.seasons > 0 ? ` · ${grade.letter}` : ""}
          {bytes ? ` · ${formatBytes(bytes)}` : ""}
        </p>
      )}
      </div>
      <aside className="next-dynasty-card" aria-label="Your dynasty">
        <div className="next-card-label"><span>{save ? 'YOUR FRANCHISE' : 'THE OPENING CHAPTER'}</span><span className="next-status-dot" /></div>
        {save && watching ? <><div className="next-resume-club"><div><span>{save.year} / {save.weekLabel}</span><h2>{realHistory ? "History mode" : "Watching history"}</h2></div></div><div className="next-resume-stats"><div><span>SEASONS</span><strong>{save.history.superBowls.length}</strong></div><div><span>LAST CHAMP</span><strong>{(() => { const b = save.history.superBowls.at(-1); return b ? nicknameOf(b.year, (b.homeScore >= b.awayScore ? b.homeId : b.awayId) as TeamId) : '—'; })()}</strong></div></div><button className="next-card-action" onClick={continueGame}>Back to the broadcast <span aria-hidden>↗</span></button></> : save ? <><div className="next-resume-club"><Logo id={save.userTeamId} year={save.year} size={72} /><div><span>{save.year} / {save.weekLabel}</span><h2>{displayName(save.year, save.userTeamId)}</h2></div></div><div className="next-resume-stats"><div><span>RECORD</span><strong>{save.teams[save.userTeamId].wins}–{save.teams[save.userTeamId].losses}{save.teams[save.userTeamId].ties ? `–${save.teams[save.userTeamId].ties}` : ''}</strong></div><div><span>DYNASTY GRADE</span><strong>{grade?.letter ?? '—'}</strong></div></div><button className="next-card-action" onClick={continueGame}>Return to the front office <span aria-hidden>↗</span></button></> : <><span className="next-year">1966</span><h2>A new league.<br />An unwritten legacy.</h2><p>24 clubs. The first Super Bowl. Every future draft class waiting for your call.</p><button className="next-card-action" onClick={() => setScreen('select')}>Choose your franchise <span aria-hidden>↗</span></button></>}
      </aside>
      </div>
      <div className="next-title-bottom"><div className="title-pillars"><div><span className="next-feature-number">01 / BUILD</span><strong>The front office</strong><span>Real draft classes. Your roster. Your identity.</span></div><div><span className="next-feature-number">02 / COMPETE</span><strong>Every Sunday matters</strong><span>Set the call sheet. Watch the story unfold.</span></div><div><span className="next-feature-number">03 / BECOME</span><strong>A lasting dynasty</strong><span>Six decades of football. One legacy.</span></div></div><div className="next-title-footnote"><span>HISTORICAL DYNASTY EXPERIENCE</span><span>1966 <i /> 2027</span></div>
      </div>
    </main>
  );
}

function TeamSelect() {
  const { newGame, setScreen, save } = useGameStore();
  const [selectedTeam, setSelectedTeam] = useState<TeamId | null>(null);
  const [replaceReady, setReplaceReady] = useState(false);
  const nfl = ACTIVE_1966.filter((id) => originalLeague(id) === "NFL");
  const afl = ACTIVE_1966.filter((id) => originalLeague(id) === "AFL");
  const Group = ({ title, ids }: { title: string; ids: readonly TeamId[] }) => (
    <section className="space-y-3">
      <h2 className="text-lg tracking-[0.2em] text-muted">{title}</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => { setSelectedTeam(id); setReplaceReady(false); }}
            aria-pressed={selectedTeam === id}
            className={`group relative flex min-h-16 items-center gap-3 overflow-hidden border bg-gradient-to-b from-[#1b2130]/95 to-[#0a0d14]/95 pr-3 text-left shadow-[inset_0_1px_0_#ffffff1a] backdrop-blur-sm transition-all hover:border-red/70 hover:brightness-125 ${selectedTeam === id ? 'border-brass ring-1 ring-brass' : 'border-white/10'}`}
          >
            <span
              className="flex h-full min-h-16 w-16 shrink-0 items-center justify-center [clip-path:polygon(0_0,100%_0,82%_100%,0_100%)]"
              style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${clubInk(id, 1966).primary} 75%, white), ${clubInk(id, 1966).primary} 50%, color-mix(in srgb, ${clubInk(id, 1966).primary} 65%, black))` }}
            >
              <Logo id={id} size={40} year={1966} />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-xs font-bold uppercase italic tracking-[0.14em] text-muted">{locationOf(1966, id)}</span>
              <span className="block font-display text-2xl font-extrabold uppercase italic leading-none">{nicknameOf(1966, id)}</span>
            </span>
            <span className="ml-auto font-display text-xl font-black italic text-red opacity-0 transition group-hover:opacity-100" aria-hidden>
              ▸
            </span>
          </button>
        ))}
      </div>
    </section>
  );
  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <FilmStill still="office" veil="full" />
      <div className="relative mx-auto max-w-4xl space-y-8 px-5 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-display text-xs tracking-[0.35em] text-brass">1966 media guide</p>
          <h1 className="text-5xl sm:text-6xl">Choose your club</h1>
        </div>
        <Btn onClick={() => setScreen("title")}>Back</Btn>
      </div>
      <Group title="National Football League" ids={nfl} />
      <Group title="American Football League" ids={afl} />
      {selectedTeam && <section className="sticky bottom-3 z-10 rounded-xl border border-brass/50 bg-[#0d1524f5] p-4 shadow-2xl backdrop-blur-md" aria-label="Selected franchise">
        <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><Logo id={selectedTeam} year={1966} size={46}/><div><p className="text-xs text-brass">YOUR FRANCHISE · 1966</p><h2 className="mt-1 text-2xl">{displayName(1966, selectedTeam)}</h2><p className="mt-1 text-xs text-muted">{venueOf(1966, selectedTeam).stadium} · {originalLeague(selectedTeam)}</p></div></div><Btn kind="primary" onClick={() => { if (save && !replaceReady) { setReplaceReady(true); return; } newGame(selectedTeam); }}>{save && replaceReady ? 'Replace dynasty and begin' : 'Begin your dynasty'}</Btn></div>
        {save && replaceReady && <p role="alert" className="mt-3 text-sm text-brass">Starting replaces the {displayName(save.year, save.userTeamId)} dynasty in this slot. Go back to the title and pick an empty save slot to keep it.</p>}
      </section>}
      <p className="text-xs text-subtle">
        Club marks are original designs in each club&apos;s colors, not official NFL logos. Mascot icons by Lorc,
        Delapouite and contributors at{" "}
        <a className="underline" href="https://game-icons.net" target="_blank" rel="noreferrer">
          game-icons.net
        </a>
        , licensed CC BY 3.0.
      </p>
      </div>
    </main>
  );
}

function PhaseAction() {
  const { save, step, resign } = useGameStore();
  if (!save) return null;
  const label: Record<string, string> = {
    draft: "Stay on the clock / auto rest",
    freeAgency: "Close free agency",
    expansion: save.expansion?.done ? "Open the college draft" : "Complete expansion",
    preseason: "Kick off the regular season",
    regular: save.weekFilm || (save.phase === "regular" && weekIsInTheBooks(save)) ? "Next week" : "Sim this Sunday",
    deadline: "Close the window",
    playoffs: "Sim playoff games",
    superBowl: save.superBowl?.played ? "Continue to awards" : "Play Super Bowl",
    awards: "Continue to the Pro Bowl",
    proBowl: "Retirement ceremony",
    retirement: "Canton",
    hof: save.year >= END_YEAR ? "Close the books" : "Coaching carousel",
    carousel: "Turn the calendar",
    relocation: save.expansion ? "Expansion draft" : "Open the college draft",
    complete: "Return to title",
  };
  const onClick = () => {
    if (save.phase === "complete") {
      resign();
      return;
    }
    if (save.phase === "draft") step({ auto: false });
    else if (save.phase === "freeAgency") step({ closeFa: true });
    else step({});
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn kind="primary" onClick={onClick} className="min-h-12 px-7 text-lg">
        {label[save.phase] ?? "Continue"} <span aria-hidden>▸</span>
      </Btn>
      <BatchSim />
    </div>
  );
}

/** "Sim to the deadline" / "Sim to the playoffs". Stops early when a club calls. */
function BatchSim() {
  const save = useGameStore((s) => s.save)!;
  const simTo = useGameStore((s) => s.simTo);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  if (save.phase !== "regular" || save.cpuOnly) return null;
  const deadlineOpen = !(save.deadline?.year === save.year);
  const go = (target: "deadline" | "playoffs") => {
    setBusy(target);
    setNote(null);
    // Let the label paint before the main thread goes to work.
    setTimeout(() => {
      const why = simTo(target);
      setBusy(null);
      setNote(why === "call" ? "A club is on the phone. Take the call in the Office." : null);
    }, 30);
  };
  return (
    <>
      {deadlineOpen && (
        <Btn className="min-h-12 px-4 text-sm" disabled={!!busy} onClick={() => go("deadline")}>
          {busy === "deadline" ? "Simming…" : "Sim to the deadline ▸▸"}
        </Btn>
      )}
      <Btn className="min-h-12 px-4 text-sm" disabled={!!busy} onClick={() => go("playoffs")}>
        {busy === "playoffs" ? "Simming…" : "Sim to the playoffs ▸▸"}
      </Btn>
      {note && <p className="w-full text-sm text-brass">{note}</p>}
    </>
  );
}

function DeskReport() {
  const save = useGameStore((s) => s.save)!;
  const setTab = useGameStore((s) => s.setTab);
  const holes = deskHoles(save, save.userTeamId);
  const roster = rosterOf(save, save.userTeamId);
  const t = save.teams[save.userTeamId];
  const career = `${t.careerWins ?? 0}-${t.careerLosses ?? 0}${t.careerTies ? `-${t.careerTies}` : ""}`;
  const thin = holes.length > 0;
  const headingToSunday =
    save.phase === "preseason" ||
    save.phase === "freeAgency" ||
    (save.phase === "draft" && save.year > save.startingYear);
  return (
    <section className={`rounded-xl border p-4 ${thin ? "border-brick/50 bg-surface" : "border-line bg-surface"}`}>
      <p className="text-xs tracking-[0.25em] text-muted">THE DESK</p>
      <p className="mt-1 text-sm">
        Roster {roster.length} · career {career}
        {thin ? " · holes the league will not fill for you" : ""}
      </p>
      {thin ? (
        <ul className="mt-2 space-y-1 text-sm">
          {holes.map((h) => (
            <li key={h.pos} className="flex justify-between gap-3">
              <span className="text-brick">{h.pos}</span>
              <span className="tabular text-muted">
                {h.healthy} healthy / need {h.need}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">Depth is covered. The next cut stays a hole unless you sign.</p>
      )}
      {thin && headingToSunday && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-brick">Kick off thin and it is on you. The CPU will not paper over the roster.</p>
          <Btn kind="brick" className="min-h-9 px-3 text-xs" onClick={() => setTab("market")}>
            Open the market
          </Btn>
        </div>
      )}
    </section>
  );
}

function Office() {
  const save = useGameStore((s) => s.save)!;
  const team = save.teams[save.userTeamId];
  const rec = `${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ""}`;
  const career = `${team.careerWins ?? 0}-${team.careerLosses ?? 0}${team.careerTies ? `-${team.careerTies}` : ""}`;
  const hc = team.coachId ? save.coaches[team.coachId] : undefined;
  const oc = team.ocId ? save.coaches[team.ocId] : undefined;
  const dc = team.dcId ? save.coaches[team.dcId] : undefined;
  const grade = gradeDynasty(save);
  const finale = save.phase === "complete";
  const house = venueOf(save.year, save.userTeamId);
  return (
    <div className="space-y-6">
      <section className="franchise-hero sheen relative overflow-hidden rounded-xl border border-white/10 bg-studio shadow-[0_24px_60px_-28px_#000]">
        <FilmStill still="office" veil="left" />
        <div
          className="pointer-events-none absolute -right-10 top-0 h-full w-2/5 opacity-40 [clip-path:polygon(30%_0,100%_0,100%_100%,0_100%)]"
          style={{ background: `linear-gradient(135deg, ${clubInk(save.userTeamId, save.year).primary}, transparent 75%)` }}
          aria-hidden
        />
        <ClubRibbon />
        <div className="relative flex flex-wrap items-end justify-between gap-5 p-5 sm:p-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <span className="hidden sm:block">
              <Logo id={save.userTeamId} size={96} />
            </span>
            <div className="min-w-0">
            <p className="text-xs tracking-[0.25em] text-muted">{save.weekLabel}</p>
            <h2 className="text-4xl leading-[0.9] sm:text-5xl">{displayName(save.year, save.userTeamId)}</h2>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="bug-num text-4xl text-white">{rec}</span>
              <span className="font-display text-sm font-semibold uppercase italic tracking-wide text-muted">
                career <span className="text-white">{career}</span>
              </span>
            </p>
            <p className="mt-1 font-display text-sm font-semibold uppercase italic tracking-wide text-muted">
              HC <span className="text-white">{hc?.name ?? "—"}</span> · OC <span className="text-white">{oc?.name ?? "—"}</span> · DC{" "}
              <span className="text-white">{dc?.name ?? "—"}</span>
            </p>
            <p className="text-sm text-subtle">
              {house.stadium}
              {house.indoor ? " · indoor" : house.turf ? " · turf" : " · grass"}
              {house.altitude ? " · thin air" : ""}
              {" · "}
              Payroll {formatMoney(teamPayroll(save, save.userTeamId), save.year)}
              {save.salaryCap ? ` · cap ${formatMoney(save.salaryCap, save.year)}` : " · pre-cap era"}
            </p>
            </div>
          </div>
          <PhaseAction />
        </div>
      </section>
      {finale && <GradeCard grade={grade} />}
      <FranchiseHQ />
      <details className="hq-panel p-4"><summary className="cursor-pointer font-semibold">Detailed roster needs</summary><div className="mt-3"><DeskReport /></div></details>
      <PhoneLine />
      {!finale && <OwnersBox />}
      {!finale && grade.seasons > 0 && <GradeCard grade={grade} compact />}
      {!finale && <SeasonPlanCard />}
      <InjuryReport />
      <ThisSunday />
      <LastSunday />
      {save.phase === "freeAgency" && (
        <section className="rounded-xl border border-brass/40 bg-surface p-4">
          <p className="text-xs tracking-[0.25em] text-brass">FREE AGENCY</p>
          <p className="mt-1 text-sm text-muted">
            The market is open. Sign veterans on the Market tab, then close free agency from the office.
          </p>
        </section>
      )}
      <PrimetimeTeaser />
    </div>
  );
}

function ThisSunday() {
  const save = useGameStore((s) => s.save)!;
  if (save.phase !== "regular" && save.phase !== "playoffs" && save.phase !== "superBowl") return null;
  const game =
    save.phase === "superBowl"
      ? save.superBowl
      : save.phase === "playoffs"
        ? save.playoffGames.find((g) => !g.played && (g.homeId === save.userTeamId || g.awayId === save.userTeamId))
        : gamesInWeek(save, save.week).find((g) => g.homeId === save.userTeamId || g.awayId === save.userTeamId);
  if (!game && save.phase === "regular") {
    return (
      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <ClubRibbon />
        <div className="p-4">
          <p className="text-xs tracking-[0.25em] text-muted">THIS WEEKEND</p>
          <h3 className="mt-1 text-2xl">No game this weekend</h3>
          <p className="mt-1 text-sm text-muted">{byeNote(save)}</p>
        </div>
      </section>
    );
  }
  if (!game || game.played) return null;
  const home = game.homeId as TeamId;
  const away = game.awayId as TeamId;
  const opp = home === save.userTeamId ? away : home;
  const site = save.phase === "superBowl" ? superBowlSite(save.year) : null;
  const venue = site ? { stadium: site.site } : venueOf(save.year, home);
  const homeGame = home === save.userTeamId;
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <ClubRibbon />
      <div className="p-4">
        <p className="text-xs tracking-[0.25em] text-muted">THIS SUNDAY</p>
        <h3 className="mt-1 flex items-center gap-2 font-display text-xl">
          {homeGame ? "vs" : "@"} <Logo id={opp} size={28} /> {displayName(save.year, opp)}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {venue.stadium}
          {game.night ? " · night" : ""}
          {game.rivalry ? " · rivalry" : ""}
          {game.neutral || site ? " · neutral site" : ""}
        </p>
        <p className="mt-2 text-sm">
          They run {staffSystems(save, opp).offense} and {staffSystems(save, opp).defense}. You run {staffSystems(save, save.userTeamId).offense} and{" "}
          {staffSystems(save, save.userTeamId).defense}. The call sheet on the Staff tab is live — this is what the booth will actually call.
        </p>
        <MatchupNotes game={game} />
        {!save.sandbox && !save.realHistory && <GameWeekPrep game={game} />}
      </div>
    </section>
  );
}

function LastSunday() {
  const save = useGameStore((s) => s.save)!;
  const games = [...save.schedule, ...save.playoffGames, ...(save.superBowl ? [save.superBowl] : [])].filter(
    (g) => g.played && (g.homeId === save.userTeamId || g.awayId === save.userTeamId),
  );
  const last = games[games.length - 1];
  if (!last) return null;
  return (
    <section className="space-y-3">
      <p className="text-xs tracking-[0.25em] text-muted">LAST SUNDAY</p>
      <GameNight game={last} />
    </section>
  );
}

function InjuryReport() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const hurt = rosterOf(save, save.userTeamId).filter((p) => p.injuredWeeks > 0 || p.onIR);
  const cap = ROSTER_TARGET + 8;
  const active = activeRosterOf(save, save.userTeamId).length;
  const canReturn = canReturnFromIR(save.year);
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs tracking-[0.25em] text-muted">
        INJURY REPORT <span className="text-subtle">· active roster {active}/{cap}</span>
      </p>
      {hurt.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Training room is quiet. Next man stays on the bench.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {hurt.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3">
              <span>
                <PlayerLink player={p} className="inline min-h-0" /> <span className="text-muted">{p.pos}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular text-brick">
                  {p.onIR ? "IR" : p.injuryName ?? "hurt"}
                  {p.injuredWeeks > 0 ? ` · ${p.injuredWeeks}w` : p.onIR ? " · ready" : ""}
                </span>
                {p.holdout ? (
                  <Btn
                    kind="primary"
                    className="min-h-8 px-3 text-xs"
                    onClick={() => desk((s) => endHoldout(s, p.id))}
                  >
                    Pay him {formatMoney(holdoutAsk(save, p), save.year)}/yr
                  </Btn>
                ) : p.onIR ? (
                  canReturn ? (
                    <Btn
                      kind="ghost"
                      className="min-h-8 px-3 text-xs"
                      disabled={p.injuredWeeks > 0}
                      onClick={() =>
                        desk((s) => {
                          const r = activateFromIR(s, s.userTeamId, p.id);
                          return r.ok ? `Activated ${p.firstName} ${p.lastName} off IR.` : r.reason;
                        })
                      }
                    >
                      Activate
                    </Btn>
                  ) : (
                    <span className="text-xs text-subtle">out for the year</span>
                  )
                ) : (
                  <Btn
                    kind="ghost"
                    className="min-h-8 px-3 text-xs"
                    onClick={() =>
                      desk((s) => {
                        const r = placeOnIR(s, s.userTeamId, p.id);
                        return r.ok ? `Placed ${p.firstName} ${p.lastName} on IR.` : r.reason;
                      })
                    }
                  >
                    Place on IR
                  </Btn>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Roster() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const lastDeskNote = useGameStore((s) => s.lastDeskNote);
  const rows = rosterOf(save, save.userTeamId)
    .slice()
    .sort((a, b) => visibleOvr(b) - visibleOvr(a));
  return (
    <div className="space-y-3">
      {lastDeskNote && <p className="text-sm text-brick">{lastDeskNote}</p>}
      <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead className="text-xs tracking-wider text-muted">
          <tr>
            <th className="sticky left-0 z-10 w-12 bg-surface-2 px-3 py-2 font-medium">#</th>
            <th className="sticky left-12 z-10 bg-surface-2 px-3 py-2 font-medium">Player</th>
            {["Pos", "College", "Grade", "Age", "Yrs", "Kit", "Sal", "Status", ""].map((h) => (
              <th key={h} className="bg-surface-2 px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={`border-t border-line ${isStarter(save, p) ? "lead-row" : ""}`}>
              <td className="sticky left-0 z-10 w-12 bg-bg tabular px-3 py-2 text-muted">{p.jersey}</td>
              <td className="sticky left-12 z-10 bg-bg px-3 py-2">
                <PlayerLink player={p} className="font-display text-base" />
                {isStarter(save, p) ? <span className="ml-2 text-[10px] tracking-widest text-brass">STARTER</span> : null}
                {p.historical ? "" : <span className="ml-2 text-xs text-subtle">camp</span>}
              </td>
              <td className="px-3 py-2">{p.pos}</td>
              <td className="px-3 py-2 text-muted">{p.college ?? "—"}</td>
              <td className="tabular px-3 py-2">
                <span className={`stat-glow text-base ${gradeTone(visibleOvr(p))}`}>
                  {p.revealed ? p.ovr : `sc ${visibleOvr(p)}`}
                </span>
              </td>
              <td className="tabular px-3 py-2">{p.age}</td>
              <td className="tabular px-3 py-2 text-muted">{p.contractYears}</td>
              <td className="px-3 py-2">
                <KitChips player={p} compact />
              </td>
              <td className="tabular px-3 py-2 text-muted">{formatMoney(p.salary ?? 0, save.year)}</td>
              <td className="px-3 py-2 text-xs">
                {p.onIR ? (
                  <span className="text-brick">
                    IR{p.injuredWeeks > 0 ? ` · ${p.injuredWeeks}w` : " · ready"}
                  </span>
                ) : p.injuredWeeks > 0 ? (
                  <span className="text-brick">
                    {p.injuryName ?? "hurt"} · {p.injuredWeeks}w
                  </span>
                ) : (
                  <span className="text-good">active</span>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  {p.onIR ? (
                    canReturnFromIR(save.year) ? (
                      <Btn
                        kind="ghost"
                        className="min-h-9 px-3 text-xs"
                        disabled={p.injuredWeeks > 0}
                        onClick={() =>
                          desk((s) => {
                            const r = activateFromIR(s, s.userTeamId, p.id);
                            return r.ok ? `Activated ${p.firstName} ${p.lastName} off IR.` : r.reason;
                          })
                        }
                      >
                        Activate
                      </Btn>
                    ) : null
                  ) : p.injuredWeeks > 0 ? (
                    <Btn
                      kind="ghost"
                      className="min-h-9 px-3 text-xs"
                      onClick={() =>
                        desk((s) => {
                          const r = placeOnIR(s, s.userTeamId, p.id);
                          return r.ok ? `Placed ${p.firstName} ${p.lastName} on IR.` : r.reason;
                        })
                      }
                    >
                      IR
                    </Btn>
                  ) : null}
                  <Btn
                    kind="ghost"
                    className="min-h-8 px-3 text-xs hover:!text-brick"
                    onClick={() =>
                      desk((s) => {
                        const r = cutPlayer(s, s.userTeamId, p.id);
                        return r.ok ? `Cut ${p.firstName} ${p.lastName}.` : r.reason;
                      })
                    }
                  >
                    Cut
                  </Btn>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function Depth() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const team = save.teams[save.userTeamId];
  const groups = depthChart(save, save.userTeamId);
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">
        This order is what Sunday uses. Injured players skip. Move names up and down — the next man is actually next.
      </p>
      <DepthField />
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="mb-3 text-sm tracking-[0.2em] text-muted">{g.label}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {g.rows.map((row) => {
              const starterN = starterCount(row.pos, team.offScheme, team.defScheme);
              return (
              <div key={row.pos} className="rounded-lg border border-line bg-surface p-3">
                <p className="text-xs tracking-widest text-muted">{row.pos}</p>
                <ol className="mt-1 space-y-1">
                  {row.players.map((p, i) => (
                    <li key={p.id} className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm ${i < starterN ? "lead-row" : ""}`}>
                      <span className="min-w-0">
                        {i + 1}. <PlayerLink player={p} className="inline min-h-0" />
                        {i < starterN ? <span className="ml-2 text-[10px] tracking-widest text-brass">STARTER</span> : null}
                        {p.injuredWeeks > 0 ? <span className="ml-2 text-brick">out</span> : null}
                        <span className="mt-0.5 block text-xs text-muted">{p.college ?? ""}</span>
                        <span className="mt-0.5 block">
                          <KitChips player={p} compact />
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className={`stat-glow tabular ${gradeTone(p.revealed ? p.ovr : visibleOvr(p))}`}>
                          {p.revealed ? p.ovr : `sc ${visibleOvr(p)}`}
                        </span>
                        <button
                          type="button"
                          className="min-h-11 min-w-11 text-muted hover:text-fg"
                          aria-label="Move up"
                          onClick={() => desk((s) => void moveDepth(s, s.userTeamId, row.pos, p.id, -1))}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="min-h-11 min-w-11 text-xs tracking-widest text-muted hover:text-fg"
                          aria-label="Move down"
                          onClick={() => desk((s) => void moveDepth(s, s.userTeamId, row.pos, p.id, 1))}
                        >
                          Down
                        </button>
                      </span>
                    </li>
                  ))}
                  {!row.players.length && <li className="text-subtle">empty</li>}
                </ol>
              </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function SundayCallSheet() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const plan: Gameplan = planFor(save, save.userTeamId);
  const staff: Gameplan = staffPlan(save, save.userTeamId);
  const sys = staffSystems(save, save.userTeamId);
  const changed = (Object.keys(staff) as (keyof Gameplan)[]).filter((k) => plan[k] !== staff[k]);
  const Dial = ({
    label,
    field,
    options,
  }: {
    label: string;
    field: keyof Gameplan;
    options: string[];
  }) => (
    <label className={`rounded-xl border p-4 text-sm ${changed.includes(field) ? "border-brass/60 bg-brass/5" : "border-line bg-surface"}`}>
      <span className="flex items-center justify-between gap-2 text-xs tracking-[0.2em] text-muted">
        {label}
        {changed.includes(field) && <span className="text-[10px] tracking-wider text-brass">YOUR CALL</span>}
      </span>
      <select
        className="mt-2 min-h-11 w-full rounded-md border border-line bg-surface-2 px-2 text-fg"
        value={plan[field] ?? "balanced"}
        onChange={(e) => desk((s) => void deskPlan(s, s.userTeamId, { [field]: e.target.value }))}
      >
        {options.map((x) => (
          <option key={x} value={x}>
            {x === "maxProtect" ? "Max protect" : x}
            {staff[field] === x ? " (staff)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="space-y-3">
      <OpponentPreview />
      <h3 className="text-sm tracking-[0.2em] text-muted">Sunday call sheet</h3>
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-xs tracking-[0.2em] text-muted">Your staff's game plan</p>
        <p className="mt-1 text-sm text-paper">
          <span className="font-medium text-white">{sys.offense}</span>
          {sys.offBy ? <span className="text-muted"> · called by {sys.offBy}</span> : null}
        </p>
        <p className="text-sm text-paper">
          <span className="font-medium text-white">{sys.defense}</span>
          {sys.defBy ? <span className="text-muted"> · called by {sys.defBy}</span> : null}
        </p>
        <p className="mt-2 text-xs text-muted">
          {changed.length
            ? `You've overruled the staff on ${changed.length} ${changed.length === 1 ? "call" : "calls"}. The rest follows your coaches, and changes with them.`
            : "Every dial below is your coaches' own call. Change one and it's yours until you hand it back."}
        </p>
        {changed.length > 0 && (
          <Btn className="mt-2 min-h-10 px-4 text-sm" onClick={() => desk((s) => (deskResetPlan(s, s.userTeamId), "The staff has the call sheet back."))}>
            Hand it back to the staff
          </Btn>
        )}
      </div>
      <p className="text-sm text-muted">
        This is what the booth actually calls. Run/pass mix, fourth-down nerve, tempo, blitz frequency, and how you play inside the 20. Every other club runs its own coaches' game plan until the scoreboard forces its hand.
      </p>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Dial label="Attack" field="attack" options={["run", "balanced", "pass"]} />
        <Dial label="Fourth down" field="fourth" options={["conservative", "normal", "aggressive"]} />
        <Dial label="Tempo" field="tempo" options={["chew", "standard", "hurry"]} />
        <Dial label="Blitz" field="blitz" options={["rare", "normal", "heavy"]} />
        <Dial label="Red zone" field="redZone" options={["power", "balanced", "spread"]} />
        <Dial label="Protection" field="protection" options={["balanced", "maxProtect"]} />
        <Dial label="Defensive focus" field="defensiveFocus" options={["balanced", "run", "pass"]} />
      </div>
      <div className="hq-plan-notes" aria-live="polite">
        <p><strong>Attack:</strong> {plan.attack === 'run' ? 'Lean on the ground game to control possession; long-yardage situations still demand passing.' : plan.attack === 'pass' ? 'Test coverage and create explosive gains; protection and turnovers become more important.' : 'Keep both options available and let game situation shape the call.'}</p>
        <p><strong>Pressure:</strong> {plan.blitz === 'heavy' ? 'Send extra rushers more often, accepting greater exposure behind them.' : plan.blitz === 'rare' ? 'Keep more defenders in coverage and ask your front to generate pressure.' : 'Mix pressure with coverage instead of committing to one approach.'}</p>
        <p><strong>Protection:</strong> {plan.protection === "maxProtect" ? "Keep extra help in protection: fewer sacks, but fewer receiving options reduce completion chances." : "Release the full route combination with standard pass protection."}</p>
        <p><strong>Defensive focus:</strong> {plan.defensiveFocus === "run" ? "Commit resources to stopping the run and accept weaker pass coverage." : plan.defensiveFocus === "pass" ? "Prioritize pass coverage and concede more space on the ground." : "Defend both phases without selling out against either."}</p>
        <p><strong>Clock:</strong> {plan.tempo === 'chew' ? 'Use more clock between plays. Fewer possessions can protect a lead but limit comeback chances.' : plan.tempo === 'hurry' ? 'Push the pace and preserve time. Extra possessions give both offenses more opportunities.' : 'Use a normal pace, with the scoreboard influencing late-game urgency.'}</p>
      </div>
    </section>
  );
}

function Staff() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const lastDeskNote = useGameStore((s) => s.lastDeskNote);
  const t = save.teams[save.userTeamId];
  const pool = availableCoaches(save);
  const row = (role: "HC" | "OC" | "DC", id: string | null) => {
    const c = id ? save.coaches[id] : undefined;
    const winning = !!c && c.careerWins > c.careerLosses;
    return (
      <article className={`rounded-xl border p-4 ${c && c.careerTitles ? "border-brass/50 bg-brass/5" : "border-line bg-surface"}`}>
        <p className="text-xs tracking-[0.2em] text-muted">{role === "HC" ? "Head coach" : role === "OC" ? "Offensive coordinator" : "Defensive coordinator"}</p>
        <h3 className="text-2xl">{c?.name ?? "Vacant"}</h3>
        {c && (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              Age {c.age} · Off {c.offense} · Def {c.defense} · Lead {c.leadership} · Dev {c.development} · Eval {c.evaluation}
            </p>
            {playbookOf(c, save.year) && (
              <p className="text-sm text-paper">
                Runs the {role === "DC" ? playbookOf(c, save.year)!.defense : role === "OC" ? playbookOf(c, save.year)!.offense : `${playbookOf(c, save.year)!.offense} · ${playbookOf(c, save.year)!.defense}`}
              </p>
            )}
            <p className="text-sm">
              <span className="text-muted">
                {c.offScheme} / {c.defScheme} · year {c.yearsOnJob} on the job ·{" "}
              </span>
              <span className={`stat-glow ${winning ? "text-brass" : "text-muted"}`}>
                {c.careerWins}-{c.careerLosses}
                {c.careerTies ? `-${c.careerTies}` : ""}
              </span>
              {c.careerTitles ? <span className="text-muted"> · {c.careerTitles} titles</span> : null}
            </p>
            <CoachChips coach={c} />
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {c && (
            <Btn kind="brick" onClick={() => desk((s) => {
              const r = deskFire(s, s.userTeamId, role);
              return r.ok ? `Fired ${c.name}.` : r.reason;
            })}>
              Fire
            </Btn>
          )}
        </div>
        {pool.length > 0 && (
          <label className="mt-3 block text-sm text-muted">
            Hire
            <select
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-2 px-2 text-fg"
              defaultValue=""
              onChange={(e) => {
                const coachId = e.target.value;
                if (!coachId) return;
                desk((s) => {
                  const r = deskHire(s, s.userTeamId, coachId, role);
                  return r.ok ? "Hired." : r.reason;
                });
              }}
            >
              <option value="">Choose a coach</option>
              {pool.slice(0, 24).map((cch) => (
                <option key={cch.id} value={cch.id}>
                  {cch.name} · {cch.age} · off {cch.offense}/def {cch.defense} ·{" "}
                  {playbookOf(cch, save.year) ? `${playbookOf(cch, save.year)!.offense} / ${playbookOf(cch, save.year)!.defense}` : `${cch.offScheme}/${cch.defScheme}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </article>
    );
  };
  const carousel = (save.carousel ?? []).filter((m) => m.year >= save.year - 1);
  return (
    <div className="space-y-6">
      {lastDeskNote && <p className="text-sm text-brick">{lastDeskNote}</p>}
      <p className="text-sm text-muted">
        Scheme, attributes, and abilities change how the club plays and how the war room picks. Fire a man, hire another, live with it on Sunday. The league will not hire your head coach.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="rounded-xl border border-line bg-surface p-4 text-sm">
          <span className="text-xs tracking-[0.2em] text-muted">Offense</span>
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-line bg-surface-2 px-2 text-fg"
            value={t.offScheme}
            onChange={(e) => desk((s) => void deskScheme(s, s.userTeamId, { offScheme: e.target.value as typeof t.offScheme }))}
          >
            {["smashmouth", "vertical", "westcoast", "multiple"].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-xl border border-line bg-surface p-4 text-sm">
          <span className="text-xs tracking-[0.2em] text-muted">Defense</span>
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-line bg-surface-2 px-2 text-fg"
            value={t.defScheme}
            onChange={(e) => desk((s) => void deskScheme(s, s.userTeamId, { defScheme: e.target.value as typeof t.defScheme }))}
          >
            {["4-3", "3-4", "wide-9", "cover-2"].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-xl border border-line bg-surface p-4 text-sm">
          <span className="text-xs tracking-[0.2em] text-muted">Draft style</span>
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-line bg-surface-2 px-2 text-fg"
            value={t.draftStyle}
            onChange={(e) => desk((s) => void deskScheme(s, s.userTeamId, { draftStyle: e.target.value as typeof t.draftStyle }))}
          >
            {["bpa", "need", "speed", "trench", "defense", "qb"].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
      </div>
      <SundayCallSheet />
      <div className="grid gap-3 sm:grid-cols-3">
        {row("HC", t.coachId)}
        {row("OC", t.ocId)}
        {row("DC", t.dcId)}
      </div>
      {!save.sandbox && !t.coachId && <HotNames />}
      <section>
        <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">Coaching carousel</h3>
        {carousel.length === 0 && <p className="text-muted">No pink slips this winter — yet.</p>}
        <ul className="space-y-2">
          {carousel.map((m, i) => (
            <li key={`${m.teamId}-${i}`} className="text-sm">
              {m.note}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Standings() {
  const save = useGameStore((s) => s.save)!;
  const openTeam = useGameStore((s) => s.openTeam);
  const rows = standingRows(save);
  return (
    <div className="space-y-8">
      {rows.map((g) => (
        <section key={g.key}>
          <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">
            {g.conf} {g.div}
          </h3>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-muted">
                <tr>
                  {["Club", "W", "L", "T", "PF", "PA", "Str"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.teams.map((t, i) => (
                  <tr
                    key={t.id}
                    className={`cursor-pointer border-t border-line hover:bg-surface-2 ${i === 0 ? "lead-row" : ""} ${!save.sandbox && t.id === save.userTeamId ? "bg-club/20" : ""}`}
                    onClick={() => openTeam(t.id)}
                  >
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2 hover:text-brass">
                        <ClubHash id={t.id} className="h-5 w-1 rounded-full" />
                        <Logo id={t.id} size={22} />
                        {displayName(save.year, t.id)}
                        {i === 0 ? <span className="text-[10px] tracking-widest text-brass">1ST</span> : null}
                      </span>
                    </td>
                    <td className={`tabular px-3 py-2 ${i === 0 ? "stat-glow text-brass" : ""}`}>{t.wins}</td>
                    <td className="tabular px-3 py-2">{t.losses}</td>
                    <td className="tabular px-3 py-2">{t.ties}</td>
                    <td className="tabular px-3 py-2">{t.pf}</td>
                    <td className="tabular px-3 py-2">{t.pa}</td>
                    <td className="tabular px-3 py-2 text-muted">{t.streak || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function Schedule() {
  const save = useGameStore((s) => s.save)!;
  const games = gamesForTeam(save, save.userTeamId);
  const extra = [...save.playoffGames, ...(save.superBowl ? [save.superBowl] : [])];
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = [...games, ...extra].find((g) => g.id === openId);
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {games.map((g) => {
          const opp = (g.homeId === save.userTeamId ? g.awayId : g.homeId) as TeamId;
          const home = g.homeId === save.userTeamId;
          return (
            <li key={g.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between rounded-lg border border-line bg-surface px-3 py-3 text-left"
                onClick={() => setOpenId(g.played ? g.id : null)}
              >
                <span className="w-16 shrink-0 text-sm text-muted">
                  Wk {g.week}
                  {gameDateLabel(g) ? <span className="block text-[10px] text-subtle">{gameDateLabel(g)}</span> : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                  {g.site ? "vs" : home ? "vs" : "@"} <Logo id={opp} size={24} /> {displayName(save.year, opp)}
                  {g.rivalry ? <span className="text-[10px] tracking-widest text-brass">RIVALRY</span> : null}
                  {g.night ? (
                    <span className="text-[10px] tracking-widest text-brass">
                      {g.slot === "M" ? "MONDAY NIGHT" : g.slot === "T" ? "THURSDAY NIGHT" : g.slot === "N" ? "SUNDAY NIGHT" : "NIGHT"}
                    </span>
                  ) : g.slot === "T" ? (
                    <span className="text-[10px] tracking-widest text-brass">THANKSGIVING</span>
                  ) : null}
                  {g.site ? <span className="w-full text-[10px] text-subtle">{g.site}</span> : null}
                </span>
                <span className="shrink-0 text-right">
                  {g.played ? (
                    (() => {
                      const us = home ? g.homeScore : g.awayScore;
                      const them = home ? g.awayScore : g.homeScore;
                      const r = us > them ? "W" : us < them ? "L" : "T";
                      return (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`px-1.5 font-display text-sm font-extrabold italic [transform:skewX(-12deg)] ${
                              r === "W" ? "bg-good text-black" : r === "L" ? "bg-red text-white" : "bg-chrome-2 text-white"
                            }`}
                          >
                            {r}
                          </span>
                          <span className="bug-num text-xl">
                            {us}–{them}
                          </span>
                        </span>
                      );
                    })()
                  ) : (
                    <span className="tabular block">—</span>
                  )}
                  {realResultFor(g, save.userTeamId) ? (
                    <span className="tabular block text-[10px] text-subtle">real {realResultFor(g, save.userTeamId)}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
        {extra
          .filter((g) => g.homeId === save.userTeamId || g.awayId === save.userTeamId)
          .map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className="w-full rounded-lg border border-club bg-surface px-3 py-3 text-left"
                onClick={() => setOpenId(g.played ? g.id : null)}
              >
                {g.round}: {g.played ? `${g.homeScore}–${g.awayScore}` : "upcoming"}
              </button>
            </li>
          ))}
      </ul>
      {opened?.played ? <GameNight game={opened} onClose={() => setOpenId(null)} /> : null}
      <p className="text-sm text-muted">Tap a final to open the film — box, drives, weather, the hashmarks.</p>
    </div>
  );
}

function Stats() {
  const save = useGameStore((s) => s.save)!;
  const [posFilter, setPosFilter] = useState<Pos | "ALL" | "OL" | "DL" | "LB" | "DB">("ALL");
  const [teamFilter, setTeamFilter] = useState<TeamId | "ALL" | "mine">("ALL");
  const [scope, setScope] = useState<"regular" | "career" | "dynastyCareer" | "playoffs" | "poCareer">("regular");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "retired">("all");
  const careerScope = scope === "career" || scope === "dynastyCareer" || scope === "poCareer";
  const teams = activeTeamIds(save.year);
  // Most recent postseason on the books (this January's, or last season's during the offseason).
  const poYear = Object.values(save.players).reduce(
    (m, p) => Math.max(m, ...Object.keys(p.playoffStats ?? {}).map(Number).filter((y) => y <= save.year)),
    0,
  );
  const lineOf = (p: Player): SeasonStats | undefined =>
    scope === "regular" ? p.stats[save.year] : scope === "career" ? careerTotals(p, { throughYear: save.year }) : scope === "dynastyCareer" ? careerTotals(p, { fromYear: save.startingYear ?? 1966, throughYear: save.year }) : scope === "playoffs" ? p.playoffStats?.[poYear] : p.playoffStats ? playoffTotals(p) : undefined;

  const inPos = (p: Player) => {
    if (posFilter === "ALL") return true;
    if (posFilter === "OL") return ["LT", "LG", "C", "RG", "RT"].includes(p.pos);
    if (posFilter === "DL") return p.pos === "DE" || p.pos === "DT";
    if (posFilter === "LB") return p.pos === "OLB" || p.pos === "MLB";
    if (posFilter === "DB") return p.pos === "CB" || p.pos === "S";
    return p.pos === posFilter;
  };

  const allRows = Object.values(save.players)
    .filter((p) => {
      const s = lineOf(p);
      if (!hasSeasonWork(s)) return false;
      if (search.trim() && !playerName(p).toLowerCase().includes(search.trim().toLowerCase())) return false;
      const retired = p.teamId === "retired" || p.teamId === "hof";
      if (careerScope && ((status === "active" && retired) || (status === "retired" && !retired))) return false;
      if (!inPos(p)) return false;
      if (teamFilter === "mine") return p.teamId === save.userTeamId;
      if (teamFilter !== "ALL") return p.teamId === teamFilter;
      return true;
    })
    .map((p) => ({ p, s: lineOf(p)! }));

  const sortRows = (rows: typeof allRows, group: ReturnType<typeof statGroup>) => {
    const score = (s: (typeof rows)[number]["s"]) =>
      group === "pass"
        ? s.passYds
        : group === "rush"
          ? s.rushYds
          : group === "rec"
            ? s.recYds
            : group === "k"
              ? s.fgMade * 3 + s.xpMade
              : group === "p"
                ? s.puntYds
                : s.tackles + s.sacks * 4 + s.ints * 5;
    return rows.slice().sort((a, b) => score(b.s) - score(a.s)).slice(0, 40);
  };

  const filters: (Pos | "ALL" | "OL" | "DL" | "LB" | "DB")[] = [
    "ALL",
    "QB",
    "RB",
    "WR",
    "TE",
    "OL",
    "DL",
    "LB",
    "DB",
    "K",
    "P",
  ];

  const samplePos = (pos: Pos | "ALL" | "OL" | "DL" | "LB" | "DB"): Pos => {
    if (pos === "ALL") return "QB";
    if (pos === "OL") return "C";
    if (pos === "DL") return "DE";
    if (pos === "LB") return "MLB";
    if (pos === "DB") return "CB";
    return pos;
  };

  const boards =
    posFilter === "ALL"
      ? (
          [
            ["Passing", "QB" as const, allRows.filter((r) => r.p.pos === "QB")],
            ["Rushing", "RB" as const, allRows.filter((r) => r.p.pos === "RB" || r.p.pos === "FB")],
            ["Receiving", "WR" as const, allRows.filter((r) => r.p.pos === "WR" || r.p.pos === "TE")],
            ["Defense", "MLB" as const, allRows.filter((r) => ["DE", "DT", "OLB", "MLB", "CB", "S"].includes(r.p.pos))],
            ["Kicking", "K" as const, allRows.filter((r) => r.p.pos === "K")],
            ["Punting", "P" as const, allRows.filter((r) => r.p.pos === "P")],
          ] as const
        ).map(([title, pos, rows]) => ({ title, pos, rows: sortRows([...rows], statGroup(pos)) }))
      : [
          {
            title: String(posFilter),
            pos: allRows[0]?.p.pos ?? samplePos(posFilter),
            rows: sortRows(allRows, statGroup(allRows[0]?.p.pos ?? samplePos(posFilter))),
          },
        ];

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Stat scope" className="flex flex-wrap gap-2">
        {(
          [
            ["regular", `${save.year} regular season`],
            ["career", "Career totals"],
            ["dynastyCareer", "Dynasty totals"],
            ["playoffs", poYear ? `${poYear} playoffs` : "Playoffs"],
            ["poCareer", "Playoff careers"],
          ] as const
        )
          // History mode has no dynasty of its own; its careers are the real ones.
          .filter(([k]) => !(save.realHistory && k === "dynastyCareer"))
          .map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={scope === k}
            onClick={() => setScope(k)}
            className={`min-h-11 rounded-full border px-4 text-xs tracking-widest ${
              scope === k ? "bx-chip bx-chip-on" : "bx-chip"
            }`}
          >
            {label.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 text-xs text-muted">Find a player<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search player name" className="mt-1 block min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-fg" /></label>
        {careerScope && <label className="text-xs text-muted">Player status<select value={status} onChange={e => setStatus(e.target.value as typeof status)} className="mt-1 block min-h-11 rounded-md border border-line bg-surface px-3 text-sm text-fg"><option value="all">Active + retired</option><option value="active">Active players</option><option value="retired">Retired + Hall of Fame</option></select></label>}
      </div>
      {careerScope && <p className="text-sm text-muted">{scope === "career" ? "Cumulative regular-season stats: recorded historical seasons before your start plus every season played in this dynasty, including the current season." : scope === "dynastyCareer" ? `Cumulative regular-season stats from ${save.startingYear ?? 1966} through ${save.year}. Historical stats before your dynasty are excluded.` : "Cumulative postseason stats, kept separate from regular-season totals."} Retired players retain their totals. Team filters select current club membership; each player's totals include all clubs. Showing up to 40 leaders per category; search to find any player.</p>}
      {(scope === "playoffs" || scope === "poCareer") && !allRows.length && !search && (
        <p className="text-sm text-muted">No postseason football on the books yet. The lines fill in January.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {filters.map((pos) => (
          <button
            key={pos}
            type="button"
            onClick={() => setPosFilter(pos)}
            className={`min-h-11 rounded-md border px-3 text-xs tracking-widest ${
              posFilter === pos ? "bx-chip bx-chip-on" : "bx-chip"
            }`}
          >
            {pos}
          </button>
        ))}
      </div>
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>button]:shrink-0">
        <button
          type="button"
          onClick={() => setTeamFilter("ALL")}
          className={`min-h-11 rounded-md border px-3 text-xs tracking-widest ${
            teamFilter === "ALL" ? "bx-chip bx-chip-on" : "bx-chip"
          }`}
        >
          League
        </button>
        {!save.sandbox && <button
          type="button"
          onClick={() => setTeamFilter("mine")}
          className={`min-h-11 rounded-md border px-3 text-xs tracking-widest ${
            teamFilter === "mine" ? "bx-chip bx-chip-on" : "bx-chip"
          }`}
        >
          My club
        </button>}
        {teams.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTeamFilter(id)}
            className={`min-h-11 rounded-md border px-3 text-xs tracking-widest ${
              teamFilter === id ? "bx-chip bx-chip-on" : "bx-chip"
            }`}
          >
            {locationOf(save.year, id)}
          </button>
        ))}
      </div>
      {boards.map((board) => {
        const cols = statCols(board.pos);
        return (
          <section key={board.title}>
            {posFilter === "ALL" && <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">{board.title}</h3>}
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="sticky left-0 z-10 bg-surface-2 px-3 py-2 font-medium">Player</th>
                    <th className="bg-surface-2 px-3 py-2 font-medium">Pos</th>
                    <th className="bg-surface-2 px-3 py-2 font-medium">Team</th>
                    <th className="bg-surface-2 px-3 py-2 font-medium">College</th>
                    {cols.map((c) => (
                      <th key={c.key} className="bg-surface-2 px-3 py-2 font-medium">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {board.rows.map(({ p, s }, i) => {
                    const rowCols = statCols(p.pos);
                    return (
                      <tr key={p.id} className={`border-t border-line ${i === 0 ? "lead-row" : ""}`}>
                        <td className="sticky left-0 z-10 bg-surface px-3 py-2">
                          <PlayerLink player={p} />
                          {i === 0 ? <span className="ml-2 text-[10px] tracking-widest text-brass">LEADS</span> : null}
                        </td>
                        <td className="px-3 py-2">
                          {p.pos}
                          {isStarter(save, p) ? <span className="ml-1 text-[10px] tracking-widest text-brass">•ST</span> : null}
                        </td>
                        <td className="px-3 py-2 uppercase">{String(p.teamId)}</td>
                        <td className="px-3 py-2 text-muted">{p.college ?? "—"}</td>
                        {cols.map((c, ci) => {
                          const match = rowCols.find((x) => x.key === c.key) ?? cols.find((x) => x.key === c.key);
                          return (
                            <td key={c.key} className={`tabular px-3 py-2 ${i === 0 && ci === 0 ? "stat-glow text-brass" : ""}`}>
                              {match?.of ? match.of(s) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {!board.rows.length && (
                    <tr>
                      <td className="px-3 py-4 text-muted" colSpan={4 + cols.length}>
                        {search || careerScope ? "No players match these filters." : "Play a Sunday — stats land after the whistle."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

const RECORD_SCOPES = ["game", "season", "career"] as const;
type RecordScope = (typeof RECORD_SCOPES)[number];

function RecordBookSection({ title, teamId }: { title: string; teamId?: TeamId }) {
  const save = useGameStore((s) => s.save)!;
  const [scope, setScope] = useState<RecordScope>("career");
  const cats =
    scope === "career"
      ? careerRecordBook(save, teamId ? 1 : 3, teamId)
      : scope === "season"
        ? seasonRecordBook(save, teamId ? 1 : 3, teamId)
        : gameRecordBook(save, teamId);
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm tracking-[0.2em] text-muted">{title}</h3>
        <div className="flex gap-2">
          {RECORD_SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`min-h-9 rounded-md border px-3 text-xs tracking-widest ${
                scope === s ? "bx-chip bx-chip-on" : "bx-chip"
              }`}
            >
              {s === "career" ? "ALL-TIME CAREER" : s === "season" ? "ALL-TIME SEASON" : "SINGLE GAME"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((cat) => (
          <article key={cat.id} className="chrome-bevel min-w-0 rounded-lg border border-line bg-surface p-3">
            <p className="text-xs tracking-widest text-brass">{cat.label.toUpperCase()}</p>
            <ol className="mt-2 space-y-1.5 text-sm">
              {cat.rows.map((r, i) => (
                <li key={`${r.playerId}-${r.year}`} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    <span className="text-subtle">{i + 1}.</span>{" "}
                    {save.players[r.playerId] ? (
                      <PlayerLink player={save.players[r.playerId]!} className="inline min-h-0" />
                    ) : (
                      r.name
                    )}{" "}
                    <span className="text-muted">
                      {teamId ? r.pos : `${r.pos} · ${r.team}`} · {r.year || "—"}
                    </span>
                  </span>
                  <span className={`stat-glow shrink-0 tabular ${i === 0 ? "text-brass" : "text-fg"}`}>{r.value.toLocaleString("en-US")}</span>
                </li>
              ))}
              {!cat.rows.length && <li className="text-muted">No qualifiers yet.</li>}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Save the whole timeline as one web page: champions, awards, records, Hall of Fame. */
function ShareHistory() {
  const save = useGameStore((s) => s.save)!;
  const [note, setNote] = useState("");
  const file = () => {
    const html = leagueHistoryHtml(save);
    const name = `nfl-rewind-${save.startingYear}-${save.year}.html`;
    return { html, name, f: new File([html], name, { type: "text/html" }) };
  };
  const download = () => {
    const { html, name } = file();
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setNote(`Saved ${name}. It opens in any browser, no app needed.`);
  };
  const share = async () => {
    const { f } = file();
    try {
      await navigator.share({ files: [f], title: "NFL Rewind history" });
      setNote("Shared.");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") download();
    }
  };
  const canShare = typeof navigator !== "undefined" && !!navigator.canShare && (() => {
    try {
      return navigator.canShare({ files: [new File(["x"], "x.html", { type: "text/html" })] });
    } catch {
      return false;
    }
  })();
  return (
    <section className="rounded-xl border border-line bg-surface p-4" aria-label="Share your league history">
      <p className="text-xs tracking-[0.25em] text-muted">SHARE THIS TIMELINE</p>
      <p className="mt-1 text-sm text-paper">One page with every champion, award winner, record and Hall of Famer from {save.startingYear} to {save.year}.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn kind="primary" className="min-h-10 px-4 text-xs" onClick={download}>
          Download history page
        </Btn>
        {canShare && (
          <Btn className="min-h-10 px-4 text-xs" onClick={() => void share()}>
            Share
          </Btn>
        )}
      </div>
      {note && <p className="mt-2 text-xs text-brass">{note}</p>}
    </section>
  );
}

function History() {
  const save = useGameStore((s) => s.save)!;
  const leaders = seasonLeaders(save);
  const boards = [
    ["Passing", leaders.passYds],
    ["Rushing", leaders.rushYds],
    ["Receiving", leaders.recYds],
    ["Sacks", leaders.sacks],
    ["Interceptions", leaders.ints],
    ["Tackles for loss", leaders.tfl],
    ["Passes defensed", leaders.pd],
  ] as const;
  return (
    <div className="space-y-8">
      {!save.sandbox && <FranchiseBook />}
      {!save.sandbox && <TrophyCase />}
      {!save.sandbox && <LegacySection />}
      {save.sandbox ? <HistoryCheck /> : <TimelineSection />}
      {!save.sandbox && <RecordBookSection title={`${displayName(save.year, save.userTeamId)} franchise records`} teamId={save.userTeamId} />}
      <RecordBookSection title="NFL record book" />
      <AllDecadeTeams />
      <CoachingTrees />
      <Rulebook save={save} />
      <ShareHistory />
      <section>
        <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">{save.year} League leaders</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {boards.map(([title, rows]) => (
            <article key={title} className="rounded-lg border border-line bg-surface p-3">
              <p className="text-xs tracking-widest text-muted">{title}</p>
              <ol className="mt-2 space-y-1 text-sm">
                {rows.slice(0, 5).map((r, i) => (
                  <li key={r.playerId} className="flex justify-between gap-2">
                    <span>
                      {i + 1}.{" "}
                      {save.players[r.playerId] ? (
                        <PlayerLink player={save.players[r.playerId]!} className="inline min-h-0" />
                      ) : (
                        r.name
                      )}{" "}
                      <span className="text-muted">{r.pos}</span>
                    </span>
                    <span className="tabular">{r.value}</span>
                  </li>
                ))}
                {!rows.length && <li className="text-muted">Play a Sunday.</li>}
              </ol>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">Awards</h3>
        {save.history.awards.length === 0 && <p className="text-muted">No trophies yet. Play a season.</p>}
        <ul className="space-y-2">
          {save.history.awards.slice().reverse().slice(0, 12).map((a) => {
            const Nm = ({ id }: { id?: string }) => {
              const p = id ? save.players[id] : undefined;
              return p ? <PlayerLink player={p} className="inline min-h-0" /> : <span>—</span>;
            };
            return (
              <li key={a.year} className="rounded-lg border border-line bg-surface p-3 text-sm">
                <p className="font-display text-base">{a.year}</p>
                <p className="text-muted">
                  MVP <Nm id={a.mvp} />
                  {a.co?.mvp?.map((id) => <span key={id}> &amp; <Nm id={id} /></span>)}
                  {a.offPoy && <> · OPOY <Nm id={a.offPoy} /></>}
                  {a.co?.offPoy?.map((id) => <span key={id}> &amp; <Nm id={id} /></span>)}
                  {a.defPoy && <> · DPOY <Nm id={a.defPoy} /></>}
                  {a.co?.defPoy?.map((id) => <span key={id}> &amp; <Nm id={id} /></span>)}
                  {a.cpoty && <> · Comeback <Nm id={a.cpoty} /></>}
                  {a.co?.cpoty?.map((id) => <span key={id}> &amp; <Nm id={id} /></span>)}
                  {a.coy && save.coaches[a.coy] && <> · Coach {save.coaches[a.coy]!.name}</>}
                  {a.coyName && <> · Coach {a.coyName}</>}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">Super Bowls</h3>
        {save.history.superBowls.length === 0 && (
          <p className="text-muted">The almanac is empty. Super Bowl I has not been played.</p>
        )}
        <ul className="space-y-2">
          {save.history.superBowls.map((b) => (
            <li key={b.year} className="rounded-lg border border-line bg-surface p-3">
              <p className="font-display text-lg">
                Super Bowl {roman(b.number)} — {displayName(b.year, b.homeScore >= b.awayScore ? b.homeId : b.awayId)}
              </p>
              <p className="text-sm text-muted">
                {b.homeScore}–{b.awayScore} · {b.site} · {b.mvpName ?? "MVP n/a"}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <TeamOfHonor />
      <section>
        <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">Pro Football Hall of Fame</h3>
        <ul className="space-y-2">
          {save.history.hof
            .slice()
            .reverse()
            .map((h) => (
              <HofPlaque key={`${h.kind ?? "player"}-${h.playerId ?? h.coachId ?? h.name}-${h.year}`} h={h} />
            ))}
          {!save.history.hof.length && <p className="text-muted">No class yet. Five-year wait after retirement.</p>}
        </ul>
      </section>
    </div>
  );
}

function HofPlaque({ h }: { h: HofMember }) {
  const save = useGameStore((s) => s.save)!;
  const player = h.playerId ? save.players[h.playerId] : undefined;
  const coach = h.coachId ? save.coaches[h.coachId] : undefined;
  return (
    <li className="chrome-bevel flex items-start gap-3 rounded-lg border border-brass/40 bg-gradient-to-b from-brass/10 to-transparent p-3">
      {(h.playerId || h.coachId) && <Logo id={h.teamId} size={32} year={h.year} />}
      <div className="min-w-0">
        <p className="font-display text-lg leading-tight">
          {h.kind === "coach" ? (
            <span>
              {coach?.name ?? h.coachId} <span className="text-sm text-muted">· head coach</span>
            </span>
          ) : player ? (
            <PlayerLink player={player} className="inline min-h-0 font-display text-lg" />
          ) : (
            (h.playerId ?? h.name)
          )}
          <span className="ml-2 text-xs tracking-widest text-brass">CLASS OF {h.year}</span>
        </p>
        <p className="mt-0.5 text-sm text-muted">{h.blurb}</p>
      </div>
    </li>
  );
}

function TeamOfHonor() {
  const save = useGameStore((s) => s.save)!;
  const [club, setClub] = useState<TeamId>(save.userTeamId);
  const entries = save.history.hof
    .filter((h) => h.teamId === club && (h.playerId || h.coachId))
    .slice()
    .reverse();
  const count = (id: TeamId) => save.history.hof.filter((h) => h.teamId === id && (h.playerId || h.coachId)).length;
  const clubs = activeTeamIds(save.year)
    .slice()
    .sort((a, b) => Number(b === save.userTeamId) - Number(a === save.userTeamId) || displayName(save.year, a).localeCompare(displayName(save.year, b)));
  const mine = club === save.userTeamId;
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-sm tracking-[0.2em] text-brass">{displayName(save.year, club)} · Team of Honor</h3>
        <select
          aria-label="Club"
          className="min-h-9 rounded-sm border border-line bg-black/70 px-2 text-sm text-paper"
          value={club}
          onChange={(e) => setClub(e.target.value as TeamId)}
        >
          {clubs.map((id) => (
            <option key={id} value={id}>
              {displayName(save.year, id)}
              {count(id) ? ` (${count(id)})` : ""}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-2 text-sm text-muted">
        {mine
          ? "Every Hall of Famer who wore your colors — the wall the building points to when it needs to remember why it matters."
          : `Every Hall of Famer the ${displayName(save.year, club)} claim.`}
      </p>
      <ul className="space-y-2">
        {entries.map((h) => (
          <HofPlaque key={`toh-${h.kind ?? "player"}-${h.playerId ?? h.coachId}-${h.year}`} h={h} />
        ))}
        {!entries.length && <p className="text-muted">No plaques on the wall yet. Someone will earn one.</p>}
      </ul>
    </section>
  );
}

function AllDecadeTeams() {
  const save = useGameStore((s) => s.save)!;
  const decades = availableDecades(save);
  const [decade, setDecade] = useState(decades[decades.length - 1] ?? save.startingYear);
  const slots = allDecadeTeam(save, decade);
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm tracking-[0.2em] text-muted">All-decade team</h3>
        <div className="flex flex-wrap gap-2">
          {decades.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDecade(d)}
              className={`min-h-9 rounded-md border px-3 text-xs tracking-widest ${
                decade === d ? "bx-chip bx-chip-on" : "bx-chip"
              }`}
            >
              {d}S
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {slots.map((slot) => (
          <article key={slot.pos} className="chrome-bevel rounded-lg border border-line bg-surface p-3">
            <p className="text-xs tracking-widest text-brass">{slot.pos}</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {slot.players.map((p) => (
                <li key={p.playerId} className="min-w-0">
                  {save.players[p.playerId] ? (
                    <PlayerLink player={save.players[p.playerId]!} className="inline min-h-0" />
                  ) : (
                    p.name
                  )}
                  <span className="ml-1 block text-xs text-muted">
                    {p.team} · {p.years} season{p.years === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
              {!slot.players.length && <li className="text-muted">Nobody yet.</li>}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function EventPane() {
  const save = useGameStore((s) => s.save)!;
  if (save.phase === "superBowl" && save.superBowl) return <SuperBowlNight />;
  if (save.phase === "awards" && save.awards) return <AwardsNight />;
  if (save.phase === "proBowl" && save.proBowl) return <ProBowlNight />;
  if (save.phase === "retirement") return <RetirementNight />;
  if (save.phase === "hof") return <HofNight />;
  if (save.phase === "carousel") return <CarouselNight />;
  if (save.phase === "relocation") return <RelocationNight />;
  if (save.phase === "expansion" && save.expansion) return <ExpansionNight />;
  if (save.phase === "preseason") return <CampNight />;
  if (weekIsInTheBooks(save)) return <SundayNight />;
  if (save.phase === "complete") {
    return (
      <article className="space-y-4">
        <GradeCard grade={gradeDynasty(save)} />
        <p className="text-muted">The rewind is on the books. Sit with the almanac or walk back to the title.</p>
        <PhaseAction />
      </article>
    );
  }
  return null;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "office", label: "Office" },
  { id: "primetime", label: "Primetime" },
  { id: "roster", label: "Roster" },
  { id: "depth", label: "Depth" },
  { id: "staff", label: "Staff" },
  { id: "market", label: "Market" },
  { id: "standings", label: "Standings" },
  { id: "league", label: "League" },
  { id: "schedule", label: "Schedule" },
  { id: "stats", label: "Stats" },
  { id: "draft", label: "Draft" },
  { id: "history", label: "History" },
  { id: "team", label: "Team History" },
  { id: "hof", label: "Hall of Fame" },
];

const WATCH_TABS: { id: Tab; label: string }[] = [
  { id: "office", label: "Watch" },
  { id: "primetime", label: "Primetime" },
  { id: "standings", label: "Standings" },
  { id: "league", label: "League" },
  { id: "stats", label: "Stats" },
  { id: "draft", label: "Draft" },
  { id: "history", label: "History" },
  { id: "team", label: "Team History" },
  { id: "hof", label: "Hall of Fame" },
];

const HISTORY_TABS: { id: Tab; label: string }[] = WATCH_TABS.filter((t) => t.id !== "primetime").map((t) =>
  t.id === "office" ? { id: t.id, label: "Rewind" } : t,
);

/** The sandbox's office tab: the league desk, or whatever night the calendar is on. */
function WatchOffice({ event }: { event: boolean }) {
  const save = useGameStore((s) => s.save)!;
  if (save.phase === "preseason")
    return <WatchMoves title="Training camp" kinds={["cut", "waive", "claim", "sign"]} blurb="Cut-down week around the league. Every club trims to the limit, and the season preview is up on Primetime." />;
  if (event) return <EventPane />;
  if (save.phase === "draft") return <DraftNight />;
  if (save.phase === "freeAgency")
    return <WatchMoves title={save.year < 1994 ? "Rozelle-rule winter" : "Free agency"} kinds={["sign", "trade"]} blurb={save.year < 1994 ? "Stars rarely move in this era. Watch who signs where." : "The market is open. Watch who signs where."} />;
  if (save.phase === "deadline")
    return <WatchMoves title={save.year < 1994 ? "Trading week" : "Trade deadline"} kinds={["trade"]} blurb="The window is open around the league. Here's who dealt." />;
  return <WatchDesk />;
}

function PlayShell() {
  const { save, tab, setTab, resign, exportJson } = useGameStore();
  const tv = useGameStore((s) => s.tv);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const event = useMemo(() => {
    if (!save) return false;
    return (
      ["superBowl", "proBowl", "awards", "retirement", "hof", "expansion", "carousel", "relocation", "preseason"].includes(
        save.phase,
      ) || weekIsInTheBooks(save)
    );
  }, [save]);
  // A sandbox has no roster, depth, staff, market or schedule tabs; land on the desk instead.
  const staleTab = !!save?.sandbox && !(save.realHistory ? HISTORY_TABS : WATCH_TABS).some((t) => t.id === tab);
  useEffect(() => {
    if (staleTab) setTab("office");
  }, [staleTab, setTab]);
  if (!save) return <TitleScreen />;
  const download = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nfl-rewind-${save.userTeamId}-${save.year}.json`;
    a.click();
  };
  const watch = !!save.sandbox;
  const real = !!save.realHistory;
  const tabs = real ? HISTORY_TABS : watch ? WATCH_TABS : TABS;
  const champ = save.history.superBowls.at(-1);
  const deskId = watch && champ ? ((champ.homeScore >= champ.awayScore ? champ.homeId : champ.awayId) as TeamId) : save.userTeamId;
  const showDraft = save.phase === "draft" && !event;
  const showFa = save.phase === "freeAgency" && !event;
  const showDeadline = save.phase === "deadline" && !event;
  return (
    <DraftAnnouncerProvider>
    {watch && tv && !real ? (
      <ClubDesk id={deskId} year={save.year} className="broadcast-shell min-h-dvh bg-bg">
        <WatchTV />
        <PlayerProfile />
        <TeamRosterModal />
        {save.realHistory && <HistoryBoxModal />}
      </ClubDesk>
    ) : (
    <ClubDesk id={deskId} year={save.year} className="broadcast-shell min-h-dvh bg-bg">
      <a href="#franchise-content" className="skip-link">Skip to franchise content</a>
      <header className="broadcast-header sticky top-0 z-20 bg-[#04050acc] backdrop-blur-md">
        <ClubRibbon />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <NetworkBug className="max-md:hidden" />
            {watch ? <WatchPlate save={save} /> : <ClubPlate save={save} />}
          </div>
          <div className="flex shrink-0 gap-2">
            <Btn onClick={download} className="min-h-9 px-4 text-[13px] max-sm:hidden">
              Export
            </Btn>
            <span data-tour="settings" className="contents">
              <Btn onClick={() => setSettingsOpen(true)} className="min-h-9 px-3 text-[13px]" title="Settings">
                <span aria-hidden>⚙</span>
                <span className="sr-only">Settings</span>
              </Btn>
            </span>
            <Btn onClick={resign} className="min-h-9 px-4 text-[13px]">
              Title
            </Btn>
          </div>
        </div>
        <div data-tour="tabs">
          <TabStrip tabs={tabs} active={tab} onPick={setTab} />
        </div>
      </header>
      {watch && (
        <div className="mx-auto max-w-6xl px-3 pt-4 sm:px-4">
          <WatchBar />
        </div>
      )}
      <div key={`wipe-${tab}`} className="wipe" aria-hidden />
      <main id="franchise-content" tabIndex={-1} key={event ? `event-${save.phase}` : tab} className="broadcast-content rise-in mx-auto max-w-6xl px-3 pb-20 pt-6 sm:px-4">
        <div className="next-section-context"><span>{watch ? "LEAGUE" : "FRANCHISE"} / {tabs.find(t => t.id === tab)?.label}</span><span>{save.year} SEASON <i /> {save.weekLabel}</span></div>
        {real && tab === "office" ? <HistoryDesk /> : null}
        {watch && !real && tab === "office" ? <WatchOffice event={event} /> : null}
        {!watch && (event || showDraft || showFa) && tab === "office" && save.phase !== "relocation" ? <RelocationOffer standalone /> : null}
        {!watch && event && tab === "office" ? <EventPane /> : null}
        {tab === "primetime" && <PrimetimeShow />}
        {showDraft && !real && (tab === "draft" || (!watch && tab === "office")) ? <DraftNight /> : null}
        {!watch && showFa && tab === "office" ? <FreeAgencyNight /> : null}
        {!watch && showDeadline && tab === "office" ? <DeadlineNight /> : null}
        {!watch && !event && !showDraft && !showFa && !showDeadline && tab === "office" && <Office />}
        {!watch && tab === "roster" && <Roster />}
        {!watch && tab === "depth" && <Depth />}
        {!watch && tab === "staff" && <Staff />}
        {!watch && tab === "market" && <MarketDesk />}
        {tab === "standings" && <Standings />}
        {!watch && tab === "schedule" && <Schedule />}
        {tab === "stats" && <Stats />}
        {tab === "draft" && real && <HistoryDraft />}
        {tab === "draft" && !showDraft && !real && <DraftNight />}
        {tab === "draft" && (!showDraft || real) && <DraftReportCard />}
        {tab === "history" && <History />}
        {tab === "team" && (
          <TeamHistory records={(id) => <RecordBookSection title={`${displayName(save.year, id)} franchise records`} teamId={id} />} />
        )}
        {tab === "hof" && <HallOfFame />}
        {tab === "league" && <LeagueDirectory />}
        <PlayerProfile />
        <TeamRosterModal />
        {save.realHistory && <HistoryBoxModal />}
        <CrunchCall />
      </main>
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      {watch && !real && !settingsOpen && <Tour id="watch" steps={WATCH_TOUR} />}
      {tab !== "primetime" && <BottomLine save={save} />}
    </ClubDesk>
    )}
    </DraftAnnouncerProvider>
  );
}

export function GameApp() {
  const screen = useGameStore((s) => s.screen);
  if (screen === "title") return <TitleScreen />;
  if (screen === "select") return <TeamSelect />;
  return <PlayShell />;
}
