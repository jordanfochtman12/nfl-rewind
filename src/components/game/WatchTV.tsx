/**
 * TV mode: watch mode as one continuous broadcast. The channel runs the calendar on its own -
 * the season preview show, a pregame look at each week's races and storylines, the
 * whip-around of every game, the studio recap, the playoffs, the Super Bowl live, awards
 * night, the draft and the winter - and breaks in with a bulletin when big news lands.
 * A crawl runs along the bottom the whole time (finals, the wire, the standings, who's hurt),
 * holding back whatever the games on the air decided.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { settingsNow } from "@/lib/settings-store";
import type { Tab } from "@/lib/game-store";
import { MobileGameDock, MobileSectionPicker } from "./Broadcast";
import {
  breakingNews,
  newsTag,
  tvCrawl,
  buildSeasonPreview,
  displayName,
  activeTeamIds,
  gamesInSeason,
  historyData,
  draftQueue,
  featuredScore,
  gamesInWeek,
  playerName,
  rulesTakingEffect,
  weekIsInTheBooks,
  type AdvanceOpts,
  type DynastySave,
  type GameResult,
  type PrimetimeShow,
  type TeamId,
} from "@/lib/game";
import type { NewsItem } from "@/lib/game/types";
import { footballSpeech } from "@/lib/game/footballSpeech";
import { crewFor } from "@/lib/game/previewVoice";
import { castVoices } from "@/lib/voiceCast";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { FilmStill } from "./Art";
import { StudioEpisode } from "./StudioEpisode";
import { ShowTicker } from "./ShowKit";
import { SettingsSheet } from "./SettingsSheet";
import { Tour } from "./Tour";
import { TV_TOUR } from "./tours";
import { WhipAround } from "./WhipAround";
import { LiveBroadcast } from "./LiveBroadcast";
import { DraftNight } from "./DraftNight";
import { GameRow } from "./Sandbox";
import { watchLabel } from "./watchLabel";
import { AwardLadders, PlayoffPicture, RecordChases, StoryBoard } from "./WatchStories";
import { cancelSpeech, isSpeaking, speakLine, useTalking } from "@/lib/voice/speech";
import { createTVAdvance, shouldHoldForNarration, tvMarkKey } from "@/lib/game/tvCountdown.ts";

type Episode = NonNullable<PrimetimeShow["episode"]>;

type Stage =
  | { k: "preview"; key: string; episode: Episode }
  | { k: "pregame"; key: string; slate: GameResult[] }
  | { k: "whip"; key: string; slate: GameResult[]; title: string }
  | { k: "live"; key: string; game: GameResult }
  | { k: "studio"; key: string; episode: Episode }
  | { k: "draft"; key: string }
  | { k: "card"; key: string; title: string; kicker: string; say: string; items: string[]; opts: AdvanceOpts; seconds: number; /** An info card: airing it marks this key instead of moving the calendar. */ mark?: string }
  | { k: "end"; key: string };

const STUDIO_EDITIONS: Record<string, Episode["edition"][]> = {
  regular: ["weekly", "seasonFinale"],
  playoffs: ["playoffs", "championship"],
  superBowl: ["superBowl"],
  awards: ["awards"],
};

/** The slate that was just played (regular week or playoff round). */
function playedSlate(save: DynastySave): GameResult[] {
  if (save.phase === "regular") return gamesInWeek(save, save.week);
  const played = save.playoffGames.filter((g) => g.played);
  const last = Math.max(0, ...played.map((g) => g.week));
  return played.filter((g) => g.week === last);
}

/** The slate about to kick off. */
function nextSlate(save: DynastySave): GameResult[] {
  if (save.phase === "regular") return gamesInWeek(save, save.week).filter((g) => !g.played);
  const open = save.playoffGames.filter((g) => !g.played);
  const first = Math.min(...open.map((g) => g.week));
  return open.filter((g) => g.week === first);
}

const phaseNews = (save: DynastySave, phases: string[], n = 8) =>
  save.news.filter((x) => x.year === save.year && phases.includes(x.phase)).slice(0, n).map((x) => x.headline);

