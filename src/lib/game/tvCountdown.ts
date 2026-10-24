/** A mobile voice engine must not be able to stall the TV calendar indefinitely. */
export const TV_NARRATION_GRACE_MS = 6_000;

/** Stable key shared by a Record-mode TV card's seen check and its Continue action. */
export function tvMarkKey(key: string, year: number): string {
  return `${key}-${year}`;
}

export function shouldHoldForNarration(waitedMs: number): boolean {
  return waitedMs < TV_NARRATION_GRACE_MS;
}

/** Share one guarded transition between the timer and a manual Continue tap. */
export function createTVAdvance(onAdvance: () => void, cancelPending: () => void): () => void {
  let advanced = false;
  return () => {
    if (advanced) return;
    advanced = true;
    cancelPending();
    onAdvance();
  };
}
