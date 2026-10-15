/**
 * Viewer preferences: kept on this device (not in the dynasty save), read by the broadcasts,
 * watch mode and TV mode as their starting settings.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AutoSpeed = "slow" | "normal" | "fast";

export interface Settings {
  /** Studio shows, the whip-around and TV host read aloud. */
  narration: boolean;
  /** The live game's play-by-play booth starts with its voices on. */
  boothVoices: boolean;
  /** Studio theme music and stadium sound. */
  music: boolean;
  /** A preferred device voice for the lead voice ("" = best available). */
  voiceName: string;
  /** Watch mode auto-play pace. */
  autoSpeed: AutoSpeed;
  /** Auto-play pauses for the draft, the Super Bowl, awards night and the Hall of Fame. */
  stopForBigNights: boolean;
  /** TV mode: air the studio recap after each week. */
  tvStudio: boolean;
  /** TV mode: break in with bulletins for big news. */
  tvBulletins: boolean;
  /** Whip-around starting speed: 0 = 1x, 1 = 2x, 2 = 4x. */
  whipSpeed: 0 | 1 | 2;
  /** Score bugs and graphics styled to the decade on screen. */
  eraStyle: boolean;
  /** Tours already shown, by id. */
  toursSeen: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  narration: true,
  boothVoices: true,
  music: true,
  voiceName: "",
  autoSpeed: "normal",
  stopForBigNights: true,
  tvStudio: true,
  tvBulletins: true,
  whipSpeed: 0,
  eraStyle: true,
  toursSeen: [],
};

interface SettingsStore extends Settings {
  set: (p: Partial<Settings>) => void;
  reset: () => void;
  markTour: (id: string) => void;
  resetTours: () => void;
}

// localStorage can be missing or throw (private mode, previews); fall back to memory.
const memory = new Map<string, string>();
const safeStorage = {
  getItem: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return memory.get(k) ?? null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      memory.set(k, v);
    }
  },
  removeItem: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      memory.delete(k);
    }
  },
};

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (p) => set(p),
      reset: () => set({ ...DEFAULT_SETTINGS }),
      markTour: (id) => set((s) => (s.toursSeen.includes(id) ? s : { toursSeen: [...s.toursSeen, id] })),
      resetTours: () => set({ toursSeen: [] }),
    }),
    {
      name: "nfl-rewind-settings",
      storage: createJSONStorage(() => safeStorage),
      // v1: the booth and the draft podium speak by default now that every voice is a studio
      // voice; a device that saved the old default (off) gets the new one once.
      // v2: every voice and sound on (narration, the booth, music and stadium sound, the TV
      // studio), once, for devices that saved older choices.
      // v3: the studio voices are gone (every voice is the device's own): their settings go too.
      version: 3,
      migrate: (old, from) => {
        const { hdVoices: _hd, phoneVoice: _phone, hdCast: _cast, ...s } = (old ?? {}) as Partial<Settings> & { hdVoices?: unknown; phoneVoice?: unknown; hdCast?: unknown };
        if (from < 2) return { ...s, narration: true, boothVoices: true, music: true, tvStudio: true } as SettingsStore;
        return s as SettingsStore;
      },
      partialize: (s) => {
        const { set: _set, reset: _reset, markTour: _markTour, resetTours: _resetTours, ...rest } = s;
        return rest;
      },
    },
  ),
);

/** A snapshot for code outside React (initial state of a component). */
export const settingsNow = (): Settings => useSettings.getState();
