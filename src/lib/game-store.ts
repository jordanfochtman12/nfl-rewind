import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import {
  advance,
  cloneSave,
  compactSave,
  createNewGame,
  hydrateSave,
  createHistoryGame,
  historyCursor,
  loadHistoryData,
  replayHistory,
  setHistoryData,
  applyLiveLines,
  boxSeason,
  loadBoxSeason,
  toggleFollow as toggleFollowIn,
  type HistoryCursor,
  openCalls,
  ownerGameJustPlayed,
  simUntil,
  withOrder,
  type LiveOrder,
  type AdvanceOpts,
  type DynastySave,
  type TeamId,
} from "@/lib/game/index.ts";
import { dynastyStorage } from "@/lib/save-idb.ts";
import { activeSlot, recordSlot, setActiveSlot, slotIndex, slotKey } from "@/lib/save-slots.ts";
import { importDynasty } from '@/lib/game/importSave';

export type Screen = "title" | "select" | "play";
export type Tab =
  | "office"
  | "primetime"
  | "roster"
  | "depth"
  | "staff"
  | "market"
  | "standings"
  | "schedule"
  | "stats"
  | "draft"
  | "history"
  | "superbowl"
  | "team"
  | "hof"
  | "league";

interface GameStore {
  save: DynastySave | null;
  screen: Screen;
  tab: Tab;
  profileId: string | null;
  viewTeamId: TeamId | null;
  pendingTeam: TeamId | null;
  lastDeskNote: string | null;
  hasHydrated: boolean;
  setScreen: (s: Screen) => void;
  setTab: (t: Tab) => void;
  openProfile: (id: string) => void;
  closeProfile: () => void;
  openTeam: (id: TeamId) => void;
  closeTeam: () => void;
  newGame: (teamId: TeamId) => void;
  /** Watch mode: the computer runs every club and the owner just watches history unfold. */
  newSandbox: () => void;
  /** History mode: the real league, step by step from the 1966 draft. Loads its tables first. */
  newHistory: () => Promise<void>;
  /** True while History mode's tables load (and a saved History game replays to where it was). */
  historyLoading: boolean;
  /** Sandbox fast-forward. Runs from any phase; the featured games still get their broadcast. */
  watchSim: (target: "playoffs" | "superBowl" | "nextSeason") => void;
  continueGame: () => void;
  step: (opts?: AdvanceOpts) => void;
  simWeek: () => void;
  /** Batch sim to the trade deadline or the playoffs; stops early if a club calls. Returns why it stopped. */
  simTo: (target: "deadline" | "playoffs") => string;
  desk: (fn: (s: DynastySave) => string | void) => void;
  /** The save just before the owner's latest game was played, for calls during its broadcast. */
  rewind: { gameId: string; pre: DynastySave; opts?: AdvanceOpts } | null;
  /** Send a call down from the owner's box at a play of the live broadcast; the game replays from there. */
  liveOrder: (order: Omit<LiveOrder, "gameId">) => void;
  /** Answer the pending crunch-time call and play on. */
  crunchChoose: (optionId: string) => void;
  /** The owner's game currently on the live broadcast (hides spoilers elsewhere on screen). */
  liveGameId: string | null;
  setLiveGame: (id: string | null) => void;
  /** Watch mode's TV channel: the whole season as one continuous broadcast. */
  tv: boolean;
  setTv: (on: boolean) => void;
  exportJson: () => string;
  importJson: (raw: string) => void;
  resign: () => void;
  /** The save slot in use (1..SLOT_COUNT). */
  slot: number;
  /** Switch to another slot: the current one is written first, then the other one loads. */
  switchSlot: (slot: number) => Promise<void>;
  /** Empty a slot for good. */
  clearSlot: (slot: number) => Promise<void>;
  /** History mode: the game whose real box score is open. */
  boxView: { year: number; homeId: TeamId; awayId: TeamId; date?: string; round?: string; week: number } | null;
  openBox: (g: { year: number; homeId: string; awayId: string; date?: string; round?: string; week: number }) => void;
  closeBox: () => void;
  /** History mode: follow (or stop following) a club or a player. */
  toggleFollow: (what: { teamId?: TeamId; playerId?: string }) => void;
  /** History mode: call a game (or a season's champion / MVP) before the result is in; null clears it. */
  makeCall: (id: string, pick: string | null) => void;
  /**
   * History mode: step until something happens to who the viewer follows (news about them, or
   * a playoff game of theirs), the season ends, or 60 steps pass. Returns what stopped it.
   */
  historyUntilFollowed: () => string;
}

