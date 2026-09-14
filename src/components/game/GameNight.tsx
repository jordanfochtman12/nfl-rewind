import { useMemo, useState } from "react";
import {
  displayName,
  formatClock,
  playerName,
  type BoxPlayer,
  type GameResult,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo, ClubHash } from "./chrome";
import { PlayerLink } from "./PlayerProfile";

function fmtPoss(sec?: number): string {
  if (!sec) return "—";
  return formatClock(sec);
}

function third(made?: number, att?: number): string {
  if (!att) return "—";
  return `${made ?? 0}/${att}`;
}

function wxLine(g: GameResult): string {
  const bits = [
    g.stadium,
    g.neutral ? "neutral site" : null,
    g.indoor ? "indoor" : g.surface,
    g.weather && g.weather !== "clear" ? g.weather : null,
    g.attendance ? `${g.attendance.toLocaleString()} in the house` : null,
    g.filmNote && !g.stadium ? g.filmNote : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

function BoxTable({
  title,
  rows,
  cols,
}: {
  title: string;
  rows: { name: React.ReactNode; cells: (string | number)[] }[];
  cols: string[];
}) {
  if (!rows.length) return null;
  return (
    <section>
      <h4 className="mb-2 text-xs tracking-[0.2em] text-muted">{title}</h4>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Player</th>
              {cols.map((c) => (
                <th key={c} className="px-3 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-3 py-2">{r.name}</td>
                {r.cells.map((c, j) => (
                  <td key={j} className="tabular px-3 py-2">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function nameOf(save: NonNullable<ReturnType<typeof useGameStore.getState>["save"]>, id: string) {
  const p = save.players[id];
  if (!p) return id;
  return <PlayerLink player={p} className="inline min-h-0" />;
}

function sortBox(box: BoxPlayer[], key: Exclude<keyof BoxPlayer, "playerId">): BoxPlayer[] {
  return box
    .filter((b) => Number(b[key] ?? 0) > 0)
    .slice()
    .sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0));
}

export function GameNight({ game, onClose }: { game: GameResult; onClose?: () => void }) {
  const save = useGameStore((s) => s.save)!;
  const home = game.homeId as TeamId;
  const away = game.awayId as TeamId;
  const [side, setSide] = useState<TeamId>(home);
  const box = side === home ? (game.boxHome ?? []) : (game.boxAway ?? []);
  const mvp = game.mvpPlayerId ? save.players[game.mvpPlayerId] : undefined;

  const passing = useMemo(
    () =>
      sortBox(box, "passAtt").map((b) => ({
        name: nameOf(save, b.playerId),
        cells: [
          `${b.passCmp ?? 0}/${b.passAtt ?? 0}`,
          b.passYds ?? 0,
          b.passTd ?? 0,
          b.passInt ?? 0,
          b.sacksThrown ?? 0,
        ],
      })),
    [box, save],
  );
  const rushing = useMemo(
    () =>
      sortBox(box, "rushAtt").map((b) => ({
        name: nameOf(save, b.playerId),
        cells: [b.rushAtt ?? 0, b.rushYds ?? 0, b.rushTd ?? 0],
      })),
    [box, save],
  );
  const receiving = useMemo(() => {
    const seen = new Set<string>();
    return box
      .filter((b) => (b.rec ?? 0) + (b.targets ?? 0) > 0)
      .slice()
      .sort((a, b) => (b.recYds ?? 0) - (a.recYds ?? 0))
      .filter((b) => {
        if (seen.has(b.playerId)) return false;
        seen.add(b.playerId);
        return true;
      })
      .map((b) => ({
        name: nameOf(save, b.playerId),
        cells: [b.targets ?? 0, b.rec ?? 0, b.recYds ?? 0, b.recTd ?? 0],
      }));
  }, [box, save]);
  const defense = useMemo(
    () =>
      box
        .filter((b) => (b.tackles ?? 0) + (b.sacks ?? 0) + (b.ints ?? 0) + (b.tfl ?? 0) + (b.pd ?? 0) > 0)
        .slice()
        .sort((a, b) => (b.tackles ?? 0) - (a.tackles ?? 0))
        .slice(0, 10)
        .map((b) => ({
          name: nameOf(save, b.playerId),
          cells: [b.tackles ?? 0, b.tfl ?? 0, b.sacks ?? 0, b.ints ?? 0, b.pd ?? 0, b.ff ?? 0],
        })),
    [box, save],
  );

  const qs = Math.max(game.homeQ?.length ?? 4, game.awayQ?.length ?? 4, 4);

  return (
    <article className="space-y-6 rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.3em] text-muted">
            {game.phase === "superBowl" ? "SUPER BOWL" : game.phase === "playoffs" ? game.round ?? "PLAYOFFS" : `WEEK ${game.week}`}
            {game.night ? " · NIGHT" : ""}
            {game.rivalry ? " · RIVALRY" : ""}
            {game.ot ? " · OT" : ""}
          </p>
          <h3 className="mt-1 font-display text-2xl tracking-wide">
            {displayName(save.year, away)} at {displayName(save.year, home)}
          </h3>
          <p className="mt-1 text-sm text-muted">{wxLine(game)}</p>
          {game.filmNote ? <p className="mt-1 text-sm text-brass">{game.filmNote}</p> : null}
        </div>
        {onClose ? (
          <button type="button" className="min-h-11 rounded-md border border-line px-3 text-sm text-muted" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>

      <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center gap-3">
          <ClubHash id={away} year={save.year} className="h-12 w-1 rounded-full" />
          <Logo id={away} size={48} year={save.year} />
          <div>
            <p className="text-sm text-muted">{displayName(save.year, away)}</p>
            <p className="tabular font-display text-4xl">{game.played ? game.awayScore : "—"}</p>
          </div>
        </div>
        <p className="hidden text-center text-xs tracking-[0.4em] text-brass sm:block">FINAL</p>
        <div className="flex items-center justify-end gap-3">
          <div className="text-right">
            <p className="text-sm text-muted">{displayName(save.year, home)}</p>
            <p className="tabular font-display text-4xl">{game.played ? game.homeScore : "—"}</p>
          </div>
          <Logo id={home} size={48} year={save.year} />
          <ClubHash id={home} year={save.year} className="h-12 w-1 rounded-full" />
        </div>
      </div>

      {game.played && game.homeQ && game.awayQ && (
        <div className="overflow-x-auto">
          <table className="mx-auto text-sm">
            <thead className="text-xs tracking-widest text-muted">
              <tr>
                <th className="px-2 py-1" />
                {Array.from({ length: qs }, (_, i) => (
                  <th key={i} className="px-2 py-1">
                    {i === 4 ? "OT" : i + 1}
                  </th>
                ))}
                <th className="px-2 py-1">F</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 text-left uppercase">{away}</td>
                {(game.awayQ ?? []).map((n, i) => (
                  <td key={i} className="tabular px-2">
                    {n}
                  </td>
                ))}
                <td className="tabular px-2 font-display">{game.awayScore}</td>
              </tr>
              <tr>
                <td className="px-2 text-left uppercase">{home}</td>
                {(game.homeQ ?? []).map((n, i) => (
                  <td key={i} className="tabular px-2">
                    {n}
                  </td>
                ))}
                <td className="tabular px-2 font-display">{game.homeScore}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-md border border-line bg-surface-2 p-3">
          <dt className="text-xs tracking-widest text-muted">Total yards</dt>
          <dd className="tabular mt-1">
            {game.awayTot ?? "—"} / {game.homeTot ?? "—"}
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface-2 p-3">
          <dt className="text-xs tracking-widest text-muted">Time of poss</dt>
          <dd className="tabular mt-1">
            {fmtPoss(game.awayPoss)} / {fmtPoss(game.homePoss)}
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface-2 p-3">
          <dt className="text-xs tracking-widest text-muted">3rd down</dt>
          <dd className="tabular mt-1">
            {third(game.away3rd, game.away3rdAtt)} / {third(game.home3rd, game.home3rdAtt)}
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface-2 p-3">
          <dt className="text-xs tracking-widest text-muted">Penalties</dt>
          <dd className="tabular mt-1">
            {game.awayPen ?? 0}-{game.awayPenYds ?? 0} / {game.homePen ?? 0}-{game.homePenYds ?? 0}
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface-2 p-3">
          <dt className="text-xs tracking-widest text-muted">First downs</dt>
          <dd className="tabular mt-1">
            {game.awayFd ?? "—"} / {game.homeFd ?? "—"}
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface-2 p-3">
          <dt className="text-xs tracking-widest text-muted">Turnovers</dt>
          <dd className="tabular mt-1">
            {game.awayTo ?? "—"} / {game.homeTo ?? "—"}
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface-2 p-3">
          <dt className="text-xs tracking-widest text-muted">Red zone</dt>
          <dd className="tabular mt-1">
            {third(game.awayRz, game.awayRzAtt)} / {third(game.homeRz, game.homeRzAtt)}
          </dd>
        </div>
        {(game.homeSafeties || game.awaySafeties) ? (
          <div className="rounded-md border border-line bg-surface-2 p-3">
            <dt className="text-xs tracking-widest text-muted">Safeties</dt>
            <dd className="tabular mt-1">
              {game.awaySafeties ?? 0} / {game.homeSafeties ?? 0}
            </dd>
          </div>
        ) : null}
        <div className="col-span-2 rounded-md border border-line bg-surface-2 p-3 sm:col-span-2">
          <dt className="text-xs tracking-widest text-muted">MVP</dt>
          <dd className="mt-1">{mvp ? playerName(mvp) : "—"}</dd>
        </div>
      </dl>

      {game.highlights && game.highlights.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs tracking-[0.2em] text-muted">The film</h4>
          <ul className="space-y-1 text-sm text-paper">
            {game.highlights.map((h, i) => (
              <li key={i} className="border-l-2 border-brass/40 pl-3">
                {h}
              </li>
            ))}
          </ul>
        </section>
      )}

      {game.drives && game.drives.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs tracking-[0.2em] text-muted">Drives</h4>
          <ol className="space-y-1 text-sm">
            {game.drives.slice(0, 18).map((d, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 rounded-md border border-line px-3 py-2">
                <span className="uppercase text-muted">{d.teamId}</span>
                <span>
                  {d.plays} pl · {d.yards} yds · {d.result}
                </span>
                <span className="tabular text-muted">{d.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex gap-2">
        {([away, home] as TeamId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setSide(id)}
            className={`min-h-11 rounded-md border px-3 text-xs tracking-widest ${
              side === id ? "border-brass bg-brass/20 text-brass" : "border-line bg-surface-2 text-muted"
            }`}
          >
            {displayName(save.year, id)}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        <BoxTable title="Passing" cols={["Cmp/Att", "Yds", "TD", "INT", "Sk"]} rows={passing} />
        <BoxTable title="Rushing" cols={["Att", "Yds", "TD"]} rows={rushing} />
        <BoxTable title="Receiving" cols={["Tgt", "Rec", "Yds", "TD"]} rows={receiving} />
        <BoxTable title="Defense" cols={["Tkl", "TFL", "Sk", "INT", "PD", "FF"]} rows={defense} />
      </div>
    </article>
  );
}