/** What the channel shows next, given the calendar and what has already aired. */
function direct(save: DynastySave, seen: Set<string>, preview: () => Episode): Stage {
  const y = save.year;
  const ep = save.primetime?.episode;
  // The weekly recap can be switched off in settings; the big nights always air.
  const wantStudio = settingsNow().tvStudio || !["weekly", "playoffs"].includes(ep?.edition ?? "");
  const studio = ep && wantStudio && save.primetime!.year === y && STUDIO_EDITIONS[save.phase]?.includes(ep.edition) && !seen.has(ep.id) ? ep : undefined;
  const card = (key: string, title: string, kicker: string, say: string, items: string[], opts: AdvanceOpts = {}, seconds = 10): Stage => ({
    // Unique per calendar state, so each card gets its own countdown.
    k: "card", key: `${key}-${y}-${save.phase}-${save.week}-${save.draftPickIndex}`, title, kicker, say, items, opts, seconds,
  });
  if (save.realHistory) {
    // History episodes are made from the official record and must air before the next slate.
    const historicalEpisode = ep && save.primetime?.year === y && !save.primetime?.predictions && !save.primetime?.power && !save.primetime?.outlook;
    if (historicalEpisode && !seen.has(ep.id)) return { k: "studio", key: ep.id, episode: ep };
    const markCard = (key: string, title: string, kicker: string, say: string, items: string[], seconds = 18): Stage =>
      ({ ...(card(key, title, kicker, say, items, {}, seconds) as Extract<Stage, { k: "card" }>), mark: tvMarkKey(key, y) });
    if (save.phase === "draft") {
      const key = "record-draft";
      if (!seen.has(tvMarkKey(key, y))) {
        const people = historyData().people;
        const picks = historyData().drafts(y).slice().sort((a, b) => a.round - b.round || a.pick - b.pick);
        const firstByLeague = y === 1966 ? ["nfl", "afl"].map((league) => picks.find((p) => p.league === league)) : [picks[0]];
        const items = firstByLeague.filter((p): p is NonNullable<typeof p> => !!p).map((p) => {
          const person = people[p.person];
          return `${p.league ? `${p.league.toUpperCase()} · ` : ""}Pick ${p.pick}, Round ${p.round}: ${person ? `${person.first} ${person.last}` : "name not in the source table"} to the ${displayName(y, p.team)}${person?.pos ? ` (${person.pos})` : ""}.`;
        });
        if (y === 1966) {
          const boardSummary = (league: "nfl" | "afl") => {
            const board = picks.filter((p) => p.league === league);
            return `${board.length} ${league.toUpperCase()} selections across ${new Set(board.map((p) => p.round)).size} rounds`;
          };
          items.push(`${boardSummary("nfl")}; ${boardSummary("afl")} on separate boards.`);
        } else {
          items.push(`${picks.length} recorded selections across ${new Set(picks.map((p) => p.round)).size} rounds.`);
        }
        const dualDraft = y === 1966;
        return markCard("record-draft", dualDraft ? `The ${y} NFL and AFL drafts` : `The ${y} draft`, dualDraft ? "TWO LEAGUES · TWO BOARDS" : "THE REAL DRAFT BOARD", "Before the season begins, the original draft class enters the record. These are the selections as recorded, not a re-simulated draft.", items);
      }
      return card("record-open-season", `Open the ${y} season`, "NEXT IN THE RECORD", `Continue into the real ${y} season. The league will be rebuilt from that year's historical rosters and schedule.`, [], {}, 5);
    }
    if (save.phase === "preseason") {
      const key = "record-season";
      if (!seen.has(tvMarkKey(key, y))) {
        const previous = save.history.superBowls.at(-1);
        const rules = rulesTakingEffect(y);
        const items = [
          `${activeTeamIds(y).length} active clubs · ${gamesInSeason(y)} regular-season games per club.`,
          previous ? `The previous recorded champion: ${displayName(previous.year, (previous.homeScore > previous.awayScore ? previous.homeId : previous.awayId) as TeamId)} in ${previous.year}.` : "The record opens before Super Bowl I; the first championship story is still ahead.",
          ...rules.map((r) => `Rulebook, ${y}: ${r.title} — ${r.effect}`),
        ];
        const era = y < 1970 ? "AFL and NFL" : "AFC and NFC";
        return markCard("record-season", `${y}: the season ahead`, "A YEAR IN REAL FOOTBALL HISTORY", `The ${y} record is ready. ${activeTeamIds(y).length} clubs across the ${era}, with the actual rosters and results waiting week by week.`, items);
      }
      return card("record-kickoff", `The ${y} season opens`, "NEXT · WEEK ONE", "The historical schedule is about to begin. Each Sunday will be followed by its own real-results Primetime report.", [], {}, 5);
    }
    if (save.phase === "regular") {
      const slate = nextSlate(save);
      const items = slate.slice(0, 9).map((g) => `${displayName(y, g.awayId as TeamId)} (${save.teams[g.awayId as TeamId] ? `${save.teams[g.awayId as TeamId]!.wins}-${save.teams[g.awayId as TeamId]!.losses}` : "—"}) at ${displayName(y, g.homeId as TeamId)} (${save.teams[g.homeId as TeamId] ? `${save.teams[g.homeId as TeamId]!.wins}-${save.teams[g.homeId as TeamId]!.losses}` : "—"}).`);
      if (slate.length > 9) items.push(`${slate.length - 9} more games on this week's real schedule.`);
      const key = `record-week-${y}-${save.week}`;
      if (!seen.has(`${key}-${y}`)) return markCard(key, `Week ${save.week}: the real schedule`, `${y} · BEFORE KICKOFF`, `Here is the actual Week ${save.week} slate. Records shown are from the replay at this point in the season; no result has been projected.`, items, 16);
      return card("record-advance-week", `Week ${save.week} is next`, `${y} · THE HISTORICAL CALENDAR`, "Continue to place this week's actual results in the record. Primetime will return with the full Sunday recap before the next week begins.", [], {}, 5);
    }
    if (save.phase === "playoffs") {
      const slate = nextSlate(save);
      const key = `record-playoff-${y}-${slate[0]?.round ?? save.week}`;
      if (!seen.has(`${key}-${y}`)) {
        const items = slate.slice(0, 8).map((g) => `${g.round ?? "Playoffs"}: ${displayName(y, g.awayId as TeamId)} at ${displayName(y, g.homeId as TeamId)}.`);
        if (!items.length) items.push("The next postseason round is taken directly from the historical bracket.");
        return markCard(key, slate[0]?.round ?? "The playoffs", `${y} · THE ROAD TO THE TITLE`, "The postseason bracket and matchups follow the historical record exactly.", items, 16);
      }
      return card("record-advance-playoffs", `${slate[0]?.round ?? "The next round"} is next`, `${y} · ELIMINATION FOOTBALL`, "Continue to the actual postseason results. The studio recap will cover the round before the bracket moves on.", [], {}, 5);
    }
    if (save.phase === "superBowl") {
      const g = save.superBowl;
      const winner = g?.played ? (g.homeScore > g.awayScore ? g.homeId : g.awayId) : undefined;
      const mvp = g?.mvpPlayerId ? save.players[g.mvpPlayerId] : undefined;
      const items = g?.played ? [`${displayName(y, g.awayId as TeamId)} ${g.awayScore}, ${displayName(y, g.homeId as TeamId)} ${g.homeScore}.`, ...(winner ? [`${displayName(y, winner as TeamId)} are the recorded champions.`] : []), ...(mvp ? [`Super Bowl Most Valuable Player: ${playerName(mvp)}.`] : [])] : [];
      return card("record-sb-transition", `The ${y} championship is in the record`, `SUPER BOWL ${y}`, "The result and award are preserved from the historical game. Next, the season's real awards are presented.", items, {}, 10);
    }
    if (save.phase === "awards") return card("record-awards-transition", `${y} honors are recorded`, "NEXT · CANTON", "Continue to the Hall of Fame class that was actually inducted after this season.", [], {}, 6);
    if (save.phase === "hof") {
      const classYear = y + 1;
      const members = save.history.hof.filter((m) => m.year === classYear);
      const items = members.map((m) => `${m.name ?? (m.playerId && save.players[m.playerId] ? playerName(save.players[m.playerId]!) : m.coachId ? save.coaches[m.coachId]?.name : "Recorded inductee")}${m.teamId ? ` · ${displayName(classYear, m.teamId)}` : ""}${m.kind ? ` · ${m.kind}` : ""}.`);
      return card("record-hof", `The Hall of Fame · Class of ${classYear}`, "CANTON · THE REAL CLASS", members.length ? `${members.length} recorded inductee${members.length === 1 ? "" : "s"} entered the Hall in ${classYear}.` : `The record has no listed inductees for the Class of ${classYear}.`, items, {}, 14);
    }
    if (save.phase === "complete") return { k: "end", key: "end" };
    return card(`record-${save.phase}`, save.weekLabel, `${y} · THE RECORD`, `Continue through the historical calendar: ${save.weekLabel}.`, [], {}, 5);
  }
  switch (save.phase) {
    case "preseason": {
      if (save.camp?.year !== y)
        return card("camp", "Training camp opens", `${y} PRESEASON`, `Training camps open around the league. The ${y} season is almost here.`, phaseNews(save, ["freeAgency", "preseason"]));
      const rules = rulesTakingEffect(y);
      if (rules.length && !seen.has(`rules-${y}`))
        return { ...(card("rules", `New rules for ${y}`, "THE RULEBOOK", `New rules for ${y}. ${rules.map((r) => r.title).join(". ")}.`, rules.map((r) => `${r.title}: ${r.effect}`), {}, 12) as Extract<Stage, { k: "card" }>), mark: `rules-${y}` };
      const p = preview();
      if (!seen.has(`preview-${y}`)) return { k: "preview", key: `preview-${y}`, episode: p };
      return card("kickoff", `The ${y} season kicks off`, "OPENING WEEKEND", `Cut-downs are done. Here comes week one of the ${y} season.`, phaseNews(save, ["preseason"]));
    }
    case "regular":
    case "playoffs": {
      if (!weekIsInTheBooks(save)) {
        const slate = nextSlate(save);
        return { k: "pregame", key: `pre-${y}-${slate[0]?.id ?? save.week}`, slate };
      }
      const slate = playedSlate(save);
      const key = `whip-${y}-${slate[0]?.id ?? save.week}`;
      if (!seen.has(key)) return { k: "whip", key, slate, title: save.phase === "playoffs" ? slateTitle(slate, "Playoffs") : `Week ${save.week}` };
      if (studio) return { k: "studio", key: studio.id, episode: studio };
      return card("next", watchLabel(save), save.weekLabel.toUpperCase(), "", [], {}, 0);
    }
    case "deadline":
      return card("deadline", "The trade window", "AROUND THE LEAGUE", "The trade window is open. Here's who dealt.", phaseNews(save, ["deadline", "regular"], 6));
    case "superBowl": {
      const g = save.superBowl;
      if (g && !g.played) return { k: "pregame", key: `pre-sb-${y}`, slate: [g] };
      if (g?.log?.length && !seen.has(`sb-${y}`)) return { k: "live", key: `sb-${y}`, game: g };
      if (studio) return { k: "studio", key: studio.id, episode: studio };
      return card("sbdone", "On to awards night", "THE SEASON IS IN THE BOOKS", "", [], {}, 4);
    }
    case "awards": {
      if (studio) return { k: "studio", key: studio.id, episode: studio };
      const a = save.awards;
      const nm = (id?: string) => (id && save.players[id] ? playerName(save.players[id]!) : undefined);
      const items = a
        ? [
            ["MVP", nm(a.mvp)],
            ["Offensive Player of the Year", nm(a.offPoy)],
            ["Defensive Player of the Year", nm(a.defPoy)],
            [a.droy ? "Offensive Rookie of the Year" : "Rookie of the Year", nm(a.oroy)],
            ["Defensive Rookie of the Year", nm(a.droy)],
            ["Comeback Player of the Year", nm(a.cpoty)],
            ["Coach of the Year", a.coy ? save.coaches[a.coy]?.name : undefined],
          ].filter((r) => r[1]).map((r) => `${r[0]}: ${r[1]}`)
        : [];
      return card("awards", "Awards night", `${y} HONORS`, items[0] ? `The ${y} ${items[0]}.` : "", items, {}, 14);
    }
    case "proBowl": {
      const g = save.proBowl;
      return card("probowl", "The Pro Bowl", "ALL-STAR WEEK", "", g?.played ? [`${String(g.awayId).toUpperCase()} ${g.awayScore}, ${String(g.homeId).toUpperCase()} ${g.homeScore}`] : phaseNews(save, ["proBowl", "awards"], 5), {}, 8);
    }
    case "preDraft": {
      const names = save.draftBoard.slice(0, 6).map((slot, i) => {
        const p = save.players[slot.playerId];
        return p ? `${i + 1}. ${playerName(p)}, ${p.pos} · ${p.college ?? "college"}` : `${i + 1}. Draft board update`;
      });
      return card("pre-draft", `The ${y} Draft Preview`, "PRE-DRAFT SPECIAL", "The board is set. Here are the names, needs, and debates to know before the first pick.", names, {}, 12);
    }
    case "waivers":
      return card("waivers", "The waiver wire", "FRONT OFFICE WINDOW", `${save.waivers.length} player${save.waivers.length === 1 ? " is" : "s are"} available to claim before the next Sunday.`, save.waivers.slice(0, 8).map((w) => {
        const p = save.players[w.playerId];
        return p ? `${playerName(p)} · ${p.pos} · waived by ${displayName(y, w.from)}` : "An unlisted player is on waivers.";
      }), {}, 8);
    case "retirement":
      return card("retire", "Farewells", "RETIREMENTS", "Some familiar names are hanging it up.", phaseNews(save, ["retirement", "proBowl"]), {}, 10);
    case "hof":
      return card("hof", "The Hall of Fame class", "CANTON", "The new Hall of Fame class is in.", phaseNews(save, ["hof", "retirement"]), {}, 12);
    case "carousel":
      return card("carousel", "The coaching carousel", "HIRINGS AND FIRINGS", "The coaching carousel is spinning.", phaseNews(save, ["carousel", "hof"]), {}, 10);
    case "relocation":
    case "expansion":
      return card(save.phase, save.phase === "expansion" ? "Expansion" : "On the move", "LEAGUE OFFICE", "", phaseNews(save, [save.phase, "carousel"]), {}, 10);
    case "draft": {
      const q = draftQueue(save);
      const pick = q[save.draftPickIndex];
      if (pick && pick.round <= 1) return { k: "draft", key: `draft-${y}` };
      return card("draftrest", "The rest of the draft", `${y} DRAFT`, "Round one is in the books. The rest of the draft goes fast.", [], { auto: true }, 5);
    }
    case "freeAgency":
      return card("fa", y < 1994 ? "The offseason" : "Free agency", "THE WINTER", y < 1994 ? "Stars rarely move in this era. Here's who changed teams." : "The market is open. Here's who signed where.", phaseNews(save, ["freeAgency", "draft"], 8), { closeFa: true }, 10);
    case "complete":
      return { k: "end", key: "end" };
  }
}

