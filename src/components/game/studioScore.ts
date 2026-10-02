/** Original network-sports score: 32 bars, four contrasting sections, no borrowed melody. */
export const NETWORK_BPM = 124;
export function scoreStep(step: number) {
  const bar = Math.floor(step / 8) % 32,
    beat = step % 8,
    section = Math.floor(bar / 8);
  const roots = [45, 45, 41, 43, 45, 48, 41, 40];
  const root = roots[bar % 8]!;
  const minor = bar % 8 !== 2 && bar % 8 !== 3 && bar % 8 !== 5 && bar % 8 !== 6;
  const chord = [root + 12, root + (minor ? 15 : 16), root + 19, root + 24];
  const phrases = [
    [69, null, 72, 76, null, 74, 72, null, 67, null, 71, 74, 76, null, 74, 71],
    [76, 74, null, 72, 69, null, 67, 69, 72, null, 74, 76, 79, null, 76, null],
    [null, 64, null, 67, 69, null, 72, null, 71, null, 67, null, 64, 67, null, null],
    [81, null, 76, 79, 76, null, 74, 72, 74, 76, null, 79, 81, null, 76, null],
  ];
  return {
    bar,
    beat,
    section,
    root,
    chord,
    melody: phrases[section]![step % 16],
    brass: section === 2 ? beat === 0 : [0, 3, 6].includes(beat),
    fill: bar % 8 === 7 && beat >= 4,
    crash: bar % 8 === 0 && beat === 0,
  };
}
