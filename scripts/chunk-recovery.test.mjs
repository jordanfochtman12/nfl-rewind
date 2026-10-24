import { test } from "node:test";
import assert from "node:assert/strict";
import { claimChunkRecovery, clearChunkRecovery, isModuleLoadFailure } from "../src/lib/chunk-recovery.ts";

test("recognizes common browser errors for failed lazy modules", () => {
  for (const reason of [
    new TypeError("Importing a module script failed."),
    new TypeError("Failed to fetch dynamically imported module: /assets/league.js"),
    new Error("Loading chunk 8 failed"),
    new Error("Unable to preload CSS for /assets/game.css"),
  ]) assert.equal(isModuleLoadFailure(reason), true, reason.message);

  assert.equal(isModuleLoadFailure(new Error("Network request for standings data failed")), false);
  assert.equal(isModuleLoadFailure(new Error("A player module is unavailable")), false);
});

test("allows one automatic recovery reload and then exposes the fallback", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };

  assert.equal(claimChunkRecovery(storage, 100), true);
  assert.equal(claimChunkRecovery(storage, 200), false);
  clearChunkRecovery(storage);
  assert.equal(claimChunkRecovery(storage, 300), true, "the visible retry button re-enables a manual recovery attempt");
});

test("does not start an automatic reload loop when session storage is unavailable", () => {
  const blockedStorage = {
    getItem() { throw new Error("Storage is blocked"); },
    setItem() { throw new Error("Storage is blocked"); },
  };
  assert.equal(claimChunkRecovery(blockedStorage), false);
});