type Persisted = { save: DynastySave | null };

/*
 * Writes the dynasty to IndexedDB only when the save itself changed (switching tabs or opening a
 * profile doesn't touch it), coalesces bursts of clicks into one write, and serializes once. A
 * late dynasty is tens of megabytes, so writing on every state change made late-game play crawl.
 */
/** Move to the next save, remembering the pre-game save when this step played the owner's game. */
function stepTo(
  set: (p: Partial<GameStore>) => void,
  prev: DynastySave,
  next: DynastySave,
  opts?: AdvanceOpts,
): void {
  const gameId = ownerGameJustPlayed(prev, next);
  if (gameId) set({ save: next, rewind: { gameId, pre: prev, opts } });
  else set({ save: next, rewind: null });
  if (next.realHistory) ensureHistoryBox();
}

/**
 * Saves are written packed (see compactSave) under their own key. An app shell still cached
 * from before packing reads the old key and never sees a layout it can't load; this version
 * reads the packed key first and falls back to the old one, so an existing dynasty carries over.
 */
const PACKED = (name: string) => `${name}:packed`;
const SAVE_NAME = "nfl-rewind-dynasty";

/** Write any save waiting on the debounce now (set by persistStorage). */
let flushPending: () => Promise<void> = () => Promise.resolve();
/** Forget what was last written, so the next save in a freshly loaded slot is written. */
let resetWritten: () => void = () => {};

function persistStorage(): PersistStorage<Persisted> {
  let lastWritten: DynastySave | null | undefined;
  let pending: { name: string; slot: number; value: StorageValue<Persisted> } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing: Promise<void> = Promise.resolve();
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const job = pending;
    pending = null;
    if (!job) return writing;
    writing = writing.then(async () => {
      const save = job.value.state.save;
      // A History mode save is only its place in the record; the league is rebuilt on load.
      const disk = save ? (save.realHistory ? historyCursor(save) : compactSave(save)) : null;
      const payload = JSON.stringify({ ...job.value, state: { save: disk } });
      await dynastyStorage.setItem(PACKED(slotKey(job.name, job.slot)), payload);
      recordSlot(job.slot, save);
    });
    return writing;
  };
  flushPending = flush;
  resetWritten = () => {
    lastWritten = undefined;
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void flush();
    });
    window.addEventListener("pagehide", () => void flush());
  }
  return {
    getItem: async (name) => {
      const key = slotKey(name);
      const raw = (await dynastyStorage.getItem(PACKED(key))) ?? (await dynastyStorage.getItem(key));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StorageValue<Persisted>;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      const save = value.state.save;
      if (save === lastWritten) return;
      lastWritten = save;
      pending = { name, slot: activeSlot(), value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), 350);
    },
    removeItem: async (name) => {
      pending = null;
      lastWritten = undefined;
      await dynastyStorage.removeItem(PACKED(slotKey(name)));
      await dynastyStorage.removeItem(slotKey(name));
    },
  };
}

/** A History mode disk save (its place in the record, plus follows and calls), or undefined for anything else. */
function historyStub(raw: unknown): HistoryCursor | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<HistoryCursor> & { teams?: unknown };
  return r.realHistory && !r.teams ? { realHistory: true, historyStep: r.historyStep ?? 0, follow: r.follow, calls: r.calls } : undefined;
}

/** Load the record and replay it to a saved History mode step. */
async function restoreHistory(cursor: HistoryCursor): Promise<void> {
  useGameStore.setState({ historyLoading: true });
  try {
    setHistoryData(await loadHistoryData());
    const save = replayHistory(cursor.historyStep, cursor);
    // This season's running stat lines come from its box scores.
    await loadBoxSeason(save.year);
    applyLiveLines(save);
    useGameStore.setState({ save, rewind: null });
  } finally {
    useGameStore.setState({ historyLoading: false });
  }
}

