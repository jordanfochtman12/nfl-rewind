import { useEffect, useState } from "react";
import { footballSpeech } from "@/lib/game/footballSpeech";
import { cancelSpeech, prefetchLines, speakLine, type Speaker } from "@/lib/voice/studioVoice";

export interface DeskLine {
  text: string;
  who: Speaker;
  rate?: number;
}

/**
 * A desk segment read aloud, line by line, in the studio voices: the halftime report, the
 * postgame podium. `at` is the line on the air (-1 before the first), `done` once the last
 * line ends (or right away when the voices are off, so whatever waits on it never stalls).
 */
export function useDeskReading(lines: DeskLine[], on: boolean, year: number): { at: number; done: boolean } {
  const [at, setAt] = useState(-1);
  const sig = lines.map((l) => l.text).join("|");
  useEffect(() => setAt(on && lines.length ? 0 : lines.length), [sig, on, lines.length]);
  useEffect(() => {
    if (!on || at < 0 || at >= lines.length) return;
    let live = true;
    const l = lines[at]!;
    const u = new SpeechSynthesisUtterance(footballSpeech(l.text, year));
    u.rate = l.rate ?? 1;
    const next = () => live && setAt((k) => (k === at ? k + 1 : k));
    u.onend = next;
    u.onerror = next;
    speakLine(u, l.who);
    prefetchLines(lines.slice(at + 1, at + 3).map((x) => ({ text: footballSpeech(x.text, year), who: x.who, rate: x.rate })));
    return () => {
      live = false;
      cancelSpeech();
    };
    // `sig` stands in for the lines themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, on, sig, year]);
  return { at, done: !on || at >= lines.length };
}
