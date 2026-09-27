import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import {
  advance,
  cloneSave,
  compactSave,
  createNewGame,
  hydrateSave,
  type AdvanceOpts,
  type DynastySave,
  type TeamId,
} from "@/lib/game/index.ts";
import { dynastyStorage } from "@/lib/save-idb.ts";

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
  | "history";

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
  continueGame: () => void;
  step: (opts?: AdvanceOpts) => void;
  simWeek: () => void;
  desk: (fn: (s: DynastySave) => string | void) => void;
  /** Answer the pending crunch-time call and play on. */
  crunchChoose: (optionId: string) => void;
  /** The owner's game currently on the live broadcast (hides spoilers elsewhere on screen). */
  liveGameId: string | null;
  setLiveGame: (id: string | null) => void;
  exportJson: () => string;
  importJson: (raw: string) => void;
  resign: () => void;
}

type Persisted = { save: DynastySave | null };

/*
 * Writes the dynasty to IndexedDB only when the save itself changed (switching tabs or opening a
 * profile doesn't touch it), coalesces bursts of clicks into one write, and serializes once. A
 * late dynasty is tens of megabytes, so writing on every state change made late-game play crawl.
 */
function persistStorage(): PersistStorage<Persisted> {
  let lastWritten: DynastySave | null | undefined;
  let pending: { name: string; value: StorageValue<Persisted> } | null = null;
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
      const payload = JSON.stringify({ ...job.value, state: { save: save ? compactSave(save) : null } });
      await dynastyStorage.setItem(job.name, payload);
    });
    return writing;
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void flush();
    });
    window.addEventListener("pagehide", () => void flush());
  }
  return {
    getItem: async (name) => {
      const raw = await dynastyStorage.getItem(name);
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
      pending = { name, value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), 350);
    },
    removeItem: async (name) => {
      pending = null;
      lastWritten = undefined;
      await dynastyStorage.removeItem(name);
    },
  };
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
      setScreen: (screen) => set({ screen }),
      setTab: (tab) => set({ tab }),
      openProfile: (profileId) => set({ profileId }),
      closeProfile: () => set({ profileId: null }),
      openTeam: (viewTeamId) => set({ viewTeamId }),
      closeTeam: () => set({ viewTeamId: null }),
      newGame: (teamId) => {
        const save = createNewGame({ userTeamId: teamId, startingYear: 1966 });
        set({ save, screen: "play", tab: "draft", profileId: null, viewTeamId: null, lastDeskNote: null });
      },
      continueGame: () => {
        const { save } = get();
        if (save) set({ screen: "play" });
      },
      step: (opts) => {
        const { save } = get();
        if (!save) return;
        set({ save: advance(save, opts) });
      },
      simWeek: () => {
        const { save } = get();
        if (!save) return;
        if (save.phase === "freeAgency") set({ save: advance(save, { closeFa: true }) });
        else if (save.phase === "complete") return;
        else set({ save: advance(save, { auto: save.phase === "draft" }) });
      },
      crunchChoose: (optionId) => {
        const { save } = get();
        if (!save?.crunch?.situation) return;
        const s = cloneSave(save);
        const sit = s.crunch!.situation!;
        // The broadcast picks up where the owner watched it to when he made the call.
        s.liveResume = { gameId: sit.gameId, index: Math.max(0, (sit.log?.length ?? 1) - 1) };
        s.crunch!.choices.push(optionId);
        s.crunch!.situation = undefined;
        set({ save: advance(s) });
      },
      desk: (fn) => {
        const { save } = get();
        if (!save) return;
        const s = cloneSave(save);
        const note = fn(s);
        set({ save: s, lastDeskNote: note ?? null });
      },
      exportJson: () => {
        const { save } = get();
        if (!save) return "null";
        return JSON.stringify(compactSave(save), null, 2);
      },
      importJson: (raw) => {
        const save = hydrateSave(JSON.parse(raw));
        set({ save, screen: "play" });
      },
      resign: () => set({ screen: "title", profileId: null, viewTeamId: null }),
    }),
    {
      name: "nfl-rewind-dynasty",
      storage: persistStorage(),
      partialize: (s) => ({ save: s.save }),
      onRehydrateStorage: () => (state) => {
        if (state?.save) state.save = hydrateSave(state.save);
        if (state) state.hasHydrated = true;
        queueMicrotask(() => useGameStore.setState({ hasHydrated: true }));
      },
    },
  ),
);
