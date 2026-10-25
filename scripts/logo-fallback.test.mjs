import { test } from "node:test";
import assert from "node:assert/strict";
import { logoSrc } from "../src/lib/game/data/logos.ts";

test("logo lookup keeps shared screens renderable for incomplete saves", () => {
  assert.equal(logoSrc(1966, "pit"), "/logos/pit.svg");
  const fallback = logoSrc(1966, undefined);
  assert.match(fallback, /^data:image\/svg\+xml,/);
  assert.match(decodeURIComponent(fallback.split(",")[1] ?? ""), /NFL/);
});
