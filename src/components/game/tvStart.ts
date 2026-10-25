import { footballSpeech } from "@/lib/game/footballSpeech";
import { useGameStore } from "@/lib/game-store";
import { cancelSpeech, speakLine } from "@/lib/voice/speech";

/** Starts the channel from a tap, which also unlocks speech on phones. */
export function startTv(year: number): void {
  try {
    if ("speechSynthesis" in window) {
      cancelSpeech();
      speakLine(new SpeechSynthesisUtterance(footballSpeech(`Welcome to Rewind TV. The ${year} season, all of it, starts now.`, year)));
    }
  } catch {
    /* no speech on this device */
  }
  useGameStore.getState().setTv(true);
}
