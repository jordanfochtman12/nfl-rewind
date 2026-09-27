import {
  availableCoaches,
  careerTotals,
  clubSeasons,
  deskHire,
  retiredNumbers,
  signatureClub,
  displayName,
  END_YEAR,
  playerName,
  relocationsFor,
  followHistory,
  stayHome,
  type Coach,
  type Player,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { FilmStill } from "./Art";
import { PlayerLink } from "./PlayerProfile";
import { CoachChips } from "./KitChips";
import { HonorButtons, InductionCard } from "./Legacy";

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

function ours(save: { userTeamId: TeamId; players: Record<string, Player> }, id?: string): boolean {
  const p = id ? save.players[id] : undefined;
  return !!p && (p.teamId === save.userTeamId || p.userTied);
}

export function AwardsNight() {
  const save = useGameStore((s) => s.save)!;
  const a = save.awards;
  if (!a) return null;
  const rows: [string, string | undefined][] = [
    ["Most Valuable Player", a.mvp],
    ["Offensive Player of the Year", a.offPoy],
    ["Defensive Player of the Year", a.defPoy],
    ["Offensive Rookie", a.oroy],
    ["Defensive Rookie", a.droy],
    ["Comeback Player", a.cpoty],
  ];
  const allPro = (a.allPro ?? []).map((id) => save.players[id]).filter(Boolean) as Player[];
  const yours = rows.filter(([, id]) => ours(save, id));
  return (
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
        <ul className="space-y-3">
          {rows.map(([label, id]) => {
            const p = id ? save.players[id] : undefined;
            const mine = ours(save, id);
            return (
              <li
                key={label}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                  mine ? "border-brass/50 bg-brass/10" : "border-line bg-black/50"
                }`}
              >
                <span className="text-xs tracking-[0.25em] text-muted">{label}</span>
                <span className="font-display text-xl">
                  <Name id={id} />
                  {p && p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof" ? (
                    <span className="ml-2 text-sm text-muted">{displayName(save.year, p.teamId)}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
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
  );
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
  const yours = [...home, ...away].filter((p) => p.teamId === save.userTeamId || p.userTied);
  const Col = ({ title, score, rows }: { title: string; score: number; rows: Player[] }) => (
    <section className="rounded-lg border border-line bg-black/55 p-4">
      <p className="text-xs tracking-[0.3em] text-brass">{title}</p>
      <p className="tabular font-display text-5xl">{score}</p>
      <ol className="mt-3 space-y-1 text-sm">
        {rows.slice(0, 14).map((p) => (
          <li key={p.id} className={p.teamId === save.userTeamId ? "text-brass" : ""}>
            <PlayerLink player={p} className="inline min-h-0" />{" "}
            <span className="text-muted">{p.pos}</span>
          </li>
        ))}
      </ol>
    </section>
  );
  return (
    <article className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
      <FilmStill still="superbowl" veil="full" />
      <div className="relative space-y-6 px-5 py-8 sm:px-8">
        <p className="font-display text-xs tracking-[0.4em] text-brass">{save.year} PRO BOWL</p>
        <h2 className="font-display text-4xl sm:text-5xl">{g.stadium ?? "All-star game"}</h2>
        <p className="max-w-xl text-paper">
          {yours.length
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
        <Continue label="Retirement ceremony" />
      </div>
    </article>
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

function coachCard(c: Coach, mine: boolean) {
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
        {c.careerTitles ? ` · ${c.careerTitles} titles` : ""} · {c.offScheme}/{c.defScheme}
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
  const mine = pending.filter((p) => p.teamId === save.userTeamId || p.userTied);
  const rest = pending.filter((p) => !mine.includes(p));
  const coaches = (save.pendingCoachRetirees ?? [])
    .map((id) => save.coaches[id])
    .filter(Boolean) as Coach[];
  const myCoach = coaches.filter((c) => c.teamId === save.userTeamId);
  const restCoach = coaches.filter((c) => c.teamId !== save.userTeamId);
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
            <ul className="mt-2 space-y-2">{myCoach.map((c) => coachCard(c, true))}</ul>
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
            <ul className="mt-2 space-y-2">{restCoach.slice(0, 6).map((c) => coachCard(c, false))}</ul>
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
  const honor = (save.history.teamOfHonor[save.userTeamId] ?? [])
    .map((id) => save.players[id])
    .filter(Boolean) as Player[];
  const u = save.userTeamId;
  const yours = klass.filter((p) => clubSeasons(p, u).length > 0);
  const league = klass.filter((p) => !yours.includes(p));
  const rafters = (p: Player) => {
    const club = signatureClub(p);
    if (!club || club.teamId === u || club.seasons < 6 || !save.teams[club.teamId]) return undefined;
    const r = retiredNumbers(save, club.teamId);
    if (r.some((x) => x.playerId === p.id || x.n === p.jersey)) return undefined;
    return `the ${displayName(save.year, club.teamId)} retire his #${p.jersey}`;
  };
  return (
    <article className="relative overflow-hidden rounded-xl border border-brass/50 bg-studio">
      <FilmStill still="superbowl" veil="full" />
      <div className="relative space-y-6 px-5 py-8 sm:px-8">
        <p className="font-display text-xs tracking-[0.4em] text-brass">CLASS OF {save.year + 1}</p>
        <h2 className="font-display text-4xl sm:text-6xl">Hall of Fame</h2>
        <p className="max-w-xl text-paper">
          {yours.length || coaches.some((c) => c.teamId === save.userTeamId)
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
        <ul className="space-y-3">
          {league.map((p) => (
            <li
              key={p.id}
              className={`rounded-lg border px-4 py-4 ${
                p.userTied ? "border-brass/60 bg-brass/15" : "border-line bg-black/55"
              }`}
            >
              <p className="font-display text-2xl">
                <PlayerLink player={p} className="inline min-h-0" />{" "}
                <span className="text-sm text-muted">{p.pos}</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                Peak {p.peakOvr} · {p.userTied ? "Team of Honor" : "the league’s memory"}
                {rafters(p) ? ` · ${rafters(p)}` : ""}
              </p>
            </li>
          ))}
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
  );
}

export function CarouselNight() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const t = save.teams[save.userTeamId];
  const hc = t.coachId ? save.coaches[t.coachId] : undefined;
  const moves = (save.carousel ?? []).filter((m) => m.year === save.year);
  const pool = availableCoaches(save);
  const vacant = !t.coachId;
  const rec = `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`;
  return (
    <article className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
      <FilmStill still="office" veil="full" />
      <div className="relative space-y-6 px-5 py-8 sm:px-8">
        <p className="font-display text-xs tracking-[0.4em] text-brass">{save.year} PINK SLIPS</p>
        <h2 className="font-display text-4xl sm:text-6xl">Coaching carousel</h2>
        <p className="max-w-xl text-paper">
          {vacant
            ? "The chair is empty. The league will not hire for you."
            : hc
              ? `${hc.name} stays. You were ${rec}. The board leaves it on your desk.`
              : "A quiet winter in your building."}
        </p>
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
                  {c.name} · {c.age} · off {c.offense}/def {c.defense} · {c.offScheme}/{c.defScheme}
                  {c.abilities?.[0] ? ` · ${c.abilities[0]}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <ul className="space-y-2">
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

export function RelocationNight() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const historic = save.owner?.historic;
  const stayed = save.owner?.home?.teamId === save.userTeamId && save.owner.home.from === save.year;
  const moves = relocationsFor(save, save.year);
  if (!moves.length && !stayed) return null;
  const oursMove = moves.find((m) => m.teamId === save.userTeamId);
  const others = moves.filter((m) => m.teamId !== save.userTeamId || !historic);
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