/** Speak one line in the studio host's voice. */
function useHost(year: number, on: boolean) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  return useCallback(
    (text: string) => {
      if (!on || !text || !("speechSynthesis" in window)) return;
      const host = crewFor(year).HOST;
      const u = new SpeechSynthesisUtterance(footballSpeech(text, year));
      const c = castVoices(voices, [{ key: host.name, gender: host.gender }], settingsNow().voiceName).get(host.name);
      if (c?.voice) u.voice = c.voice;
      u.rate = c?.rate ?? 1;
      u.pitch = c?.pitch ?? 1;
      cancelSpeech();
      speakLine(u);
    },
    [voices, year, on],
  );
}

/** Keeps a phone's screen awake while the channel is on. */
function useWakeLock() {
  useEffect(() => {
    type Lock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Lock> } };
    let lock: Lock | undefined;
    const take = () => {
      if (document.visibilityState === "visible") nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      document.removeEventListener("visibilitychange", take);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

export function WatchTV({
  tabs,
  active,
  onPick,
  onDraftPreview,
}: {
  tabs: { id: Tab; label: string }[];
  active: Tab;
  onPick: (id: Tab) => void;
  onDraftPreview?: () => void;
}) {
  const save = useGameStore((s) => s.save)!;
  const step = useGameStore((s) => s.step);
  const setTv = useGameStore((s) => s.setTv);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [paused, setPaused] = useState(false);
  const [voice, setVoice] = useState(() => settingsNow().narration);
  const say = useHost(save.year, voice);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useWakeLock();

  const previewYear = useRef<number>(-1);
  const previewEp = useRef<Episode | null>(null);
  const preview = useCallback(() => {
    if (previewYear.current !== save.year || !previewEp.current) {
      previewEp.current = buildSeasonPreview(save).episode as Episode;
      previewYear.current = save.year;
    }
    return previewEp.current;
  }, [save]);
  const stage = useMemo(() => direct(save, seen, preview), [save, seen, preview]);

  // Breaking news: anything big that lands while the channel is on gets a bulletin, held until
  // the games in progress are over so a score is never spoiled.
  const known = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<NewsItem[]>([]);
  useEffect(() => {
    const now = breakingNews(save);
    if (!known.current) {
      known.current = new Set(now.map((n) => n.id));
      return;
    }
    const fresh = now.filter((n) => !known.current!.has(n.id)).reverse();
    for (const n of fresh) known.current.add(n.id);
    if (fresh.length && settingsNow().tvBulletins) setQueue((q) => [...q, ...fresh].slice(-4));
  }, [save]);
  const onAir = stage.k === "whip" || stage.k === "live" || stage.k === "draft" || stage.k === "preview";
  const bulletin = !onAir ? queue[0] : undefined;
  // The crawl. The studio shows and the draft room run their own.
  const airing = stage.k === "whip" ? stage.slate : stage.k === "live" ? [stage.game] : undefined;
  const crawlOn = !bulletin && stage.k !== "studio" && stage.k !== "preview" && stage.k !== "draft";
  const crawl = useMemo(
    () => (crawlOn ? tvCrawl(save, { onAir: stage.k === "whip" ? stage.slate : stage.k === "live" ? [stage.game] : undefined }) : []),
    [save, crawlOn, stage],
  );

  const mark = useCallback((key: string) => setSeen((s) => new Set(s).add(key)), []);
  const advance = useCallback(
    (opts: AdvanceOpts) => {
      const s = useGameStore.getState().save;
      if (!s || s.phase === "complete") return;
      step(opts);
    },
    [step],
  );
  /** Ends the current segment: marks it aired, or moves the calendar. */
  const next = useCallback(() => {
    if (bulletin) {
      setQueue((q) => q.slice(1));
      return;
    }
    switch (stage.k) {
      case "preview":
      case "whip":
      case "live":
      case "studio":
        mark(stage.key);
        return;
      case "pregame":
        advance({});
        return;
      case "card":
        if (stage.mark) mark(stage.mark);
        else advance(stage.opts);
        return;
      case "draft":
        advance({ auto: true });
        return;
      case "end":
        return;
    }
  }, [bulletin, stage, mark, advance]);

  // The draft room reads round one; then the rest of the board goes at once.
  useEffect(() => {
    if (stage.k !== "draft") return;
    const pick = draftQueue(save)[save.draftPickIndex];
    if (!pick || pick.round > 1) advance({ auto: true });
  }, [save, stage.k, advance]);

  const exit = () => {
    if ("speechSynthesis" in window) cancelSpeech();
    setTv(false);
  };

  return (
    <div className="tv-mode fixed inset-0 z-[60] overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label="Rewind TV">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#04050ae6] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2">
          <p className="flex min-w-0 items-center gap-2">
            <span className="bg-red px-2 py-0.5 font-display text-xs font-extrabold italic tracking-[0.2em] text-white">REWIND TV</span>
            <span className="truncate font-display text-sm uppercase italic text-paper">
              {save.year} · {save.weekLabel}
            </span>
            {onAir && queue.length > 0 && (
              <span className="tv-desk-tease shrink-0 border border-red/70 px-2 py-0.5 font-display text-[11px] font-bold uppercase italic tracking-wider text-white" role="status">
                News desk · {queue.length} {queue.length === 1 ? "story" : "stories"} after this
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" data-tour="tv-hold" className="bx-chip min-h-10 px-3 text-xs" aria-pressed={paused} onClick={() => setPaused(!paused)}>
              {paused ? "▶ Resume" : "❚❚ Hold"}
            </button>
            <button type="button" className="bx-chip min-h-10 px-3 text-xs" aria-pressed={voice} onClick={() => { if (voice) window.speechSynthesis?.cancel(); setVoice(!voice); }}>
              Host: {voice ? "on" : "off"}
            </button>
            <button type="button" data-tour="tv-skip" className="bx-chip min-h-10 px-3 text-xs" disabled={stage.k === "end"} onClick={next}>
              Skip ▸
            </button>
            <button type="button" className="bx-chip min-h-10 px-3 text-xs" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
              ⚙
            </button>
            <button type="button" data-tour="tv-exit" className="bx-chip min-h-10 px-3 text-xs" onClick={exit}>
              Exit TV
            </button>
          </div>
          <MobileSectionPicker tabs={tabs} active={active} onPick={onPick} />
        </div>
      </header>
      <div className="tv-content mx-auto max-w-6xl px-3 pb-24 pt-4 sm:px-4">
        {bulletin ? (
          <Bulletin key={bulletin.id} item={bulletin} save={save} say={say} paused={paused} onDone={() => setQueue((q) => q.slice(1))} />
        ) : stage.k === "preview" ? (
          <StudioEpisode key={stage.key} episode={stage.episode} year={save.year} autoPlay onDone={() => mark(stage.key)} />
        ) : stage.k === "studio" ? (
          <StudioEpisode key={stage.key} episode={stage.episode} year={save.year} autoPlay onDone={() => mark(stage.key)} />
        ) : stage.k === "whip" ? (
          <WhipAround key={stage.key} games={stage.slate} year={save.year} title={stage.title} onDone={() => mark(stage.key)} />
        ) : stage.k === "live" ? (
          <LiveTv key={stage.key} game={stage.game} onDone={() => mark(stage.key)} />
        ) : stage.k === "pregame" ? (
          <Pregame key={stage.key} save={save} slate={stage.slate} say={say} paused={paused} onGo={next} />
        ) : stage.k === "draft" ? (
          <DraftNight />
        ) : stage.k === "card" ? (
          <Card key={stage.key} stage={stage} save={save} say={say} paused={paused} onGo={next} />
        ) : (
          <section className="rounded-xl border border-brass/40 bg-studio p-6 text-center">
            <p className="font-display text-xs tracking-[0.4em] text-brass">THAT'S THE TIMELINE</p>
            <h2 className="mt-2 font-display text-4xl">Thanks for watching</h2>
            <Btn kind="primary" className="mt-4" onClick={exit}>
              Back to the desk
            </Btn>
          </section>
        )}
      </div>
      {crawl.length > 0 && (
        <div className="tv-crawl">
          <ShowTicker items={crawl} label={airing ? "AROUND THE LEAGUE · LIVE" : "AROUND THE LEAGUE"} />
        </div>
      )}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      {!settingsOpen && <Tour id="tv" steps={TV_TOUR} />}
      <MobileGameDock className="mobile-game-dock-tv" tabs={tabs} active={active} onPick={onPick} onDraftPreview={onDraftPreview} />
    </div>
  );
}

const MVP_ONLY = ["mvp"];

/** A countdown that can be held, then fires once. */
function useCountdown(seconds: number, paused: boolean, onGo: () => void) {
  const [left, setLeft] = useState(seconds);
  const go = useRef(onGo);
  go.current = onGo;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Manual Continue and the zero-second auto-advance must share one gate. Otherwise a tap
  // that lands as the timer fires can advance twice (or leave a stale transition on screen).
  const goNowRef = useRef<(() => void) | null>(null);
  if (!goNowRef.current) {
    goNowRef.current = createTVAdvance(
      () => go.current(),
      () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
      },
    );
  }
  const goNow = goNowRef.current!;
  useEffect(() => {
    if (paused) return;
    if (left <= 0) {
      // The host finishes his line before the channel moves on: the next screen's first line
      // used to cut him off mid-sentence. (A tap on the button still moves on at once.)
      let waited = 0;
      const fire = () => {
        if (isSpeaking() && shouldHoldForNarration(waited)) {
          waited += 300;
          timer.current = setTimeout(fire, 300);
          return;
        }
        // Speech synthesis can fail to deliver onend on mobile Safari. Never let a voice
        // session hold the whole historical broadcast after its card countdown has finished.
        if (isSpeaking()) cancelSpeech();
        goNow();
      };
      timer.current = setTimeout(fire, 0);
      return () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
      };
    }
    timer.current = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [left, paused, goNow]);
  return { left, goNow };
}

function Countdown({ left, label, onGo }: { left: number; label: string; onGo: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Btn kind="primary" className="min-h-12 px-6" onClick={onGo}>
        {label} <span aria-hidden>▸</span>
      </Btn>
      <span className="tabular text-sm text-muted" aria-live="off">
        Starting in {Math.max(0, left)}s
      </span>
    </div>
  );
}

/**
 * A playoff slate's name. The NFL and AFL title games of 1966-69 share a weekend, and the
 * first game's round alone put "AFL Championship" over the NFL game on the screen.
 */
function slateTitle(slate: GameResult[], fallback: string): string {
  const rounds = [...new Set(slate.map((g) => g.round).filter((r): r is string => !!r))];
  if (rounds.length <= 1) return rounds[0] ?? fallback;
  const leagues = rounds.map((r) => r.match(/^(\S+) Championship$/)?.[1]);
  if (leagues.every(Boolean)) return `${leagues.sort((a, b) => (a === "NFL" ? -1 : b === "NFL" ? 1 : a!.localeCompare(b!))).join(" & ")} Championships`;
  return rounds.join(" · ");
}

function Pregame({ save, slate, say, paused, onGo }: { save: DynastySave; slate: GameResult[]; say: (t: string) => void; paused: boolean; onGo: () => void }) {
  const { left, goNow } = useCountdown(save.phase === "superBowl" ? 15 : 14, paused, onGo);
  const played = Math.max(0, ...Object.values(save.teams).map((t) => t.wins + t.losses + t.ties));
  const featured = useMemo(
    () => slate.slice().sort((a, b) => featuredScore(save, b) - featuredScore(save, a) || a.id.localeCompare(b.id))[0],
    [save, slate],
  );
  const focus = useMemo(() => (slate.length <= 2 ? slate.flatMap((g) => [g.homeId, g.awayId] as TeamId[]) : undefined), [slate]);
  const title = save.phase === "superBowl" ? save.superBowl?.round ?? "The Super Bowl" : save.phase === "playoffs" ? slateTitle(slate, "The playoffs") : `Week ${save.week}`;
  useEffect(() => {
    const f = featured;
    const line = f
      ? save.phase === "superBowl"
        ? `It's Super Bowl Sunday. The ${displayName(save.year, f.awayId as TeamId)} and the ${displayName(save.year, f.homeId as TeamId)}, for all of it.`
        : `${title}. ${slate.length} game${slate.length === 1 ? "" : "s"} on the board, and the game of the week is the ${displayName(save.year, f.awayId as TeamId)} at the ${displayName(save.year, f.homeId as TeamId)}.`
      : title;
    say(line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
        <FilmStill still={save.phase === "superBowl" ? "superbowl" : "primetime"} veil="full" />
        <div className="relative space-y-3 px-5 py-6">
          <p className="font-display text-xs tracking-[0.4em] text-brass">PREGAME · {save.year}</p>
          <h2 className="font-display text-4xl sm:text-5xl">{title}</h2>
          <Countdown left={left} label={save.phase === "superBowl" ? "Kick it off" : "Go to the whip-around"} onGo={goNow} />
        </div>
      </section>
      <section className="rounded-xl border border-line bg-surface p-4">
        <p className="text-xs tracking-[0.25em] text-muted">ON THE BOARD</p>
        <ul className="mt-3 space-y-2">
          {slate.map((g) => (
            <GameRow key={g.id} save={save} g={g} tag={g.id === featured?.id && slate.length > 1 ? "GAME OF THE WEEK" : undefined} />
          ))}
        </ul>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <StoryBoard save={save} max={4} focus={focus} />
        <div className="space-y-4">
          <RecordChases save={save} />
          {played >= 4 && save.phase === "regular" && <AwardLadders save={save} only={MVP_ONLY} top={3} />}
        </div>
      </div>
      {save.phase === "regular" && played >= Math.ceil(gamesInSeason(save.year) * 0.4) && <PlayoffPicture save={save} compact />}
    </div>
  );
}

function Card({ stage, save, say, paused, onGo }: { stage: Extract<Stage, { k: "card" }>; save: DynastySave; say: (t: string) => void; paused: boolean; onGo: () => void }) {
  const { left, goNow } = useCountdown(stage.seconds, paused, onGo);
  useEffect(() => {
    if (stage.say) say(stage.say);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (stage.seconds === 0) return <p className="py-10 text-center text-muted">{stage.title}…</p>;
  return (
    <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
      <FilmStill still="office" veil="full" />
      <div className="relative space-y-4 px-5 py-6">
        <p className="font-display text-xs tracking-[0.4em] text-brass">{stage.kicker}</p>
        <h2 className="font-display text-4xl sm:text-5xl">{stage.title}</h2>
        {stage.items.length > 0 && (
          <ul className="max-w-2xl space-y-2">
            {stage.items.map((t, i) => (
              <li key={i} className="border-l-2 border-brass/50 pl-3 text-paper">
                {t}
              </li>
            ))}
          </ul>
        )}
        <Countdown left={left} label={stage.mark ? "Continue" : watchLabel(save)} onGo={goNow} />
      </div>
    </section>
  );
}

const BULLETIN_LEAD = { BREAKING: "This just in.", REPORT: "We're getting a report.", UPDATE: "An update for you." } as const;
const BULLETIN_BAR = { BREAKING: "BREAKING NEWS", REPORT: "REPORT · SOURCES", UPDATE: "NEWS UPDATE" } as const;

function Bulletin({ item, save, say, paused, onDone }: { item: NewsItem; save: DynastySave; say: (t: string) => void; paused: boolean; onDone: () => void }) {
  const tag = newsTag(item);
  // Long enough to read the story; the host's read holds it past the countdown if it runs long.
  const { left, goNow } = useCountdown(Math.max(9, Math.min(20, Math.round((item.headline.length + item.body.length) / 18))), paused, onDone);
  useEffect(() => {
    say(`${BULLETIN_LEAD[tag]} ${item.headline}. ${item.body}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <section className="tv-bulletin overflow-hidden rounded-xl border-2 border-red bg-studio" role="alert">
      <div className="flex items-center justify-between bg-red px-4 py-2">
        <span className="font-display text-sm font-extrabold italic tracking-[0.3em] text-white">{BULLETIN_BAR[tag]}</span>
        <span className="tabular text-xs text-white/80">{Math.max(0, left)}s</span>
      </div>
      <div className="flex gap-4 px-5 py-8">
        <div className="flex shrink-0 flex-col gap-2">
          {item.teamIds.slice(0, 2).map((id) => (
            <Logo key={id} id={id} size={56} year={save.year} />
          ))}
        </div>
        <div>
          <h2 className="font-display text-3xl sm:text-4xl">{item.headline}</h2>
          {item.body && <p className="mt-2 max-w-2xl text-paper">{item.body}</p>}
          <Btn className="mt-4" onClick={goNow}>
            Back to the broadcast
          </Btn>
        </div>
      </div>
    </section>
  );
}

function LiveTv({ game, onDone }: { game: GameResult; onDone: () => void }) {
  const [ended, setEnded] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  // After the final whistle the podium may be on the air: move on once it signs off.
  const talking = useTalking((s) => s.talking);
  useEffect(() => {
    if (!ended || talking) return;
    const t = setTimeout(() => done.current(), 8000);
    return () => clearTimeout(t);
  }, [ended, talking]);
  return <LiveBroadcast game={game} log={game.log!} onDone={onDone} onReachEnd={() => setEnded(true)} autoHalftime />;
}
