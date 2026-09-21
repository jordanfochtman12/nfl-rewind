import { useMemo, useRef, useState } from "react";
import {
  ACTIVE_1966,
  activateFromIR,
  activeRosterOf,
  activeTeamIds,
  availableCoaches,
  canReturnFromIR,
  cutPlayer,
  depthChart,
  deskFire,
  deskHire,
  deskScheme,
  deskPlan,
  deskHoles,
  displayName,
  END_YEAR,
  formatBytes,
  formatMoney,
  gamesForTeam,
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
} from "@/lib/game";
import { useGameStore, type Tab } from "@/lib/game-store";
import { MarketDesk } from "./MarketDesk";
import { proBowlSite, roman, superBowlNumber, seasonLeaders, superBowlSite } from "@/lib/game";
import { PrimetimeShow } from "./PrimetimeShow";
import { DraftNight } from "./DraftNight";
import { SuperBowlNight } from "./SuperBowlNight";
import { GameNight } from "./GameNight";
import { DepthField } from "./DepthField";
import { FilmStill } from "./Art";
import { KitChips, CoachChips } from "./KitChips";
import { PlayerLink, PlayerProfile } from "./PlayerProfile";
import { TeamRosterModal } from "./TeamRoster";
import { ExpansionNight } from "./ExpansionNight";
import { GradeCard } from "./GradeCard";
import { FranchiseBook } from "./FranchiseBook";
import { FreeAgencyNight } from "./FreeAgencyNight";
import { CampNight } from "./CampNight";
import { DeadlineNight } from "./DeadlineNight";
import { SundayNight } from "./SundayNight";
import { Btn, ClubDesk, ClubHash, ClubRibbon, gradeTone, Logo } from "./chrome";
import {
  AwardsNight,
  CarouselNight,
  HofNight,
  ProBowlNight,
  RelocationNight,
  RetirementNight,
} from "./WinterNights";

