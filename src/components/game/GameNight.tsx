import { useMemo, useState } from "react";
import {
  clubInk,
  displayName,
  formatClock,
  type BoxPlayer,
  type GameResult,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { PlayerLink } from "./PlayerProfile";

function StatBar({
  label,
  awayVal,
  homeVal,
  awayLabel,
  homeLabel,
  awayColor,
  homeColor,
}: {
  label: string;
  awayVal: number;
  homeVal: number;
  awayLabel: string;
  homeLabel: string;
  awayColor: string;
  homeColor: string;
}) {
  const total = awayVal + homeVal;
  const awayPct = total > 0 ? (awayVal / total) * 100 : 50;
  return (
    <div className="rounded-md border border-line bg-surface-2 p-3">
      <div className="flex items-center justify-between text-xs tracking-widest text-muted">
        <span className="tabular text-fg">{awayLabel}</span>
        <span>{label}</span>
        <span className="tabular text-fg">{homeLabel}</span>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-black/40">
        <div style={{ width: `${awayPct}%`, background: awayColor }} />
        <div style={{ width: `${100 - awayPct}%`, background: homeColor }} />
      </div>
    </div>
  );
}

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
  const awayInk = clubInk(away, save.year);
  const homeInk = clubInk(home, save.year);

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
          <p className="flex flex-wrap items-center gap-2 text-xs tracking-[0.3em] text-muted">
            <span>
              {game.phase === "superBowl" ? "SUPER BOWL" : game.phase === "playoffs" ? game.round ?? "PLAYOFFS" : `WEEK ${game.week}`}
              {game.rivalry ? " · RIVALRY" : ""}
              {game.ot ? " · OT" : ""}
            </span>
            {game.night ? (
              <span className="chrome-bevel rounded-sm bg-gradient-to-b from-club to-[color-mix(in_srgb,var(--color-club)_70%,black)] px-2 py-0.5 text-[10px] font-semibold text-club-fg">
                PRIMETIME
              </span>
            ) : null}
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

      <div className="chrome-bevel overflow-hidden rounded-lg">
        <div className="grid sm:grid-cols-[1fr_auto_1fr]">
          <div
            className="flex items-center gap-3 px-4 py-4"
            style={{
              background: `linear-gradient(115deg, ${awayInk.primary}, color-mix(in srgb, ${awayInk.primary} 45%, black) 85%)`,
              color: awayInk.onPrimary,
            }}
          >
            <Logo id={away} size={48} year={save.year} />
            <div>
              <p className="text-sm opacity-80">{displayName(save.year, away)}</p>
              <p className="stat-glow tabular font-display text-4xl">{game.played ? game.awayScore : "—"}</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 bg-studio px-4 py-3">
            <p className="font-display text-xs tracking-[0.4em] text-brass">{game.played ? "FINAL" : "UPCOMING"}</p>
            {game.played && game.homeQ && game.awayQ && (
              <table className="text-xs">
                <thead className="tracking-widest text-muted">
                  <tr>
                    <th className="px-1.5 py-0.5" />
                    {Array.from({ length: qs }, (_, i) => (
                      <th key={i} className="px-1.5 py-0.5">
                        {i === 4 ? "OT" : i + 1}
                      </th>
                    ))}
                    <th className="px-1.5 py-0.5 text-brass">F</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-1.5 text-left uppercase text-muted">{away}</td>
                    {(game.awayQ ?? []).map((n, i) => (
                      <td key={i} className="tabular px-1.5">
                        {n}
                      </td>
                    ))}
                    <td className="tabular px-1.5 font-display text-brass">{game.awayScore}</td>
                  </tr>
                  <tr>
                    <td className="px-1.5 text-left uppercase text-muted">{home}</td>
                    {(game.homeQ ?? []).map((n, i) => (
                      <td key={i} className="tabular px-1.5">
                        {n}
                      </td>
                    ))}
                    <td className="tabular px-1.5 font-display text-brass">{game.homeScore}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div
            className="flex items-center justify-end gap-3 px-4 py-4 text-right"
            style={{
              background: `linear-gradient(245deg, ${homeInk.primary}, color-mix(in srgb, ${homeInk.primary} 45%, black) 85%)`,
              color: homeInk.onPrimary,
            }}
          >
            <div>
              <p className="text-sm opacity-80">{displayName(save.year, home)}</p>
              <p className="stat-glow tabular font-display text-4xl">{game.played ? game.homeScore : "—"}</p>
            </div>
            <Logo id={home} size={48} year={save.year} />
          </div>
        </div>
      </div>

      {mvp && (
        <div className="chrome-bevel flex items-center justify-between gap-3 rounded-md bg-gradient-to-r from-brass/15 to-transparent px-4 py-3">
          <span className="text-xs tracking-[0.25em] text-brass">PLAYER OF THE GAME</span>
          <span className="font-display text-lg">
            <PlayerLink player={mvp} className="inline min-h-0" /> <span className="text-sm text-muted">{mvp.pos}</span>
          </span>
        </div>
      )}

      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {game.awayTot != null && game.homeTot != null && (
          <StatBar
            label="Total yards"
            awayVal={game.awayTot}
            homeVal={game.homeTot}
            awayLabel={String(game.awayTot)}
            homeLabel={String(game.homeTot)}
            awayColor={awayInk.primary}
            homeColor={homeInk.primary}
          />
        )}
        {game.awayPoss != null && game.homePoss != null && (
          <StatBar
            label="Time of poss"
            awayVal={game.awayPoss}
            homeVal={game.homePoss}
            awayLabel={fmtPoss(game.awayPoss)}
            homeLabel={fmtPoss(game.homePoss)}
            awayColor={awayInk.primary}
            homeColor={homeInk.primary}
          />
        )}
        {game.awayFd != null && game.homeFd != null && (
          <StatBar
            label="First downs"
            awayVal={game.awayFd}
            homeVal={game.homeFd}
            awayLabel={String(game.awayFd)}
            homeLabel={String(game.homeFd)}
            awayColor={awayInk.primary}
            homeColor={homeInk.primary}
          />
        )}
        <StatBar
          label="Turnovers"
          awayVal={game.awayTo ?? 0}
          homeVal={game.homeTo ?? 0}
          awayLabel={String(game.awayTo ?? 0)}
          homeLabel={String(game.homeTo ?? 0)}
          awayColor={awayInk.primary}
          homeColor={homeInk.primary}
        />
        <div className="rounded-md border border-line bg-surface-2 p-3">
          <dt className="text-xs tracking-widest text-muted">3rd down</dt>
          <dd className="tabular mt-1">
            {third(game.away3rd, game.away3rdAtt)} / {third(game.home3rd, game.home3rdAtt)}
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface-2 p-3">
          <dt className="text-xs tracking-widest text-muted">Red zone</dt>
          <dd className="tabular mt-1">
            {third(game.awayRz, game.awayRzAtt)} / {third(game.homeRz, game.homeRzAtt)}
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface-2 p-3">
          <dt className="text-xs tracking-widest text-muted">Penalties</dt>
          <dd className="tabular mt-1">
            {game.awayPen ?? 0}-{game.awayPenYds ?? 0} / {game.homePen ?? 0}-{game.homePenYds ?? 0}
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
