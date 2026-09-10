import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  advance,
  createNewGame,
  hydrateSave,
  type DynastySave,
  type TeamId,
} from "@/lib/game/index.ts";

export type Screen = "title" | "select" | "play";
export type Tab = "office" | "roster" | "depth" | "staff" | "standings" | "schedule" | "stats" | "draft" | "history";

interface GameStore {
  save: DynastySave | null;
  screen: Screen;
  tab: Tab;
  pendingTeam: TeamId | null;
  setScreen: (s: Screen) => void;
  setTab: (t: Tab) => void;
  newGame: (teamId: TeamId) => void;
  continueGame: () => void;
  step: (opts?: { userPickPlayerId?: string; auto?: boolean }) => void;
  simWeek: () => void;
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
      pendingTeam: null,
      setScreen: (screen) => set({ screen }),
      setTab: (tab) => set({ tab }),
      newGame: (teamId) => {
        const save = createNewGame({ userTeamId: teamId, startingYear: 1966 });
        set({ save, screen: "play", tab: "draft" });
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
        set({ save: advance(save, { auto: save.phase === "draft" }) });
      },
      exportJson: () => {
        const { save } = get();
        return JSON.stringify(save, null, 2);
      },
      importJson: (raw) => {
        const save = hydrateSave(JSON.parse(raw));
        set({ save, screen: "play" });
      },
      resign: () => set({ screen: "title" }),
    }),
    { name: "nfl-rewind-dynasty" },
  ),
);
