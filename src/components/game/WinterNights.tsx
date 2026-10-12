import {
  availableCoaches,
  careerTotals,
  clubSeasons,
  deskHire,
  retiredNumbers,
  signatureClub,
  displayName,
  END_YEAR,
  relocationsFor,
  followHistory,
  stayHome,
  type Coach,
  type Player,
  type TeamId,
  playbookOf,
  awardBallots,
  playerGraphic,
  playerName,
  type AwardBallots,
} from "@/lib/game";
import { useMemo, useState } from "react";
import { NightShow, ShowGraphicView } from "./ShowKit";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { FilmStill } from "./Art";
import { PlayerLink } from "./PlayerProfile";
import { CoachChips } from "./KitChips";
import { HonorButtons, InductionCard } from "./Legacy";
import { HotNames } from "./HotNames";

function Continue({ label }: { label: string }) {
  const step = useGameStore((s) => s.step);
  return (
    <Btn kind="primary" onClick={() => step({})}>
      {label}
    </Btn>
  );
}

function Name({ id }: { id?: string }) {
  const save = useGameStore((s) => s.save)!;
  const p = id ? save.players[id] : undefined;
  if (!p) return <span>—</span>;
  return <PlayerLink player={p} className="inline min-h-0" />;
}

function ours(save: { userTeamId: TeamId; sandbox?: boolean; players: Record<string, Player> }, id?: string): boolean {
  const p = id ? save.players[id] : undefined;
  return !save.sandbox && !!p && (p.teamId === save.userTeamId || p.userTied);
}

