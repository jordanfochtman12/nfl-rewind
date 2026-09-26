import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
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
  exportJson: () => string;
  importJson: (raw: string) => void;
  resign: () => void;
}

function persistStorage() {
  return {
    getItem: (name: string) => dynastyStorage.getItem(name),
    removeItem: (name: string) => dynastyStorage.removeItem(name),
    setItem: async (name: string, value: string) => {
      try {
        const parsed = JSON.parse(value) as { state?: { save?: DynastySave | null } };
        if (parsed?.state?.save) parsed.state.save = compactSave(parsed.state.save);
        await dynastyStorage.setItem(name, JSON.stringify(parsed));
      } catch {
        await dynastyStorage.setItem(name, value);
      }
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
      storage: createJSONStorage(persistStorage),
      partialize: (s) => ({ save: s.save }),
      onRehydrateStorage: () => (state) => {
        if (state?.save) state.save = hydrateSave(state.save);
        if (state) state.hasHydrated = true;
        queueMicrotask(() => useGameStore.setState({ hasHydrated: true }));
      },
    },
  ),
);
