import { footballSpeech } from "@/lib/game/footballSpeech";
import { useGameStore } from "@/lib/game-store";

/** Starts the channel from a tap, which also unlocks speech on phones. */
export function startTv(year: number): void {
  try {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(footballSpeech(`Welcome to Rewind TV. The ${year} season, all of it, starts now.`, year)));
    }
  } catch {
    /* no speech on this device */
  }
  useGameStore.getState().setTv(true);
}
