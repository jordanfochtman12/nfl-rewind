import type { PlayLog } from "./types.ts";

/** Spoken phrasing stays anchored to recorded results; no invented pressure or routes. */
export function boothLine(play: PlayLog, index: number): string {
  const text = play.text;
  const pass = text.match(/^(.+?) to (.+?) for (-?\d+) yards?\./);
  const run = text.match(/^(.+?) runs for (-?\d+) yards?\./);
  if (play.tag === "td") {
    if (!pass && !run) return text;
    const call = pass ? `${pass[1]} finds ${pass[2]}.` : run ? `${run[1]} takes it in.` : text;
    return `${call} Touchdown!${text.includes("kick is good") ? " And the extra point is good." : ""}`;
  }
  if (play.tag === "to") return `Turnover! ${text}`;
  if (pass) {
    const open =
      index % 2
        ? `${pass[1]}. Complete to ${pass[2]}, for ${pass[3]} yards.`
        : `${pass[1]} finds ${pass[2]}. A gain of ${pass[3]}.`;
    return `${open}${play.snap && play.snap.yards >= play.togo ? " That moves the chains." : ""}`;
  }
  if (run)
    return index % 2
      ? `${run[1]} with the carry. Picks up ${run[2]} yards.`
      : `${run[1]} on the ground, for ${run[2]}.${play.snap && play.snap.yards >= play.togo ? " First down." : ""}`;
  return text.replace(/ — /g, ". ").replace(/\bQ([1-4])\b/g, "quarter $1");
}