/** History mode: make sure the season on screen has its box scores, then fill its running lines. */
function ensureHistoryBox(): void {
  const s = useGameStore.getState().save;
  if (!s?.realHistory || boxSeason(s.year)) return;
  const year = s.year;
  void loadBoxSeason(year).then((games) => {
    const cur = useGameStore.getState().save;
    if (!games || !cur?.realHistory || cur.year !== year) return;
    applyLiveLines(cur);
    useGameStore.setState({ save: { ...cur } });
  });
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      save: null,
      screen: "title",
      tab: "office",
      profileId: null,
      viewTeamId: null,
      pendingTeam: null,
      lastDeskNote: null,
      hasHydrated: false,
      liveGameId: null,
      setLiveGame: (liveGameId) => set({ liveGameId }),
      tv: false,
      setTv: (tv) => set({ tv }),
      setScreen: (screen) => set({ screen }),
      setTab: (tab) => set({ tab }),
      openProfile: (profileId) => set({ profileId }),
      closeProfile: () => set({ profileId: null }),
      openTeam: (viewTeamId) => set({ viewTeamId, profileId: null }),
      closeTeam: () => set({ viewTeamId: null }),
      newGame: (teamId) => {
        const save = createNewGame({ userTeamId: teamId, startingYear: 1966 });
        set({ save, screen: "play", tab: "draft", profileId: null, viewTeamId: null, lastDeskNote: null, rewind: null });
      },
      historyLoading: false,
      newHistory: async () => {
        set({ historyLoading: true });
        try {
          setHistoryData(await loadHistoryData());
          const save = createHistoryGame();
          set({ save, screen: "play", tab: "office", profileId: null, viewTeamId: null, lastDeskNote: null, rewind: null, tv: false });
        } finally {
          set({ historyLoading: false });
        }
      },
      newSandbox: () => {
        // The engine wants a club id for the owner's seat; in a sandbox nothing treats it as anyone's.
        const save = createNewGame({ userTeamId: "gnb", startingYear: 1966, sandbox: true, seed: Date.now() % 2147483647 });
        set({ save, screen: "play", tab: "office", profileId: null, viewTeamId: null, lastDeskNote: null, rewind: null });
      },
      watchSim: (target) => {
        const { save } = get();
        if (!save || save.phase === "complete") return;
        const year = save.year;
        const done = (s: DynastySave) =>
          target === "playoffs"
            ? s.year > year || ["playoffs", "superBowl", "awards", "proBowl", "retirement", "hof", "carousel", "relocation", "expansion"].includes(s.phase)
            : target === "superBowl"
              ? s.year > year || (s.phase === "superBowl" && !!s.superBowl?.played) || s.phase === "awards"
              : s.year > year && s.phase === "draft";
        // The live call belongs to the week it aired; a jump ahead leaves it in the archive.
        set({ save: simUntil(save, done), rewind: null });
      },
      continueGame: () => {
        const { save } = get();
        if (save) set({ screen: "play" });
      },
      step: (opts) => {
        const { save } = get();
        if (!save) return;
        stepTo(set, save, advance(save, opts), opts);
      },
      simWeek: () => {
        const { save } = get();
        if (!save) return;
        if (save.phase === "freeAgency") set({ save: advance(save, { closeFa: true }) });
        else if (save.phase === "complete") return;
        else {
          const opts = { auto: save.phase === "draft" };
          stepTo(set, save, advance(save, opts), opts);
        }
      },
      simTo: (target) => {
        const { save } = get();
        if (!save || (save.phase !== "regular" && save.phase !== "deadline")) return "";
        const seen = new Set(openCalls(save).map((c) => c.id));
        let why = "";
        const done = (s: DynastySave) => {
          if (openCalls(s).some((c) => !seen.has(c.id))) return (why = "call"), true;
          if (target === "deadline" && (s.phase === "deadline" || (s.deadline?.year === s.year && s.deadline.resolved)))
            return (why = "deadline"), true;
          if (s.phase !== "regular" && s.phase !== "deadline") return (why = "playoffs"), true;
          return false;
        };
        set({ save: simUntil(save, done), rewind: null });
        return why;
      },
      crunchChoose: (optionId) => {
        const { save } = get();
        if (!save?.crunch?.situation) return;
        const s = cloneSave(save);
        const sit = s.crunch!.situation!;
        // The broadcast picks up where the owner watched it to when he made the call.
        s.liveResume = { gameId: sit.gameId, index: Math.max(0, (sit.log?.length ?? 1) - 1) };
        s.crunch!.choices.push(optionId);
        s.crunch!.at = [...(s.crunch!.at ?? []), sit.log?.length ?? 0];
        s.crunch!.situation = undefined;
        stepTo(set, s, advance(s));
      },
      rewind: null,
      liveOrder: (o) => {
        const r = get().rewind;
        if (!r) return;
        const base = withOrder(r.pre, { ...o, gameId: r.gameId });
        const next = advance(base, r.opts);
        next.liveResume = { gameId: r.gameId, index: Math.max(0, o.at - 1) };
        // The rewind point stays the same pre-game save, now carrying the orders so far.
        set({ save: next, rewind: { ...r, pre: base } });
      },
      desk: (fn) => {
        const { save } = get();
        if (!save) return;
        const s = cloneSave(save);
        const note = fn(s);
        // A replay from before the game would undo this change, so live calls end here.
        set({ save: s, lastDeskNote: note ?? null, rewind: null });
      },
      exportJson: () => {
        const { save } = get();
        if (!save) return "null";
        return JSON.stringify(save.realHistory ? historyCursor(save) : compactSave(save), null, 2);
      },
      importJson: (raw) => {
        const cursor = historyStub(JSON.parse(raw));
        if (cursor !== undefined) {
          void restoreHistory(cursor).then(() => set({ screen: "play", tab: "office", profileId: null, viewTeamId: null, liveGameId: null, rewind: null }));
          return;
        }
        const save = importDynasty(raw);
        set({ save, screen: "play", tab: "office", profileId: null, viewTeamId: null, liveGameId: null, rewind: null });
      },
      resign: () => set({ screen: "title", profileId: null, viewTeamId: null, tv: false }),
      slot: activeSlot(),
      switchSlot: async (slot) => {
        if (slot === get().slot) return;
        await flushPending();
        setActiveSlot(slot);
        resetWritten();
        set({ slot, save: null, screen: "title", profileId: null, viewTeamId: null, rewind: null, liveGameId: null, tv: false });
        await useGameStore.persist.rehydrate();
      },
      boxView: null,
      openBox: (g) => set({ boxView: { year: g.year, homeId: g.homeId as TeamId, awayId: g.awayId as TeamId, date: g.date, round: g.round, week: g.week } }),
      closeBox: () => set({ boxView: null }),
      toggleFollow: (what) => {
        const { save } = get();
        if (!save?.realHistory) return;
        const next = { ...save };
        toggleFollowIn(next, what);
        set({ save: next });
      },
      makeCall: (id, pick) => {
        const { save } = get();
        if (!save?.realHistory || save.historyGraded?.[id]) return;
        const calls = { ...(save.historyCalls ?? {}) };
        if (pick) calls[id] = pick;
        else delete calls[id];
        set({ save: { ...save, historyCalls: calls } });
      },
      historyUntilFollowed: () => {
        const { save } = get();
        if (!save?.realHistory || save.phase === "complete") return "";
        const f = save.historyFollow ?? { teams: [], players: [] };
        if (!f.teams.length && !f.players.length) return "none";
        const year = save.year;
        let seen = save.news[0]?.id;
        let playoffSeen = save.playoffGames.length + (save.superBowl ? 1 : 0);
        let first = true;
        let why = "";
        // One clone for the whole run (simUntil), checking after every step.
        const s = simUntil(
          save,
          (x) => {
            if (first) return (first = false);
            for (const n of x.news) {
              if (n.id === seen) break;
              if (n.teamIds.some((t) => f.teams.includes(t)) || n.playerIds.some((p) => f.players.includes(p))) {
                why = n.headline;
                break;
              }
            }
            seen = x.news[0]?.id;
            if (why) return true;
            const games = [...x.playoffGames, ...(x.superBowl ? [x.superBowl] : [])];
            const fresh = games.slice(playoffSeen).find((g) => f.teams.includes(g.homeId as TeamId) || f.teams.includes(g.awayId as TeamId));
            playoffSeen = games.length;
            if (fresh) return (why = `${fresh.round ?? "Playoffs"}: ${fresh.awayScore}-${fresh.homeScore}`), true;
            if (x.year > year) return (why = "season"), true;
            return false;
          },
          61,
        );
        set({ save: s, rewind: null });
        ensureHistoryBox();
        return why;
      },
      clearSlot: async (slot) => {
        await flushPending();
        await dynastyStorage.removeItem(PACKED(slotKey(SAVE_NAME, slot)));
        await dynastyStorage.removeItem(slotKey(SAVE_NAME, slot));
        recordSlot(slot, null);
        if (slot === get().slot) {
          resetWritten();
          set({ save: null, screen: "title", rewind: null });
        }
      },
    }),
    {
      name: SAVE_NAME,
      storage: persistStorage(),
      partialize: (s) => ({ save: s.save }),
      onRehydrateStorage: () => (state) => {
        const cursor = historyStub(state?.save);
        if (state && cursor !== undefined) {
          state.save = null;
          void restoreHistory(cursor);
        } else if (state?.save) {
          state.save = hydrateSave(state.save);
          // A dynasty saved before slots existed is slot 1; put it on the slot list.
          if (!slotIndex()[activeSlot()]) recordSlot(activeSlot(), state.save);
        }
        if (state) state.hasHydrated = true;
        queueMicrotask(() => useGameStore.setState({ hasHydrated: true }));
      },
    },
  ),
);
