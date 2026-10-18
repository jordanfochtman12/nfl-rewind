/**
 * Settings: how the broadcasts sound, how watch mode and TV mode run, how the screen looks,
 * and how much room the dynasty takes on this device. Preferences stay on this device.
 */
import { useEffect, useState } from "react";
import { formatBytes, saveByteLength } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { dynastyStorage } from "@/lib/save-idb";
import { DEFAULT_SETTINGS, useSettings, type AutoSpeed } from "@/lib/settings-store";
import { Btn } from "./chrome";
import { useOfflineStatus } from "../offline-status";
import { cancelSpeech, hasPremiumDeviceVoice, isPhone, speakLine } from "@/lib/voice/speech";
import { findVoice, PHONE_VOICE, voiceChoices, voiceKey, voiceLabel } from "@/lib/voiceCast";

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 border-b border-line py-2 last:border-0">
      <span>
        <span className="block text-sm text-paper">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--color-brass,#c4a574)]" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-line py-2 last:border-0">
      <span className="text-sm text-paper">{label}</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} className={`bx-chip min-h-9 px-3 text-xs ${value === o.v ? "bx-chip-on" : ""}`} onClick={() => onChange(o.v)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface px-4 py-2">
      <p className="pt-2 text-xs tracking-[0.25em] text-muted">{title}</p>
      {children}
    </section>
  );
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const st = useSettings();
  const save = useGameStore((s) => s.save);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [usage, setUsage] = useState<{ used?: number; quota?: number }>({});
  const [note, setNote] = useState("");
  const [hasOld, setHasOld] = useState(false);
  const size = save ? saveByteLength(save) : 0;
  const offline = useOfflineStatus();

  useEffect(() => {
    if ("speechSynthesis" in window) {
      const load = () => setVoices(window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)));
      load();
      window.speechSynthesis.addEventListener("voiceschanged", load);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
    }
  }, []);
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsage({ used: e.usage, quota: e.quota })).catch(() => undefined);
    void Promise.all([dynastyStorage.getItem("nfl-rewind-dynasty"), dynastyStorage.getItem("nfl-rewind-dynasty:packed")]).then(([old, packed]) => setHasOld(!!old && !!packed));
  }, [note]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const removeOld = async () => {
    await dynastyStorage.removeItem("nfl-rewind-dynasty");
    setNote("Removed the copy saved by the older version of the app.");
  };
  const trimFilm = () => {
    const s = useGameStore.getState().save;
    if (!s) return;
    // Keep the scores, box scores and every featured broadcast; drop other play-by-play logs.
    const drop = <G extends { log?: unknown; featured?: boolean; played: boolean }>(g: G): G => (g.played && g.log && !g.featured ? { ...g, log: undefined } : g);
    useGameStore.setState({ save: { ...s, schedule: s.schedule.map(drop), playoffGames: s.playoffGames.map(drop) } });
    setNote("Cleared the play-by-play film of games that weren't broadcast.");
  };
  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    cancelSpeech();
    const u = new SpeechSynthesisUtterance("Welcome to the broadcast. Here's how I'll sound.");
    const v = findVoice(voices, st.voiceName);
    if (v) u.voice = v;
    speakLine(u);
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/60" role="dialog" aria-modal="true" aria-label="Settings" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-bg p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-3xl">Settings</h2>
          <Btn onClick={onClose}>Done</Btn>
        </div>
        <div className="space-y-4">
          <Section title="SOUND AND VOICES">
            <Toggle label="Narration" hint="Studio shows, the whip-around and the TV host read aloud." on={st.narration} onChange={(v) => st.set({ narration: v })} />
            {isPhone() && (
              <p className="rounded-md border border-line px-3 py-2 text-xs text-muted">
                {hasPremiumDeviceVoice()
                  ? "This phone has a Premium voice installed, so the broadcast reads with it."
                  : "On an iPhone, Safari only gives web apps Apple's built-in voices, so voices you download (like Tom or Nathan Enhanced) can't be picked by name. Try Lead voice → Phone's voice: the phone may then read with the voice set under Spoken Content."}
              </p>
            )}
            <Toggle label="Booth voices in live games and the draft" hint="The play-by-play and color men call each snap, and the podium reads every pick." on={st.boothVoices} onChange={(v) => st.set({ boothVoices: v })} />
            <Toggle label="Music and stadium sound" on={st.music} onChange={(v) => st.set({ music: v })} />
            <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-sm text-paper">Lead voice</span>
              <div className="flex gap-2">
                <select aria-label="Lead voice" className="min-h-10 max-w-[13rem] rounded-md border border-line bg-surface-2 px-2 text-sm text-fg" value={st.voiceName} onChange={(e) => st.set({ voiceName: e.target.value })}>
                  <option value="">Best available</option>
                  <option value={PHONE_VOICE}>Phone's voice (Spoken Content)</option>
                  {voiceChoices(voices).map((v) => (
                    <option key={voiceKey(v)} value={voiceKey(v)}>
                      {voiceLabel(v)}
                    </option>
                  ))}
                </select>
                <Btn className="min-h-10 px-3 text-xs" onClick={speak}>
                  Test
                </Btn>
              </div>
            </div>
          </Section>
          <Section title="WATCH MODE">
            <Choice<AutoSpeed> label="Auto-play speed" value={st.autoSpeed} options={[{ v: "slow", label: "Slow" }, { v: "normal", label: "Normal" }, { v: "fast", label: "Fast" }]} onChange={(v) => st.set({ autoSpeed: v })} />
            <Toggle label="Stop for the big nights" hint="Draft, Super Bowl, awards night, Hall of Fame." on={st.stopForBigNights} onChange={(v) => st.set({ stopForBigNights: v })} />
          </Section>
          <Section title="TV MODE">
            <Toggle label="Weekly studio recap" hint="Off: go straight from the whip-around to the next week." on={st.tvStudio} onChange={(v) => st.set({ tvStudio: v })} />
            <Toggle label="Breaking-news bulletins" on={st.tvBulletins} onChange={(v) => st.set({ tvBulletins: v })} />
            <Choice<0 | 1 | 2> label="Whip-around speed" value={st.whipSpeed} options={[{ v: 0, label: "1x" }, { v: 1, label: "2x" }, { v: 2, label: "4x" }]} onChange={(v) => st.set({ whipSpeed: v })} />
          </Section>
          <Section title="LOOK">
            <Toggle label="Era broadcast style" hint="Score bugs and graphics that change with the decade." on={st.eraStyle} onChange={(v) => st.set({ eraStyle: v })} />
          </Section>
          <Section title="STORAGE ON THIS DEVICE">
            <p className="py-2 text-sm text-paper">
              This dynasty: <span className="tabular">{save ? formatBytes(size) : "none loaded"}</span>
              {usage.used != null && (
                <span className="block text-xs text-muted">
                  Site storage in use: {formatBytes(usage.used)}
                  {usage.quota ? ` of ${formatBytes(usage.quota)} available` : ""}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2 pb-3">
              {save && (
                <Btn className="min-h-10 px-3 text-xs" onClick={trimFilm}>
                  Clear non-broadcast film
                </Btn>
              )}
              {hasOld && (
                <Btn className="min-h-10 px-3 text-xs" onClick={() => void removeOld()}>
                  Remove old-format copy
                </Btn>
              )}
            </div>
            <p className="pb-3 text-xs text-muted">
              {offline === "ready"
                ? "Offline play is ready: the game opens on this device with no connection. Add it to your home screen to launch it like an app."
                : offline === "preparing"
                  ? "Getting offline play ready. Keep the page open a moment while online."
                  : offline === "dev"
                    ? "Offline play turns on in the published app."
                    : "This browser can't keep the game for offline play."}
            </p>
            {note && <p className="pb-3 text-xs text-brass">{note}</p>}
          </Section>
          <Section title="HELP">
            <div className="flex flex-wrap gap-2 py-3">
              <Btn
                className="min-h-10 px-3 text-xs"
                onClick={() => {
                  st.resetTours();
                  onClose();
                }}
              >
                Replay the tour
              </Btn>
              <Btn className="min-h-10 px-3 text-xs" onClick={() => st.set({ ...DEFAULT_SETTINGS, toursSeen: st.toursSeen })}>
                Reset settings
              </Btn>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
