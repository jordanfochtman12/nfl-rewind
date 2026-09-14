import type { DynastyGrade } from "@/lib/game";

function letterTone(letter: string): string {
  if (letter.startsWith("A")) return "text-brass";
  if (letter.startsWith("B")) return "text-good";
  if (letter.startsWith("C")) return "text-paper";
  return "text-brick";
}

function letterGlow(letter: string): string {
  if (letter.startsWith("A")) return "var(--color-brass)";
  if (letter.startsWith("B")) return "var(--color-good)";
  if (letter.startsWith("C")) return "var(--color-chrome)";
  return "var(--color-brick)";
}

export function GradeCard({
  grade,
  compact = false,
}: {
  grade: DynastyGrade;
  compact?: boolean;
}) {
  const tone = letterTone(grade.letter);
  const glow = letterGlow(grade.letter);
  const locked = grade.final;
  return (
    <article className={`overflow-hidden rounded-xl border bg-surface ${locked ? "border-brass/50" : "border-brass/30"}`}>
      <div className="chrome-bar w-full" aria-hidden />
      <div className="p-5">
        <p className="font-display text-xs tracking-[0.4em] text-brass">
          {locked ? "FINAL REPORT CARD" : "THE REWIND SO FAR"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-6">
          <p
            className={`chrome-bevel flex size-24 shrink-0 items-center justify-center rounded-lg bg-black/40 font-display text-6xl leading-none ${tone}`}
            style={{ textShadow: `0 0 22px color-mix(in srgb, ${glow} 55%, transparent)` }}
          >
            {grade.letter}
          </p>
          <div>
            <p className="font-display text-xl">
              {grade.seasons} {grade.seasons === 1 ? "season" : "seasons"} · {grade.rings}{" "}
              {grade.rings === 1 ? "ring" : "rings"}
            </p>
            <p className="stat-glow tabular text-lg text-muted">
              {grade.wins}-{grade.losses}
              {grade.ties ? `-${grade.ties}` : ""} career
            </p>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-paper">{grade.blurb}</p>
        {!compact && (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {grade.lines.map((l) => (
              <li
                key={l.label}
                className="flex justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm"
              >
                <span className="text-muted">{l.label}</span>
                <span className="tabular">
                  {l.value}
                  {l.pts ? <span className="ml-2 text-subtle">{l.pts} pts</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
