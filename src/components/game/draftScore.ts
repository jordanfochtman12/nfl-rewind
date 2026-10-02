/** Original "On the Clock": a restrained 32-bar sports-draft bed with a rising final section. */
export const DRAFT_BPM = 104;
export function draftScoreStep(step: number) {
  const bar = Math.floor(step / 8) % 32,
    beat = step % 8,
    section = Math.floor(bar / 8);
  const roots = [38, 38, 34, 34, 41, 41, 36, 33];
  const root = roots[bar % 8]!;
  const minor = bar % 8 === 0 || bar % 8 === 1;
  const chord = [root + 12, root + (minor ? 15 : 16), root + 19, root + 26];
  const phrases = [
    [62, null, null, 69, null, null, 65, null, 60, null, null, 67, null, 64, null, null],
    [69, null, 65, null, 72, null, 69, null, 67, null, 64, null, 69, null, 72, null],
    [null, null, 62, null, null, null, 65, null, null, null, 60, null, 64, null, null, null],
    [74, null, 77, null, 81, 77, null, 74, 72, null, 76, null, 79, null, 76, null],
  ];
  return {
    bar,
    beat,
    section,
    root,
    chord,
    melody: phrases[section]![step % 16],
    brass: section === 2 ? beat === 0 : [0, 6].includes(beat),
    fill: bar % 8 === 7 && beat === 7,
    crash: bar % 8 === 0 && beat === 0,
  };
}
