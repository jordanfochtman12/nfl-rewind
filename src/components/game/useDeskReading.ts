import { useEffect, useState } from "react";
import { footballSpeech } from "@/lib/game/footballSpeech";
import { castVoices } from "@/lib/voiceCast";
import { cancelSpeech, speakLine, type Speaker } from "@/lib/voice/speech";

export interface DeskLine {
  text: string;
  who: Speaker;
  rate?: number;
}

/**
 * A desk segment read aloud, line by line, each person in a voice of their own: the halftime report, the
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
    // Each person on the desk keeps one device voice for the whole segment.
    const all = "speechSynthesis" in window ? window.speechSynthesis.getVoices() : [];
    const people = [...new Map(lines.map((x) => [x.who.key, x.who])).values()];
    const c = castVoices(all, people.map((w) => ({ key: w.key, gender: w.gender ?? "m" }))).get(l.who.key);
    if (c?.voice) u.voice = c.voice;
    u.pitch = c?.pitch ?? 1;
    u.rate = (l.rate ?? 1) * (c?.rate ?? 1);
    const next = () => live && setAt((k) => (k === at ? k + 1 : k));
    u.onend = next;
    u.onerror = next;
    speakLine(u);
    return () => {
      live = false;
      cancelSpeech();
    };
    // `sig` stands in for the lines themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, on, sig, year]);
  return { at, done: !on || at >= lines.length };
}