function TitleScreen() {
  const { save, setScreen, continueGame, exportJson, importJson, hasHydrated } = useGameStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const download = () => {
    const json = exportJson();
    if (!json || json === "null") return;
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nfl-rewind-${save?.userTeamId ?? "dynasty"}-${save?.year ?? 1966}.json`;
    a.click();
  };
  const grade = save ? gradeDynasty(save) : null;
  const bytes = save ? saveByteLength(save) : 0;
  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <FilmStill still="title" video="/art/title.mp4" veil="left" />
      <div className="relative mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 px-5 py-12">
      <p className="font-display text-xs tracking-[0.4em] text-brass">START IN 1966 · SUPER BOWL I ERA</p>
      <h1 className="font-display text-6xl leading-[0.9] text-fg sm:text-8xl">
        NFL
        <span className="block text-brass">Rewind</span>
      </h1>
      <p className="max-w-lg text-lg text-paper">
        You are the GM. Draft the real classes, hire the staff, survive Sunday. Rewrite football history from Super Bowl I through 2027.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Btn kind="primary" onClick={() => setScreen("select")}>
          New dynasty
        </Btn>
        <Btn onClick={continueGame} disabled={!save}>
          Continue
        </Btn>
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
            void f.text().then(importJson);
          }}
        />
      </div>
      {!hasHydrated && <p className="text-sm text-muted">Reading the file…</p>}
      {save && hasHydrated && (
        <p className="text-sm text-paper">
          {displayName(save.year, save.userTeamId)} · {save.year} · {save.weekLabel}
          {grade && grade.seasons > 0 ? ` · ${grade.letter}` : ""}
          {bytes ? ` · ${formatBytes(bytes)}` : ""}
        </p>
      )}
      <p className="text-sm text-muted">AFL / NFL · named veterans · no player photographs</p>
      </div>
    </main>
  );
}

function TeamSelect() {
  const { newGame, setScreen } = useGameStore();
  const nfl = ACTIVE_1966.filter((id) => originalLeague(id) === "NFL");
  const afl = ACTIVE_1966.filter((id) => originalLeague(id) === "AFL");
  const Group = ({ title, ids }: { title: string; ids: readonly TeamId[] }) => (
    <section className="space-y-3">
      <h2 className="text-sm tracking-[0.2em] text-muted">{title}</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => newGame(id)}
            className="chrome-bevel flex min-h-14 items-center gap-3 overflow-hidden rounded-lg bg-gradient-to-b from-surface-2/95 to-surface/95 px-3 text-left backdrop-blur-sm transition-all hover:brightness-125"
          >
            <ClubHash id={id} year={1966} className="w-1.5 self-stretch rounded-sm" />
            <Logo id={id} size={44} year={1966} />
            <span>
              <span className="block font-display text-base">{locationOf(1966, id)}</span>
              <span className="text-sm text-muted">{nicknameOf(1966, id)}</span>
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
          <p className="font-display text-xs tracking-[0.35em] text-brass">1966 MEDIA GUIDE</p>
          <h1 className="text-3xl">Choose your club</h1>
        </div>
        <Btn onClick={() => setScreen("title")}>Back</Btn>
      </div>
      <Group title="National Football League" ids={nfl} />
      <Group title="American Football League" ids={afl} />
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
    <Btn kind="primary" onClick={onClick}>
      {label[save.phase] ?? "Continue"}
    </Btn>
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
      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <ClubRibbon />
        <div className="flex flex-wrap items-end justify-between gap-4 p-4">
          <div>
            <p className="text-xs tracking-[0.25em] text-muted">{save.weekLabel}</p>
            <h2 className="text-3xl">{displayName(save.year, save.userTeamId)}</h2>
            <p className="tabular text-muted">
              {rec} · career {career} · HC {hc?.name ?? "—"} · OC {oc?.name ?? "—"} · DC {dc?.name ?? "—"}
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
          <PhaseAction />
        </div>
      </section>
      {finale && <GradeCard grade={grade} />}
      <DeskReport />
      {!finale && grade.seasons > 0 && <GradeCard grade={grade} compact />}
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
      <PrimetimeShow />
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
  if (!game || game.played) return null;
  const home = game.homeId as TeamId;
  const away = game.awayId as TeamId;
  const opp = home === save.userTeamId ? away : home;
  const site = save.phase === "superBowl" ? superBowlSite(save.year) : null;
  const venue = site ? { stadium: site.site } : venueOf(save.year, home);
  const us = save.teams[save.userTeamId];
  const them = save.teams[opp];
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
          They are {them.offScheme} / {them.defScheme}. You are {us.offScheme} / {us.defScheme}. The call sheet on the
          Staff tab is live — this is what the booth will actually call.
        </p>
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
                {p.onIR ? (
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
                    kind="brick"
                    className="min-h-9 px-3 text-xs"
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
  const t = save.teams[save.userTeamId];
  const plan: Gameplan = t.plan ?? { attack: "balanced", fourth: "normal", tempo: "standard", blitz: "normal", redZone: "balanced" };
  const Dial = ({
    label,
    field,
    options,
  }: {
    label: string;
    field: keyof Gameplan;
    options: string[];
  }) => (
    <label className="rounded-xl border border-line bg-surface p-4 text-sm">
      <span className="text-xs tracking-[0.2em] text-muted">{label}</span>
      <select
        className="mt-2 min-h-11 w-full rounded-md border border-line bg-surface-2 px-2 text-fg"
        value={plan[field]}
        onChange={(e) => desk((s) => void deskPlan(s, s.userTeamId, { [field]: e.target.value }))}
      >
        {options.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="space-y-3">
      <h3 className="text-sm tracking-[0.2em] text-muted">Sunday call sheet</h3>
      <p className="text-sm text-muted">
        This is what the booth actually calls. Run/pass mix, fourth-down nerve, tempo, blitz frequency, and how you play inside the 20. The other club scripts off its scheme unless the scoreboard forces its hand.
      </p>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Dial label="Attack" field="attack" options={["run", "balanced", "pass"]} />
        <Dial label="Fourth down" field="fourth" options={["conservative", "normal", "aggressive"]} />
        <Dial label="Tempo" field="tempo" options={["chew", "standard", "hurry"]} />
        <Dial label="Blitz" field="blitz" options={["rare", "normal", "heavy"]} />
        <Dial label="Red zone" field="redZone" options={["power", "balanced", "spread"]} />
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
                  {cch.name} · {cch.age} · off {cch.offense}/def {cch.defense} · {cch.offScheme}/{cch.defScheme}
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
                    className={`cursor-pointer border-t border-line hover:bg-surface-2 ${i === 0 ? "lead-row" : ""} ${t.id === save.userTeamId ? "bg-club/20" : ""}`}
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
                <span className="text-sm text-muted">Wk {g.week}</span>
                <span className="inline-flex items-center gap-2">
                  {home ? "vs" : "@"} <Logo id={opp} size={24} /> {displayName(save.year, opp)}
                  {g.rivalry ? <span className="text-[10px] tracking-widest text-brass">RIVALRY</span> : null}
                  {g.night ? <span className="text-[10px] tracking-widest text-brass">NIGHT</span> : null}
                </span>
                <span className="tabular">{g.played ? `${g.homeScore}–${g.awayScore}` : "—"}</span>
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
  const teams = activeTeamIds(save.year);

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
      const s = p.stats[save.year];
      if (!hasSeasonWork(s)) return false;
      if (!inPos(p)) return false;
      if (teamFilter === "mine") return p.teamId === save.userTeamId;
      if (teamFilter !== "ALL") return p.teamId === teamFilter;
      return true;
    })
    .map((p) => ({ p, s: p.stats[save.year]! }));

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
      <div className="flex flex-wrap gap-2">
        {filters.map((pos) => (
          <button
            key={pos}
            type="button"
            onClick={() => setPosFilter(pos)}
            className={`min-h-11 rounded-md border px-3 text-xs tracking-widest ${
              posFilter === pos ? "border-brass bg-brass/20 text-brass" : "border-line bg-surface text-muted"
            }`}
          >
            {pos}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTeamFilter("ALL")}
          className={`min-h-11 rounded-md border px-3 text-xs tracking-widest ${
            teamFilter === "ALL" ? "border-brass bg-brass/20 text-brass" : "border-line bg-surface text-muted"
          }`}
        >
          League
        </button>
        <button
          type="button"
          onClick={() => setTeamFilter("mine")}
          className={`min-h-11 rounded-md border px-3 text-xs tracking-widest ${
            teamFilter === "mine" ? "border-brass bg-brass/20 text-brass" : "border-line bg-surface text-muted"
          }`}
        >
          My club
        </button>
        {teams.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTeamFilter(id)}
            className={`min-h-11 rounded-md border px-3 text-xs tracking-widest ${
              teamFilter === id ? "border-brass bg-brass/20 text-brass" : "border-line bg-surface text-muted"
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
                        Play a Sunday — stats land after the whistle.
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
      <FranchiseBook />
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
                  MVP <Nm id={a.mvp} /> · OPOY <Nm id={a.offPoy} /> · DPOY <Nm id={a.defPoy} /> · CPOTY{" "}
                  <Nm id={a.cpoty} />
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
      <section>
        <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">Hall of Fame</h3>
        <ul className="space-y-2">
          {save.history.hof.map((h) => {
            const player = h.playerId ? save.players[h.playerId] : undefined;
            const coach = h.coachId ? save.coaches[h.coachId] : undefined;
            return (
              <li key={`${h.kind ?? "player"}-${h.playerId ?? h.coachId}-${h.year}`} className="text-sm">
                {h.year}:{" "}
                {h.kind === "coach" ? (
                  <span>
                    {coach?.name ?? h.coachId} <span className="text-muted">· coach</span>
                  </span>
                ) : player ? (
                  <PlayerLink player={player} className="inline min-h-0" />
                ) : (
                  h.playerId
                )}{" "}
                — {h.blurb}
              </li>
            );
          })}
          {!save.history.hof.length && <p className="text-muted">No class yet. Five-year wait after retirement.</p>}
        </ul>
      </section>
    </div>
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
  { id: "roster", label: "Roster" },
  { id: "depth", label: "Depth" },
  { id: "staff", label: "Staff" },
  { id: "market", label: "Market" },
  { id: "standings", label: "Standings" },
  { id: "schedule", label: "Schedule" },
  { id: "stats", label: "Stats" },
  { id: "draft", label: "Draft" },
  { id: "history", label: "History" },
];

function PlayShell() {
  const { save, tab, setTab, resign, exportJson } = useGameStore();
  const event = useMemo(() => {
    if (!save) return false;
    return (
      ["superBowl", "proBowl", "awards", "retirement", "hof", "expansion", "carousel", "relocation", "preseason"].includes(
        save.phase,
      ) || weekIsInTheBooks(save)
    );
  }, [save]);
  if (!save) return <TitleScreen />;
  const download = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nfl-rewind-${save.userTeamId}-${save.year}.json`;
    a.click();
  };
  const showDraft = save.phase === "draft" && !event;
  const showFa = save.phase === "freeAgency" && !event;
  const showDeadline = save.phase === "deadline" && !event;
  return (
    <ClubDesk id={save.userTeamId} year={save.year} className="min-h-dvh bg-bg">
      <header
        className="carbon sticky top-0 z-10 border-b border-line backdrop-blur"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--color-club) 22%, var(--color-studio)), var(--color-studio) 70%)",
        }}
      >
        <ClubRibbon />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="chrome-bevel flex items-center gap-3 rounded-md bg-black/30 px-3 py-1.5">
            <Logo id={save.userTeamId} size={32} />
            <div>
              <p className="font-display text-sm italic leading-none tracking-wide text-fg">
                {displayName(save.year, save.userTeamId)}
              </p>
              <p className="stat-glow text-xs text-club-2">{save.weekLabel}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Btn onClick={download} className="hidden sm:inline-flex">
              Export
            </Btn>
            <Btn kind="primary" onClick={resign}>
              Title
            </Btn>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-4 pb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`chrome-bevel min-h-10 shrink-0 rounded-md px-3 font-display text-sm font-semibold uppercase italic tracking-wide transition-all ${
                tab === t.id
                  ? "bg-gradient-to-b from-club to-[color-mix(in_srgb,var(--color-club)_70%,black)] text-club-fg"
                  : "bg-black/25 text-muted hover:text-fg"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main key={event ? `event-${save.phase}` : tab} className="rise-in mx-auto max-w-6xl px-4 py-6">
        {event ? <EventPane /> : null}
        {showDraft && (tab === "draft" || tab === "office") ? <DraftNight /> : null}
        {showFa && tab === "office" ? <FreeAgencyNight /> : null}
        {showDeadline && tab === "office" ? <DeadlineNight /> : null}
        {!event && !showDraft && !showFa && !showDeadline && tab === "office" && <Office />}
        {!event && tab === "roster" && <Roster />}
        {!event && tab === "depth" && <Depth />}
        {!event && tab === "staff" && <Staff />}
        {!event && tab === "market" && <MarketDesk />}
        {!event && tab === "standings" && <Standings />}
        {!event && tab === "schedule" && <Schedule />}
        {!event && tab === "stats" && <Stats />}
        {!event && tab === "draft" && !showDraft && <DraftNight />}
        {!event && tab === "history" && <History />}
        <PlayerProfile />
        <TeamRosterModal />
      </main>
    </ClubDesk>
  );
}

export function GameApp() {
  const screen = useGameStore((s) => s.screen);
  if (screen === "title") return <TitleScreen />;
  if (screen === "select") return <TeamSelect />;
  return <PlayShell />;
}
