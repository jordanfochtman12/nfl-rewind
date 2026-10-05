/** The owner's short list when the head-coaching job is open: this winter's hot names. */
import { deskHire, displayName, hotNamesBoard, mentorOf } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn } from "./chrome";

const IN_SEASON = new Set(["preseason", "regular", "deadline", "playoffs", "superBowl"]);
const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

export function HotNames() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const board = hotNamesBoard(save);
  if (!board.length) return null;
  const waiting = IN_SEASON.has(save.phase);
  return (
    <section className="space-y-2 rounded-lg border border-brass/40 bg-black/50 p-3" aria-label="The hot names">
      <p className="text-xs tracking-[0.3em] text-brass">THE HOT NAMES</p>
      {waiting && <p className="text-xs text-muted">Coordinators can't be hired away until their season is over.</p>}
      <ul className="space-y-2">
        {board.map(({ coach: c, teamId, role, unitRank, met }) => {
          const mentor = mentorOf(save, c.name);
          const blocked = waiting && !!teamId;
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-0">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-paper">{c.name}</p>
                <p className="text-xs text-muted">
                  {teamId && role
                    ? `${role === "OC" ? "Offensive" : "Defensive"} coordinator, ${displayName(save.year, teamId)}${unitRank ? ` (${ord(unitRank)} in ${role === "OC" ? "points scored" : "points allowed"})` : ""}`
                    : `Out of work · ${c.careerWins}-${c.careerLosses} as a head coach`}
                  {` · age ${c.age} · off ${c.offense}/def ${c.defense}`}
                  {mentor ? ` · ${mentor.name.split(" ").slice(-1)[0]} tree` : ""}
                  {met.length ? ` · met with ${met.map((id) => displayName(save.year, id)).join(", ")}` : ""}
                </p>
              </div>
              <Btn
                kind="primary"
                className="min-h-10 px-3 text-xs"
                disabled={blocked}
                onClick={() =>
                  desk((s) => {
                    const r = deskHire(s, s.userTeamId, c.id, "HC");
                    return r.ok ? `${c.name} is your head coach.` : r.reason;
                  })
                }
              >
                Hire
              </Btn>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
