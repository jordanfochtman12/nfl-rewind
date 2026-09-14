import type { DynastyGrade } from "@/lib/game";

function letterTone(letter: string): string {
  if (letter.startsWith("A")) return "text-brass";
  if (letter.startsWith("B")) return "text-paper";
  if (letter.startsWith("C")) return "text-muted";
  return "text-brick";
}

export function GradeCard({
  grade,
  compact = false,
}: {
  grade: DynastyGrade;
  compact?: boolean;
}) {
  const tone = letterTone(grade.letter);
  const locked = grade.final;
  return (
    <article className={`rounded-xl border bg-surface p-5 ${locked ? "border-brass/50" : "border-brass/30"}`}>
      <p className="text-xs tracking-[0.3em] text-brass">
        {locked ? "FINAL REPORT CARD" : "THE REWIND SO FAR"}
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-6">
        <p className={`font-display text-7xl leading-none ${tone}`}>{grade.letter}</p>
        <div>
          <p className="font-display text-xl">
            {grade.seasons} {grade.seasons === 1 ? "season" : "seasons"} · {grade.rings}{" "}
            {grade.rings === 1 ? "ring" : "rings"}
          </p>
          <p className="tabular text-muted">
            {grade.wins}-{grade.losses}
            {grade.ties ? `-${grade.ties}` : ""} career
          </p>
        </div>
      </div>
      <p className="mt-3 max-w-2xl text-paper">{grade.blurb}</p>
      {!compact && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {grade.lines.map((l) => (
            <li key={l.label} className="flex justify-between gap-3 border-b border-line py-1 text-sm">
              <span className="text-muted">{l.label}</span>
              <span className="tabular">
                {l.value}
                {l.pts ? <span className="ml-2 text-subtle">{l.pts} pts</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
