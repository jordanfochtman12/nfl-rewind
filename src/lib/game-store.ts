import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  advance,
  cloneSave,
  createNewGame,
  hydrateSave,
  type AdvanceOpts,
  type DynastySave,
  type TeamId,
} from "@/lib/game/index.ts";

export type Screen = "title" | "select" | "play";
export type Tab =
  | "office"
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
  pendingTeam: TeamId | null;
  lastDeskNote: string | null;
  setScreen: (s: Screen) => void;
  setTab: (t: Tab) => void;
  openProfile: (id: string) => void;
  closeProfile: () => void;
  newGame: (teamId: TeamId) => void;
  continueGame: () => void;
  step: (opts?: AdvanceOpts) => void;
  simWeek: () => void;
  desk: (fn: (s: DynastySave) => string | void) => void;
  exportJson: () => string;
  importJson: (raw: string) => void;
  resign: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      save: null,
      screen: "title",
      tab: "office",
      profileId: null,
      pendingTeam: null,
      lastDeskNote: null,
      setScreen: (screen) => set({ screen }),
      setTab: (tab) => set({ tab }),
      openProfile: (profileId) => set({ profileId }),
      closeProfile: () => set({ profileId: null }),
      newGame: (teamId) => {
        const save = createNewGame({ userTeamId: teamId, startingYear: 1966 });
        set({ save, screen: "play", tab: "draft", profileId: null, lastDeskNote: null });
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
        return JSON.stringify(save, null, 2);
      },
      importJson: (raw) => {
        const save = hydrateSave(JSON.parse(raw));
        set({ save, screen: "play" });
      },
      resign: () => set({ screen: "title", profileId: null }),
    }),
    { name: "nfl-rewind-dynasty" },
  ),
);
