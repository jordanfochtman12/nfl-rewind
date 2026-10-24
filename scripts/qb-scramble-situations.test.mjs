import { test } from "node:test";
import assert from "node:assert/strict";
import { designedQbRunYardsAdjustment, scrambleSituationMultiplier, scrambleSituationVolumeNormalizer, scrambleYardsAdjustment } from "../src/lib/game/qbRushing.ts";

test("scramble decisions respond to route depth, conversion pressure, and pocket stress", () => {
  const longThirdDown = scrambleSituationMultiplier("deep", 3, 10, 0.12, 0.06, 2024);
  const quickShortYardage = scrambleSituationMultiplier("short", 3, 2, 0.03, 0.06, 2024);
  const screen = scrambleSituationMultiplier("screen", 1, 10, 0.06, 0.06, 2024);
  const intermediate = scrambleSituationMultiplier("med", 1, 10, 0.06, 0.06, 2024);

  assert.ok(longThirdDown > quickShortYardage * 2);
  assert.ok(screen < intermediate);
});

test("scramble pressure response stays bounded when sack estimates are extreme", () => {
  assert.equal(scrambleSituationMultiplier("med", 2, 5, 0.5, 0.06, 2024), 1.25);
  assert.equal(scrambleSituationMultiplier("med", 2, 5, 0, 0.06, 2024), 0.85);
});

test("season-calibrated scramble volume and gains preserve earlier-era controls", () => {
  assert.equal(scrambleSituationMultiplier("deep", 3, 10, 0.12, 0.06, 2016), 1);
  assert.equal(scrambleSituationVolumeNormalizer(2016), 1);
  assert.equal(scrambleSituationVolumeNormalizer(2017), 1.1, "2017's broken-play carries receive a measured volume lift");
  assert.equal(scrambleSituationVolumeNormalizer(2018), 1.25, "2018's broken-play carries receive a measured volume lift");
  assert.equal(scrambleSituationVolumeNormalizer(2019), 1.25, "2019's broken-play carries receive a measured volume lift");
  assert.equal(scrambleSituationVolumeNormalizer(2020), 1);
  assert.equal(scrambleSituationVolumeNormalizer(2021), 1);
  assert.equal(scrambleSituationVolumeNormalizer(2022), 1.1);
  assert.equal(scrambleSituationVolumeNormalizer(2023), 1.1);
  assert.equal(scrambleSituationVolumeNormalizer(2024), 1.1);
  assert.equal(scrambleYardsAdjustment(2017), 0.55);
  assert.equal(scrambleYardsAdjustment(2018), 0.45);
  assert.equal(scrambleYardsAdjustment(2019), 0.25);
  assert.equal(designedQbRunYardsAdjustment(2016), 0, "the close 2016 control keeps its existing curve");
  assert.equal(designedQbRunYardsAdjustment(2017), 0.55);
  assert.equal(designedQbRunYardsAdjustment(2018), 0.45);
  assert.equal(designedQbRunYardsAdjustment(2019), 0.25);
  assert.equal(designedQbRunYardsAdjustment(2020), 0, "modern designed runs retain their own calibration");
  assert.equal(scrambleYardsAdjustment(2020), -0.05);
  assert.equal(scrambleYardsAdjustment(2021), -0.25);
  assert.equal(scrambleYardsAdjustment(2022), -0.4);
  assert.equal(scrambleYardsAdjustment(2023), -0.55);
  assert.equal(scrambleYardsAdjustment(2024), 0);
});
