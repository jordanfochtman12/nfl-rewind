import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

test("historical identities, old saves and fractional field display", () => {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--test", "src/lib/game/identity.test.ts"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
