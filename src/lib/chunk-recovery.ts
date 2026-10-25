const RECOVERY_KEY = "rewind:chunk-recovery";
type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function sessionRecoveryStorage(): RecoveryStorage | undefined {
  try {
    return sessionStorage;
  } catch {
    return undefined;
  }
}

/** Browser-specific module fetch failures that can strand a tab on stale app code. */
export function isModuleLoadFailure(reason: unknown): boolean {
  const message = typeof reason === "string"
    ? reason
    : reason && typeof reason === "object" && "message" in reason
      ? String((reason as { message?: unknown }).message ?? "")
      : String(reason ?? "");

  return /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|failed to load module script|loading chunk\s+[^\s]+\s+failed|unable to preload css/i.test(message);
}

/** Permit one automatic reload per tab session; a failed retry should show the app fallback. */
export function claimChunkRecovery(storage = sessionRecoveryStorage(), now = Date.now()): boolean {
  if (!storage) return false;
  try {
    if (storage.getItem(RECOVERY_KEY)) return false;
    storage.setItem(RECOVERY_KEY, String(now));
    return true;
  } catch {
    // Without session storage, avoid an automatic reload loop and show the recovery screen.
    return false;
  }
}

export function clearChunkRecovery(storage = sessionRecoveryStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(RECOVERY_KEY);
  } catch {
    // A manual reload is still useful if storage is disabled.
  }
}
