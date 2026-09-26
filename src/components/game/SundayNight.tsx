import { deadlineWeek, displayName, gamesInWeek, type GameResult, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, ClubHash, Logo } from "./chrome";
import { FilmStill } from "./Art";
import { GameNight } from "./GameNight";

function slateOf(save: NonNullable<ReturnType<typeof useGameStore.getState>["save"]>): GameResult[] {
  if (save.phase === "playoffs") {
    return save.playoffGames.filter((g) => g.played && g.week === save.week);
  }
  return gamesInWeek(save, save.week).filter((g) => g.played);
}

export function SundayNight() {
  const save = useGameStore((s) => s.save)!;
  const step = useGameStore((s) => s.step);
  const slate = slateOf(save);
  const mine =
    slate.find((g) => g.homeId === save.userTeamId || g.awayId === save.userTeamId) ??
    save.playoffGames.filter((g) => g.played && (g.homeId === save.userTeamId || g.awayId === save.userTeamId)).at(-1);
  const rest = slate.filter((g) => g.id !== mine?.id);
  const playoff = save.phase === "playoffs";
  const nextLabel = playoff
    ? save.playoffGames.some((g) => !g.played)
      ? "Next round"
      : "Continue to the Super Bowl"
    : save.week === deadlineWeek(save.year)
      ? "Open the trading window"
      : "Next week";
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
        <FilmStill still="primetime" veil="full" />
        <div className="relative space-y-3 px-5 py-6">
          <p className="font-display text-xs tracking-[0.4em] text-brass">
            {playoff ? save.weekLabel.toUpperCase() : `WEEK ${save.week}`}
          </p>
          <h2 className="font-display text-4xl sm:text-5xl">{mine ? "Final" : "Bye week"}</h2>
          <p className="max-w-xl text-paper">
            {mine
              ? "Sit with the film. The next Sunday is not on the clock until you say so."
              : "You were off. The league still played. Read the wire, then turn the page."}
          </p>
          <Btn kind="primary" onClick={() => step({})}>
            {nextLabel}
          </Btn>
        </div>
      </section>
      {mine ? <GameNight game={mine} /> : null}
      {rest.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs tracking-[0.25em] text-muted">THE REST OF THE SLATE</p>
          <ul className="mt-3 space-y-2">
            {rest.map((g) => {
              const home = g.homeId as TeamId;
              const away = g.awayId as TeamId;
              return (
                <li key={g.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                  <span className="flex items-center gap-2">
                    <ClubHash id={away} year={save.year} className="h-6 w-1 rounded-full" />
                    <Logo id={away} size={28} year={save.year} />
                    <span className="text-sm">{displayName(save.year, away)}</span>
                  </span>
                  <span className="bug-num shrink-0 whitespace-nowrap text-2xl">
                    {g.awayScore}–{g.homeScore}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm">{displayName(save.year, home)}</span>
                    <Logo id={home} size={28} year={save.year} />
                    <ClubHash id={home} year={save.year} className="h-6 w-1 rounded-full" />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
