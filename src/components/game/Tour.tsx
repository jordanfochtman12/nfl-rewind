/**
 * First-time walkthroughs. Each tour runs once (remembered on this device) and can be replayed
 * from Settings. A step can point at a control marked with data-tour="..."; the control is
 * scrolled into view and outlined while the step is up.
 */
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings-store";
import { Btn } from "./chrome";

export interface TourStep {
  title: string;
  body: string;
  /** data-tour id of the control this step is about. */
  target?: string;
}

export const WATCH_TOUR: TourStep[] = [
  { title: "Watch history", body: "Every club is on autopilot with real rosters, real draft classes and real coaches. You just watch the league write its own history, with real results next to every score." },
  { title: "Move the calendar", body: "This button takes the next step: the next pick, the next week, the next round. Its label always says what it will do.", target: "watch-next" },
  { title: "Sit back", body: "Auto-play runs the calendar for you and stops for the big nights. The sim buttons jump ahead to the playoffs, the Super Bowl or next year's draft.", target: "watch-auto" },
  { title: "TV mode", body: "The whole season as one broadcast: preview show, every Sunday's whip-around, studio recaps, the Super Bowl live, awards night and the draft. Great on a phone you can prop up.", target: "watch-tv" },
  { title: "Everything else", body: "Standings, stats, the league's record books, team histories and the Hall of Fame are in these tabs.", target: "tabs" },
  { title: "Make it yours", body: "Voices, music, auto-play speed, TV options, the era broadcast look and storage are in Settings. You can replay this tour from there.", target: "settings" },
];

export const TV_TOUR: TourStep[] = [
  { title: "Rewind TV", body: "The channel runs itself. Each segment hands off to the next: pregame, the whip-around, the studio recap, then the next week." },
  { title: "Hold", body: "Hold pauses the countdowns between segments, so you can read the storylines and races at your own pace.", target: "tv-hold" },
  { title: "Skip", body: "Skip ends the current segment and moves on.", target: "tv-skip" },
  { title: "The whip-around", body: "Every game plays at once. The channel cuts to scores, turnovers and red-zone trips; tap any game on the scoreboard to stay with it." },
  { title: "Step out any time", body: "Exit TV takes you back to the desk. Your place in the season is saved.", target: "tv-exit" },
];

function targetOf(id?: string): HTMLElement | null {
  if (!id) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${id}"]`);
  if (!el) return null;
  return getComputedStyle(el).display === "contents" ? (el.firstElementChild as HTMLElement | null) : el;
}

/** Shows `steps` once per device under `id`, unless already seen. */
export function Tour({ id, steps, delay = 600 }: { id: string; steps: TourStep[]; delay?: number }) {
  const seen = useSettings((s) => s.toursSeen.includes(id));
  const markTour = useSettings((s) => s.markTour);
  const [i, setI] = useState(-1);

  useEffect(() => {
    if (seen) {
      setI(-1);
      return;
    }
    const t = setTimeout(() => setI(0), delay);
    return () => clearTimeout(t);
  }, [seen, delay]);

  const step = i >= 0 ? steps[i] : undefined;
  useEffect(() => {
    const el = targetOf(step?.target);
    if (!el) return;
    el.classList.add("tour-focus");
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return () => el.classList.remove("tour-focus");
  }, [step?.target]);

  if (!step) return null;
  const done = () => {
    setI(-1);
    markTour(id);
  };
  const last = i === steps.length - 1;
  return (
    <div className="tour-card fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-md rounded-xl border border-brass/60 bg-[#0b0e15f2] p-4 shadow-2xl backdrop-blur" role="dialog" aria-label="Tour" aria-live="polite">
      <p className="text-[10px] tracking-[0.3em] text-brass">
        TOUR · {i + 1} / {steps.length}
      </p>
      <h3 className="mt-1 font-display text-2xl">{step.title}</h3>
      <p className="mt-1 text-sm text-paper">{step.body}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button type="button" className="min-h-10 text-xs text-muted underline" onClick={done}>
          Skip tour
        </button>
        <div className="flex gap-2">
          {i > 0 && (
            <Btn className="min-h-10 px-3 text-xs" onClick={() => setI(i - 1)}>
              Back
            </Btn>
          )}
          <Btn kind="primary" className="min-h-10 px-4 text-xs" onClick={() => (last ? done() : setI(i + 1))}>
            {last ? "Got it" : "Next"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
