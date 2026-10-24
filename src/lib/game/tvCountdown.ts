/** A mobile voice engine must not be able to stall the TV calendar indefinitely. */
export const TV_NARRATION_GRACE_MS = 6_000;

export function shouldHoldForNarration(waitedMs: number): boolean {
  return waitedMs < TV_NARRATION_GRACE_MS;
}