export function AwardsNight() {
  const save = useGameStore((s) => s.save)!;
  const a = save.awards;
  if (!a) return null;
  const rows: [string, string | undefined][] = [
    ["Most Valuable Player", a.mvp],
    ["Offensive Player of the Year", a.offPoy],
    ["Defensive Player of the Year", a.defPoy],
    [a.year < 1967 ? "Rookie of the Year" : "Offensive Rookie", a.oroy],
    ["Defensive Rookie", a.droy],
    ["Comeback Player", a.cpoty],
  ];
  // Awards that didn't exist yet (OPOY 1972, DPOY 1971, the split rookie awards 1967, Comeback
  // 1972) aren't announced in those years.
  const shown = rows.filter(([, id]) => !!id);
  const coach = a.coy ? save.coaches[a.coy] : undefined;
  const allPro = (a.allPro ?? []).map((id) => save.players[id]).filter(Boolean) as Player[];
  const yours = rows.filter(([, id]) => ours(save, id));
  return (
    <NightShow
      id={`awards-${save.year}`}
      show="THE WRITERS' DINNER"
      title={`${save.year} Awards Night`}
      sub="Six envelopes. One room."
      year={save.year}
      ticker={save.news.filter((n) => n.year === save.year).slice(0, 10).map((n) => n.headline.toUpperCase())}
      tickerLabel="THE SEASON"
    >
    <article className="relative overflow-hidden rounded-xl border border-brass/40 bg-studio">
      <FilmStill still="office" veil="full" />
      <div className="relative space-y-6 px-5 py-8 sm:px-8">
        <p className="font-display text-xs tracking-[0.4em] text-brass">{save.year} WRITERS’ DINNER</p>
        <h2 className="font-display text-4xl sm:text-6xl">Awards night</h2>
        <p className="max-w-xl text-paper">
          {yours.length
            ? `The room stands up for your club ${yours.length === 1 ? "once" : `${yours.length} times`}.`
            : "Nobody from your club takes a trophy home. The writers had other names."}
        </p>
        <AwardsCeremony shown={shown} coach={coach ? { name: coach.name, teamId: coach.teamId ?? undefined } : undefined} />
        {allPro.length > 0 && (
          <section>
            <p className="text-xs tracking-[0.3em] text-muted">ALL-PRO</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {allPro.map((p) => (
                <li
                  key={p.id}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    p.teamId === save.userTeamId ? "border-brass text-brass" : "border-line text-paper"
                  }`}
                >
                  <PlayerLink player={p} className="inline min-h-0" />{" "}
                  <span className="text-muted">{p.pos}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <Continue label="On to the Pro Bowl" />
      </div>
    </article>
    </NightShow>
  );
}

const BALLOT_KEY: Record<string, keyof AwardBallots> = {
  "Most Valuable Player": "mvp",
  "Offensive Player of the Year": "offPoy",
  "Defensive Player of the Year": "defPoy",
  "Rookie of the Year": "oroy",
  "Offensive Rookie": "oroy",
  "Defensive Rookie": "droy",
  "Comeback Player": "cpoty",
};

/** The envelopes: finalists on the board, then the winner and his season on the screen. */
function AwardsCeremony({ shown, coach }: { shown: [string, string | undefined][]; coach?: { name: string; teamId?: TeamId } }) {
  const save = useGameStore((s) => s.save)!;
  const [open, setOpen] = useState(0);
  const ballots = useMemo(() => (save.sandbox || save.realHistory ? undefined : awardBallots(save, { top: 3 })), [save]);
  const all = open >= shown.length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs tracking-[0.3em] text-muted">
          {all ? "EVERY ENVELOPE OPENED" : `ENVELOPE ${open + 1} OF ${shown.length}`}
        </p>
        {!all && (
          <button type="button" className="bx-chip min-h-9 px-3 text-xs" onClick={() => setOpen(shown.length)}>
            Open them all
          </button>
        )}
      </div>
      <ol className="space-y-3">
        {shown.map(([label, id], i) => {
          const p = id ? save.players[id] : undefined;
          const key = BALLOT_KEY[label];
          const finalists = (key && ballots ? (ballots[key] as Player[]) : []).filter((x) => x.id !== id).slice(0, 2);
          const pool = p ? [p, ...finalists].sort((x, y) => (hashName(x.id + label) % 7) - (hashName(y.id + label) % 7)) : finalists;
          const revealed = i < open;
          const live = i === open;
          const card = p && revealed ? playerGraphic(save, save.year, p.id, label.toUpperCase()) : undefined;
          return (
            <li key={label} className={`rounded-lg border px-4 py-3 ${ours(save, id) && revealed ? "border-brass/60 bg-brass/10" : live ? "border-brass/40 bg-black/60" : "border-line bg-black/45"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs tracking-[0.25em] text-muted">{label}</span>
                {revealed ? (
                  <span className="font-display text-xl">
                    <Name id={id} />
                    {p && p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof" ? <span className="ml-2 text-sm text-muted">{displayName(save.year, p.teamId)}</span> : null}
                  </span>
                ) : live ? (
                  <button type="button" className="bx-primary min-h-10 px-4" onClick={() => setOpen(i + 1)}>
                    Open the envelope
                  </button>
                ) : (
                  <span className="text-sm text-muted">Sealed</span>
                )}
              </div>
              {!revealed && live && pool.length > 1 && (
                <p className="mt-2 text-sm text-muted">
                  The finalists: {pool.map((x) => `${playerName(x)} (${x.pos})`).join(", ")}
                </p>
              )}
              {card && (
                <div className="mt-3">
                  <ShowGraphicView g={card} year={save.year} />
                </div>
              )}
            </li>
          );
        })}
        {coach && (
          <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-black/50 px-4 py-3">
            <span className="text-xs tracking-[0.25em] text-muted">Coach of the Year</span>
            {all ? (
              <span className="font-display text-xl">
                {coach.name}
                {coach.teamId ? <span className="ml-2 text-sm text-muted">{displayName(save.year, coach.teamId)}</span> : null}
              </span>
            ) : (
              <span className="text-sm text-muted">After the players</span>
            )}
          </li>
        )}
      </ol>
    </div>
  );
}

/** A stable shuffle for the finalists, so the winner isn't always read first. */
function hashName(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function ProBowlNight() {
  const save = useGameStore((s) => s.save)!;
  const g = save.proBowl;
  if (!g) return null;
  const homeLabel = String(g.homeId).toUpperCase();
  const awayLabel = String(g.awayId).toUpperCase();
  const home = (g.homeRoster ?? []).map((id) => save.players[id]).filter(Boolean) as Player[];
  const away = (g.awayRoster ?? []).map((id) => save.players[id]).filter(Boolean) as Player[];
  const mvp = g.mvpPlayerId ? save.players[g.mvpPlayerId] : undefined;
  const yours = save.sandbox ? [] : [...home, ...away].filter((p) => p.teamId === save.userTeamId || p.userTied);
  const Col = ({ title, score, rows }: { title: string; score: number; rows: Player[] }) => (
    <section className="rounded-lg border border-line bg-black/55 p-4">
      <p className="text-xs tracking-[0.3em] text-brass">{title}</p>
      <p className="tabular font-display text-5xl">{score}</p>
      <ol className="mt-3 space-y-1 text-sm">
        {rows.slice(0, 14).map((p) => (
          <li key={p.id} className={!save.sandbox && p.teamId === save.userTeamId ? "text-brass" : ""}>
            <PlayerLink player={p} className="inline min-h-0" />{" "}
            <span className="text-muted">{p.pos}</span>
          </li>
        ))}
      </ol>
    </section>
  );
  const mvpCard = mvp ? playerGraphic(save, save.year, mvp.id, "PRO BOWL MVP", `${homeLabel} ${g.homeScore}, ${awayLabel} ${g.awayScore}`) : undefined;
  return (
    <NightShow
      id={`probowl-${save.year}`}
      show="THE PRO BOWL"
      title={`${awayLabel} ${g.awayScore}, ${homeLabel} ${g.homeScore}`}
      sub={g.stadium ?? "All-star game"}
      year={save.year}
      ticker={[...home, ...away].slice(0, 24).map((p) => `${playerName(p).toUpperCase()} · ${p.pos}`)}
      tickerLabel="THE ROSTERS"
    >
    <article className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
      <FilmStill still="superbowl" veil="full" />
      <div className="relative space-y-6 px-5 py-8 sm:px-8">
        <p className="font-display text-xs tracking-[0.4em] text-brass">{save.year} PRO BOWL</p>
        <h2 className="font-display text-4xl sm:text-5xl">{g.stadium ?? "All-star game"}</h2>
        <p className="max-w-xl text-paper">
          {save.sandbox
            ? "The best of the season, one more time, in the sun."
            : yours.length
              ? `${yours.length} from ${displayName(save.year, save.userTeamId)} in the game.`
              : "Your club sent nobody. The leis still go on."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Col title={homeLabel} score={g.homeScore} rows={home} />
          <Col title={awayLabel} score={g.awayScore} rows={away} />
        </div>
        {mvp && (
          <p className="font-display text-2xl text-brass">
            MVP · <PlayerLink player={mvp} className="inline min-h-0 font-display text-2xl text-brass" />
          </p>
        )}
        {mvpCard && <ShowGraphicView g={mvpCard} year={save.year} />}
        <Continue label="Retirement ceremony" />
      </div>
    </article>
    </NightShow>
  );
}

function retireCard(p: Player, blurb: string, mine: boolean, honors = false) {
  const c = careerTotals(p);
  const line = [c.passYds && `${c.passYds} pass`, c.rushYds && `${c.rushYds} rush`, c.rec && `${c.rec} rec`]
    .filter(Boolean)
    .join(" · ");
  return (
    <li
      key={p.id}
      className={`rounded-lg border px-4 py-3 ${mine ? "border-brass/50 bg-brass/10" : "border-line bg-black/50"}`}
    >
      <p className="font-display text-xl">
        <PlayerLink player={p} className="inline min-h-0" />{" "}
        <span className="text-sm text-muted">
          {p.pos} · {p.age}
        </span>
      </p>
      <p className="mt-1 text-sm text-paper">{blurb || line || `Peak ${p.peakOvr}.`}</p>
      {honors && <HonorButtons player={p} />}
    </li>
  );
}

function coachCard(c: Coach, mine: boolean, year: number) {
  const rec = `${c.careerWins}-${c.careerLosses}${c.careerTies ? `-${c.careerTies}` : ""}`;
  return (
    <li
      key={c.id}
      className={`rounded-lg border px-4 py-3 ${mine ? "border-brass/50 bg-brass/10" : "border-line bg-black/50"}`}
    >
      <p className="font-display text-xl">
        {c.name}{" "}
        <span className="text-sm text-muted">
          {c.role} · {c.age}
        </span>
      </p>
      <p className="mt-1 text-sm text-paper">
        {rec}
        {c.careerTitles ? ` · ${c.careerTitles} titles` : ""} ·{" "}
        {playbookOf(c, year) ? `${playbookOf(c, year)!.offense} / ${playbookOf(c, year)!.defense}` : `${c.offScheme}/${c.defScheme}`}
      </p>
      <div className="mt-2">
        <CoachChips coach={c} compact />
      </div>
    </li>
  );
}

export function RetirementNight() {
  const save = useGameStore((s) => s.save)!;
  const pending = save.pendingRetirees
    .map((id) => save.players[id])
    .filter(Boolean) as Player[];
  const mine = save.sandbox ? [] : pending.filter((p) => p.teamId === save.userTeamId || p.userTied);
  const rest = pending.filter((p) => !mine.includes(p));
  const coaches = (save.pendingCoachRetirees ?? [])
    .map((id) => save.coaches[id])
    .filter(Boolean) as Coach[];
  const myCoach = save.sandbox ? [] : coaches.filter((c) => c.teamId === save.userTeamId);
  const restCoach = coaches.filter((c) => !myCoach.includes(c));
  return (
    <article className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
      <FilmStill still="helmet" veil="full" />
      <div className="relative space-y-6 px-5 py-8 sm:px-8">
        <p className="font-display text-xs tracking-[0.4em] text-brass">THIS WINTER</p>
        <h2 className="font-display text-4xl sm:text-6xl">They hang them up</h2>
        <p className="max-w-xl text-paper">
          {mine.length || myCoach.length
            ? `${mine.length + myCoach.length === 1 ? "One of yours" : `${mine.length + myCoach.length} of yours`} walks away. The building feels it.`
            : "Nobody on your roster is done. The league still loses names."}
        </p>
        {mine.length > 0 && (
          <section>
            <p className="text-xs tracking-[0.3em] text-brass">YOUR CLUB</p>
            <ul className="mt-2 space-y-2">{mine.map((p) => retireCard(p, "", true, true))}</ul>
          </section>
        )}
        {myCoach.length > 0 && (
          <section>
            <p className="text-xs tracking-[0.3em] text-brass">YOUR SIDELINE</p>
            <ul className="mt-2 space-y-2">{myCoach.map((c) => coachCard(c, true, save.year))}</ul>
          </section>
        )}
        {rest.length > 0 && (
          <section>
            <p className="text-xs tracking-[0.3em] text-muted">AROUND THE LEAGUE</p>
            <ul className="mt-2 space-y-2">{rest.slice(0, 10).map((p) => retireCard(p, "", false))}</ul>
          </section>
        )}
        {restCoach.length > 0 && (
          <section>
            <p className="text-xs tracking-[0.3em] text-muted">COACHES</p>
            <ul className="mt-2 space-y-2">{restCoach.slice(0, 6).map((c) => coachCard(c, false, save.year))}</ul>
          </section>
        )}
        {pending.length === 0 && coaches.length === 0 && <p className="text-muted">The league keeps its veterans one more year.</p>}
        <Continue label="Canton" />
      </div>
    </article>
  );
}

export function HofNight() {
  const save = useGameStore((s) => s.save)!;
  const klass = save.pendingHof.map((id) => save.players[id]).filter(Boolean) as Player[];
  const coaches = (save.pendingCoachHof ?? []).map((id) => save.coaches[id]).filter(Boolean) as Coach[];
  // Coaches share the wall; only the players get a link here.
  const honor = (save.sandbox ? [] : save.history.teamOfHonor[save.userTeamId] ?? [])
    .map((id) => save.players[id])
    .filter(Boolean) as Player[];
  const u = save.userTeamId;
  const yours = save.sandbox ? [] : klass.filter((p) => clubSeasons(p, u).length > 0);
  const league = klass.filter((p) => !yours.includes(p));
  const rafters = (p: Player) => {
    const club = signatureClub(p);
    if (!club || (club.teamId === u && !save.sandbox) || club.seasons < 6 || !save.teams[club.teamId]) return undefined;
    const r = retiredNumbers(save, club.teamId);
    if (r.some((x) => x.playerId === p.id || x.n === p.jersey)) return undefined;
    return `The ${displayName(save.year, club.teamId)} retire his #${p.jersey}.`;
  };
  return (
    <NightShow
      id={`hof-${save.year}`}
      show="CANTON · ENSHRINEMENT"
      title={`The Class of ${save.year + 1}`}
      sub={klass.length + coaches.length ? `${klass.length + coaches.length} through the door` : "The vote is in"}
      year={save.year}
      ticker={[...klass.map((p) => `${playerName(p).toUpperCase()} · ${p.pos}`), ...coaches.map((c) => `${c.name.toUpperCase()} · COACH`)]}
      tickerLabel="THE CLASS"
    >
    <article className="relative overflow-hidden rounded-xl border border-brass/50 bg-studio">
      <FilmStill still="superbowl" veil="full" />
      <div className="relative space-y-6 px-5 py-8 sm:px-8">
        <p className="font-display text-xs tracking-[0.4em] text-brass">CLASS OF {save.year + 1}</p>
        <h2 className="font-display text-4xl sm:text-6xl">Hall of Fame</h2>
        <p className="max-w-xl text-paper">
          {save.sandbox
            ? "Canton opens the door. Here's who walks through it."
            : yours.length || coaches.some((c) => c.teamId === save.userTeamId)
              ? "A bust with your club on the plaque. The wait after the last snap."
              : "Canton opens the door. Your name is not on it this winter."}
        </p>
        {yours.length > 0 && (
          <section>
            <p className="text-xs tracking-[0.3em] text-brass">INDUCTION NIGHT · ONE OF YOURS</p>
            <ul className="mt-2 space-y-3">
              {yours.map((p) => (
                <InductionCard key={p.id} player={p} teamId={u} />
              ))}
            </ul>
          </section>
        )}
        {league.length > 0 && (
          <section>
            <p className="text-xs tracking-[0.3em] text-muted">{yours.length ? "AND THE REST OF THE CLASS" : "THE CLASS"}</p>
            <ul className="mt-2 space-y-3">
              {league.map((p) => (
                <InductionCard key={p.id} player={p} note={rafters(p)} />
              ))}
            </ul>
          </section>
        )}
        <ul className="space-y-3">
          {coaches.map((c) => (
            <li key={c.id} className="rounded-lg border border-brass/40 bg-black/55 px-4 py-4">
              <p className="font-display text-2xl">
                {c.name} <span className="text-sm text-muted">coach</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                {c.careerWins}-{c.careerLosses}
                {c.careerTitles ? ` · ${c.careerTitles} titles` : ""}
              </p>
              <div className="mt-2">
                <CoachChips coach={c} compact />
              </div>
            </li>
          ))}
          {!klass.length && !coaches.length && <p className="text-muted">Canton waits. The clock is still running.</p>}
        </ul>
        {honor.length > 0 && (
          <section>
            <p className="text-xs tracking-[0.3em] text-brass">TEAM OF HONOR</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {honor.map((p) => (
                <li key={p.id} className="rounded-md border border-brass/40 px-3 py-1 text-sm">
                  <PlayerLink player={p} className="inline min-h-0" />
                </li>
              ))}
            </ul>
          </section>
        )}
        <Continue label={save.year >= END_YEAR ? "Close the books" : "Coaching carousel"} />
      </div>
    </article>
    </NightShow>
  );
}

export function CarouselNight() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const t = save.teams[save.userTeamId];
  const hc = t.coachId ? save.coaches[t.coachId] : undefined;
  const moves = (save.carousel ?? []).filter((m) => m.year === save.year);
  const pool = availableCoaches(save);
  const vacant = !save.sandbox && !t.coachId;
  const rec = `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`;
  return (
    <article className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
      <FilmStill still="office" veil="full" />
      <div className="relative space-y-6 px-5 py-8 sm:px-8">
        <p className="font-display text-xs tracking-[0.4em] text-brass">{save.year} PINK SLIPS</p>
        <h2 className="font-display text-4xl sm:text-6xl">Coaching carousel</h2>
        <p className="max-w-xl text-paper">
          {save.sandbox
            ? "Who got fired, who got hired, and who's still standing."
            : vacant
            ? "The chair is empty. The league will not hire for you."
            : hc
              ? `${hc.name} stays. You were ${rec}. The board leaves it on your desk.`
              : "A quiet winter in your building."}
        </p>
        {vacant && <HotNames />}
        {vacant && (
          <label className="block max-w-md text-sm">
            <span className="text-xs tracking-[0.25em] text-brass">HIRE A HEAD COACH</span>
            <select
              className="mt-2 min-h-11 w-full rounded-md border border-line bg-surface-2 px-2 text-fg"
              defaultValue=""
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                desk((s) => {
                  const r = deskHire(s, s.userTeamId, id, "HC");
                  return r.ok ? "Hired." : r.reason;
                });
              }}
            >
              <option value="">Choose a coach</option>
              {pool.slice(0, 24).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.age} · off {c.offense}/def {c.defense} ·{" "}
                  {playbookOf(c, save.year) ? `${playbookOf(c, save.year)!.offense} / ${playbookOf(c, save.year)!.defense}` : `${c.offScheme}/${c.defScheme}`}
                  {c.abilities?.[0] ? ` · ${c.abilities[0]}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <ul className="space-y-2">
          <CoachSearchBoard />
          {moves.map((m, i) => (
            <li key={`${m.teamId}-${i}`} className="flex items-center gap-3 rounded-lg border border-line bg-black/50 px-3 py-2">
              <Logo id={m.teamId} size={36} year={save.year} />
              <span className="text-sm">{m.note}</span>
            </li>
          ))}
          {!moves.length && <p className="text-muted">No pink slips around the league. Everybody keeps their man.</p>}
        </ul>
        <Continue label="Turn the calendar" />
      </div>
    </article>
  );
}

/** Black Monday's cuts, the hot names and who they talked to, ahead of the hires. */
function CoachSearchBoard() {
  const save = useGameStore((s) => s.save)!;
  const search = save.coachSearch?.year === save.year ? save.coachSearch : undefined;
  if (!search?.monday || (!search.cuts.length && !search.midseason)) return null;
  const hotEver = new Set([...search.hot, ...search.interviews.map((x) => x.coachId)]);
  const names = [...hotEver].map((id) => save.coaches[id]).filter((c) => !!c);
  return (
    <li className="list-none space-y-3 rounded-lg border border-brass/30 bg-black/60 px-4 py-3" aria-label="Coaching search">
      <p className="text-xs tracking-[0.3em] text-brass">BLACK MONDAY</p>
      <p className="text-sm text-paper">
        {search.cuts.length
          ? `${search.cuts.length} ${search.cuts.length === 1 ? "club" : "clubs"} fired the head coach the day after the season${search.midseason ? `, after ${search.midseason} midseason ${search.midseason === 1 ? "firing" : "firings"}` : ""}.`
          : `${search.midseason} midseason ${search.midseason === 1 ? "firing" : "firings"}; nobody else was cut.`}
      </p>
      {search.cuts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {search.cuts.map((id) => (
            <span key={id} className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs">
              <Logo id={id} size={20} year={save.year} />
              {displayName(save.year, id)}
            </span>
          ))}
        </div>
      )}
      {names.length > 0 && (
        <div>
          <p className="text-xs tracking-[0.25em] text-muted">THE HOT NAMES</p>
          <ul className="mt-1 space-y-1 text-sm">
            {names.map((c) => {
              const met = search.interviews.filter((x) => x.coachId === c.id).map((x) => displayName(save.year, x.teamId));
              const landed = c.role === "HC" && c.teamId && save.teams[c.teamId]?.coachId === c.id && search.cuts.includes(c.teamId);
              return (
                <li key={c.id} className="text-paper">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted">
                    {landed ? ` · hired by ${displayName(save.year, c.teamId!)}` : c.teamId && save.teams[c.teamId] ? ` · ${c.role}, ${displayName(save.year, c.teamId)}` : " · out of work"}
                    {met.length ? ` · met with ${met.join(", ")}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}

export function RelocationNight() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const historic = save.owner?.historic;
  const stayed = !save.sandbox && save.owner?.home?.teamId === save.userTeamId && save.owner.home.from === save.year;
  const moves = relocationsFor(save, save.year);
  if (!moves.length && !stayed) return null;
  const oursMove = save.sandbox ? undefined : moves.find((m) => m.teamId === save.userTeamId);
  const others = moves.filter((m) => m !== oursMove || !historic);
  return (
    <article className="relative overflow-hidden rounded-xl border border-brass/40 bg-studio">
      <FilmStill still="helmet" veil="full" />
      <div className="relative space-y-6 px-5 py-8 sm:px-8">
        <p className="font-display text-xs tracking-[0.4em] text-brass">{save.year} MOVING VANS</p>
        <h2 className="font-display text-4xl sm:text-6xl">
          {historic ? "Your signature, your city" : stayed ? "The club stays home" : oursMove ? oursMove.title : "The map changes"}
        </h2>
        <p className="max-w-xl text-paper">
          {historic
            ? `History has the ${historic.from} leaving town this year. You own the club. Sign the lease and become the ${historic.to}, or tear it up and stay.`
            : stayed
              ? "You tore up the lease history had waiting. Same city, same stadium, and a fan base that will not forget it."
              : oursMove
                ? "This is your club. The letterhead is different when you come in Monday."
                : "Not your trucks. Still your league. The helmets on the schedule will not match last September."}
        </p>
        {historic && (
          <div className="flex flex-wrap gap-3">
            <Btn kind="primary" onClick={() => desk((s) => followHistory(s))}>
              Become the {historic.to}
            </Btn>
            <Btn kind="ghost" onClick={() => desk((s) => stayHome(s))}>
              Stay the {historic.from}
            </Btn>
          </div>
        )}
        <ul className="space-y-4">
          {others.map((m) => (
            <li key={m.teamId} className="rounded-lg border border-brass/30 bg-black/55 p-4">
              <div className="flex items-center gap-3">
                <Logo id={m.teamId} size={56} year={save.year} />
                <div>
                  <p className="font-display text-2xl">{m.to}</p>
                  <p className="text-sm text-muted">was {m.from}</p>
                </div>
              </div>
              <p className="mt-3 text-paper">{m.body}</p>
            </li>
          ))}
        </ul>
        <Continue label={historic ? "Follow history and continue" : save.expansion ? "Expansion draft" : "Open the college draft"} />
      </div>
    </article>
  );
}
