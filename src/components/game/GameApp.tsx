import { useMemo, useRef } from "react";
import {
  ACTIVE_1966,
  depthChart,
  displayName,
  formatMoney,
  gamesForTeam,
  locationOf,
  nicknameOf,
  originalLeague,
  playerName,
  rosterOf,
  standingRows,
  teamColors,
  teamPayroll,
  type Player,
  type TeamId,
} from "@/lib/game";
import { useGameStore, type Tab } from "@/lib/game-store";
import { proBowlSite, roman, superBowlNumber, seasonLeaders } from "@/lib/game";
import { PrimetimeShow } from "./PrimetimeShow";
import { DraftNight } from "./DraftNight";
import { SuperBowlNight } from "./SuperBowlNight";
import { DepthField } from "./DepthField";

function Logo({ id, size = 36 }: { id: TeamId; size?: number }) {
  const c = teamColors(id);
  return (
    <img
      src={`/logos/${id}.svg`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-sm"
      style={{ width: size, height: size, background: c.primary }}
    />
  );
}

function Btn({
  children,
  onClick,
  kind = "ghost",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "brick";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium tracking-wide transition-colors disabled:opacity-40";
  const map = {
    primary: "bg-accent text-accent-fg hover:bg-accent/90",
    ghost: "border border-line bg-surface text-fg hover:bg-surface-2",
    brick: "bg-brick text-fg hover:bg-brick/90",
  };
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${base} ${map[kind]} ${className}`}>
      {children}
    </button>
  );
}

function TitleScreen() {
  const { save, setScreen, continueGame, exportJson, importJson } = useGameStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const download = () => {
    const json = exportJson();
    if (!json || json === "null") return;
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nfl-rewind-${save?.userTeamId ?? "dynasty"}-${save?.year ?? 1966}.json`;
    a.click();
  };
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 px-5 py-12">
      <p className="font-display text-xs tracking-[0.35em] text-muted">START IN 1966 · SUPER BOWL I ERA</p>
      <h1 className="font-display text-5xl leading-none text-fg sm:text-7xl">
        NFL
        <span className="block text-accent">Rewind</span>
      </h1>
      <p className="max-w-lg text-lg text-muted">
        You are the GM. Draft the real classes, hire the staff, survive Sunday. Rewrite football history from Super Bowl I through 2027.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Btn kind="primary" onClick={() => setScreen("select")}>
          New dynasty
        </Btn>
        <Btn onClick={continueGame} disabled={!save}>
          Continue
        </Btn>
        <Btn onClick={download} disabled={!save}>
          Export dynasty JSON
        </Btn>
        <Btn onClick={() => fileRef.current?.click()}>Import dynasty JSON</Btn>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            void f.text().then(importJson);
          }}
        />
      </div>
      <p className="text-sm text-subtle">AFL / NFL · named veterans · no player photographs</p>
    </main>
  );
}

function TeamSelect() {
  const { newGame, setScreen } = useGameStore();
  const nfl = ACTIVE_1966.filter((id) => originalLeague(id) === "NFL");
  const afl = ACTIVE_1966.filter((id) => originalLeague(id) === "AFL");
  const Group = ({ title, ids }: { title: string; ids: readonly TeamId[] }) => (
    <section className="space-y-3">
      <h2 className="text-sm tracking-[0.2em] text-muted">{title}</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => newGame(id)}
            className="flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface px-3 text-left hover:bg-surface-2"
          >
            <Logo id={id} size={44} />
            <span>
              <span className="block font-display text-base">{locationOf(1966, id)}</span>
              <span className="text-sm text-muted">{nicknameOf(1966, id)}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
  return (
    <main className="mx-auto max-w-4xl space-y-8 px-5 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl">Choose your club</h1>
        <Btn onClick={() => setScreen("title")}>Back</Btn>
      </div>
      <Group title="National Football League" ids={nfl} />
      <Group title="American Football League" ids={afl} />
    </main>
  );
}

function PhaseAction() {
  const { save, step } = useGameStore();
  if (!save) return null;
  const label: Record<string, string> = {
    draft: "Stay on the clock / auto rest",
    freeAgency: "Run free agency",
    expansion: "Complete expansion",
    preseason: "Kick off the regular season",
    regular: "Sim this Sunday",
    playoffs: "Sim playoff games",
    superBowl: save.superBowl?.played ? "Continue to awards" : "Play Super Bowl",
    awards: "Continue",
    proBowl: "Continue to retirement",
    retirement: "Continue",
    hof: "Next season",
  };
  return (
    <Btn kind="primary" onClick={() => step({ auto: save.phase !== "draft" })}>
      {label[save.phase] ?? "Continue"}
    </Btn>
  );
}

function Office() {
  const save = useGameStore((s) => s.save)!;
  const team = save.teams[save.userTeamId];
  const rec = `${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ""}`;
  const hc = team.coachId ? save.coaches[team.coachId] : undefined;
  const oc = team.ocId ? save.coaches[team.ocId] : undefined;
  const dc = team.dcId ? save.coaches[team.dcId] : undefined;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.25em] text-muted">{save.weekLabel}</p>
          <h2 className="text-3xl">{displayName(save.year, save.userTeamId)}</h2>
          <p className="tabular text-muted">
            {rec} · HC {hc?.name ?? "—"} · OC {oc?.name ?? "—"} · DC {dc?.name ?? "—"}
          </p>
          <p className="text-sm text-subtle">
            Payroll {formatMoney(teamPayroll(save, save.userTeamId), save.year)}
            {save.salaryCap ? ` · cap ${formatMoney(save.salaryCap, save.year)}` : " · pre-cap era"}
          </p>
        </div>
        <PhaseAction />
      </div>
      <InjuryReport />
      <PrimetimeShow />
    </div>
  );
}

function InjuryReport() {
  const save = useGameStore((s) => s.save)!;
  const hurt = rosterOf(save, save.userTeamId).filter((p) => p.injuredWeeks > 0);
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs tracking-[0.25em] text-muted">INJURY REPORT</p>
      {hurt.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Training room is quiet. Next man stays on the bench.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {hurt.map((p) => (
            <li key={p.id} className="flex justify-between gap-3">
              <span>
                {playerName(p)} <span className="text-muted">{p.pos}</span>
              </span>
              <span className="tabular text-brick">
                {p.injuryName ?? "hurt"} · {p.injuredWeeks}w
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Roster() {
  const save = useGameStore((s) => s.save)!;
  const rows = rosterOf(save, save.userTeamId)
    .slice()
    .sort((a, b) => b.ovr - a.ovr);
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-surface-2 text-xs tracking-wider text-muted">
          <tr>
            {["#", "Player", "Pos", "OVR", "Age", "Abilities", "Sal", "Status"].map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-line">
              <td className="tabular px-3 py-2 text-muted">{p.jersey}</td>
              <td className="px-3 py-2">
                {playerName(p)}
                {p.historical ? "" : <span className="ml-2 text-xs text-subtle">camp</span>}
              </td>
              <td className="px-3 py-2">{p.pos}</td>
              <td className="tabular px-3 py-2">{p.ovr}</td>
              <td className="tabular px-3 py-2">{p.age}</td>
              <td className="px-3 py-2 text-xs text-muted">{p.abilities?.join(" · ") || "—"}</td>
              <td className="tabular px-3 py-2 text-muted">{formatMoney(p.salary ?? 0, save.year)}</td>
              <td className="px-3 py-2 text-xs">
                {p.injuredWeeks > 0 ? (
                  <span className="text-brick">
                    {p.injuryName ?? "hurt"} · {p.injuredWeeks}w
                  </span>
                ) : (
                  <span className="text-accent">active</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Depth() {
  const save = useGameStore((s) => s.save)!;
  const groups = depthChart(save, save.userTeamId);
  return (
    <div className="space-y-8">
      <DepthField />
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="mb-3 text-sm tracking-[0.2em] text-muted">{g.label}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {g.rows.map((row) => (
              <div key={row.pos} className="rounded-lg border border-line bg-surface p-3">
                <p className="text-xs tracking-widest text-muted">{row.pos}</p>
                <ol className="mt-1 space-y-1">
                  {row.players.map((p, i) => (
                    <li key={p.id} className="flex justify-between text-sm">
                      <span>
                        {i + 1}. {playerName(p)}
                        {p.injuredWeeks > 0 ? <span className="ml-2 text-brick">out</span> : null}
                      </span>
                      <span className="tabular text-muted">{p.ovr}</span>
                    </li>
                  ))}
                  {!row.players.length && <li className="text-subtle">empty</li>}
                </ol>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Staff() {
  const save = useGameStore((s) => s.save)!;
  const t = save.teams[save.userTeamId];
  const row = (role: string, id: string | null) => {
    const c = id ? save.coaches[id] : undefined;
    return (
      <article className="rounded-xl border border-line bg-surface p-4">
        <p className="text-xs tracking-[0.2em] text-muted">{role}</p>
        <h3 className="text-2xl">{c?.name ?? "Vacant"}</h3>
        {c && (
          <p className="text-sm text-muted">
            Off {c.offense} · Def {c.defense} · {c.offScheme} / {c.defScheme} · year {c.yearsOnJob} on the job
          </p>
        )}
      </article>
    );
  };
  const carousel = (save.carousel ?? []).filter((m) => m.year >= save.year - 1);
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Draft style: <span className="uppercase">{t.draftStyle}</span>. Clubs pick by need, speed, trenches, or best player available.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {row("Head coach", t.coachId)}
        {row("Offensive coordinator", t.ocId)}
        {row("Defensive coordinator", t.dcId)}
      </div>
      <section>
        <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">Coaching carousel</h3>
        {carousel.length === 0 && <p className="text-muted">No pink slips this winter — yet.</p>}
        <ul className="space-y-2">
          {carousel.map((m, i) => (
            <li key={`${m.teamId}-${i}`} className="text-sm">
              {m.note}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Standings() {
  const save = useGameStore((s) => s.save)!;
  const rows = standingRows(save);
  return (
    <div className="space-y-8">
      {rows.map((g) => (
        <section key={g.key}>
          <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">
            {g.conf} {g.div}
          </h3>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-muted">
                <tr>
                  {["Club", "W", "L", "T", "PF", "PA", "Str"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.teams.map((t) => (
                  <tr
                    key={t.id}
                    className={`border-t border-line ${t.id === save.userTeamId ? "bg-accent/15" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <Logo id={t.id} size={22} />
                        {displayName(save.year, t.id)}
                      </span>
                    </td>
                    <td className="tabular px-3 py-2">{t.wins}</td>
                    <td className="tabular px-3 py-2">{t.losses}</td>
                    <td className="tabular px-3 py-2">{t.ties}</td>
                    <td className="tabular px-3 py-2">{t.pf}</td>
                    <td className="tabular px-3 py-2">{t.pa}</td>
                    <td className="tabular px-3 py-2 text-muted">{t.streak || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function Schedule() {
  const save = useGameStore((s) => s.save)!;
  const games = gamesForTeam(save, save.userTeamId);
  const extra = [...save.playoffGames, ...(save.superBowl ? [save.superBowl] : [])];
  return (
    <ul className="space-y-2">
      {games.map((g) => {
        const opp = (g.homeId === save.userTeamId ? g.awayId : g.homeId) as TeamId;
        const home = g.homeId === save.userTeamId;
        return (
          <li key={g.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-3">
            <span className="text-sm text-muted">Wk {g.week}</span>
            <span className="inline-flex items-center gap-2">
              {home ? "vs" : "@"} <Logo id={opp} size={24} /> {displayName(save.year, opp)}
            </span>
            <span className="tabular">{g.played ? `${g.homeScore}–${g.awayScore}` : "—"}</span>
          </li>
        );
      })}
      {extra
        .filter((g) => g.homeId === save.userTeamId || g.awayId === save.userTeamId)
        .map((g) => (
          <li key={g.id} className="rounded-lg border border-accent bg-surface px-3 py-3">
            {g.round}: {g.played ? `${g.homeScore}–${g.awayScore}` : "upcoming"}
          </li>
        ))}
    </ul>
  );
}

function Stats() {
  const save = useGameStore((s) => s.save)!;
  const players: Player[] = Object.values(save.players).filter((p) => p.stats[save.year]);
  const rows = players
    .map((p) => ({ p, s: p.stats[save.year]! }))
    .sort((a, b) => b.s.passYds + b.s.rushYds + b.s.recYds - (a.s.passYds + a.s.rushYds + a.s.recYds))
    .slice(0, 48);
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-surface-2 text-xs text-muted">
          <tr>
            {["Player", "Team", "Pass", "Rush", "Rec", "TD", "INT", "Sacks"].map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, s }) => (
            <tr key={p.id} className="border-t border-line">
              <td className="px-3 py-2">{playerName(p)}</td>
              <td className="px-3 py-2 uppercase">{String(p.teamId)}</td>
              <td className="tabular px-3 py-2">{s.passYds}</td>
              <td className="tabular px-3 py-2">{s.rushYds}</td>
              <td className="tabular px-3 py-2">{s.rec}</td>
              <td className="tabular px-3 py-2">{s.passTd + s.rushTd + s.recTd}</td>
              <td className="tabular px-3 py-2">{s.passInt}</td>
              <td className="tabular px-3 py-2">{s.sacks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function History() {
  const save = useGameStore((s) => s.save)!;
  const leaders = seasonLeaders(save);
  const boards = [
    ["Passing", leaders.passYds],
    ["Rushing", leaders.rushYds],
    ["Receiving", leaders.recYds],
    ["Sacks", leaders.sacks],
    ["Interceptions", leaders.ints],
  ] as const;
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">{save.year} League leaders</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {boards.map(([title, rows]) => (
            <article key={title} className="rounded-lg border border-line bg-surface p-3">
              <p className="text-xs tracking-widest text-muted">{title}</p>
              <ol className="mt-2 space-y-1 text-sm">
                {rows.slice(0, 5).map((r, i) => (
                  <li key={r.playerId} className="flex justify-between gap-2">
                    <span>{i + 1}. {r.name} <span className="text-muted">{r.pos}</span></span>
                    <span className="tabular">{r.value}</span>
                  </li>
                ))}
                {!rows.length && <li className="text-muted">Play a Sunday.</li>}
              </ol>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">Super Bowls</h3>
        {save.history.superBowls.length === 0 && (
          <p className="text-muted">The almanac is empty. Super Bowl I has not been played.</p>
        )}
        <ul className="space-y-2">
          {save.history.superBowls.map((b) => (
            <li key={b.year} className="rounded-lg border border-line bg-surface p-3">
              <p className="font-display text-lg">
                Super Bowl {roman(b.number)} — {displayName(b.year, b.homeScore >= b.awayScore ? b.homeId : b.awayId)}
              </p>
              <p className="text-sm text-muted">
                {b.homeScore}–{b.awayScore} · {b.site} · {b.mvpName ?? "MVP n/a"}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">Hall of Fame</h3>
        <ul className="space-y-2">
          {save.history.hof.map((h) => (
            <li key={h.playerId} className="text-sm">
              {h.year}: {save.players[h.playerId] ? playerName(save.players[h.playerId]!) : h.playerId} — {h.blurb}
            </li>
          ))}
          {!save.history.hof.length && <p className="text-muted">No class yet. Five-year wait after retirement.</p>}
        </ul>
      </section>
    </div>
  );
}

function EventPane() {
  const save = useGameStore((s) => s.save)!;
  if (save.phase === "superBowl" && save.superBowl) {
    return <SuperBowlNight />;
  }
    if (save.phase === "proBowl" && save.proBowl) {
    const g = save.proBowl;
    const site = proBowlSite(save.year);
    return (
      <article className="space-y-4 rounded-xl border border-line bg-surface p-5">
        <p className="text-xs tracking-[0.3em] text-muted">{save.year} PRO BOWL</p>
        <h2 className="text-3xl">{site.site}</h2>
        <p className="text-muted">{site.flavor}</p>
        <p className="font-display text-3xl tabular">
          {String(g.homeId).toUpperCase()} {g.homeScore} · {String(g.awayId).toUpperCase()} {g.awayScore}
        </p>
        <PhaseAction />
      </article>
    );
  }
  if (save.phase === "awards" && save.awards) {
    const a = save.awards;
    const name = (id?: string) => (id && save.players[id] ? playerName(save.players[id]!) : "—");
    return (
      <article className="space-y-3 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-3xl">{save.year} Awards</h2>
        <p>MVP: {name(a.mvp)}</p>
        <p>Offensive: {name(a.offPoy)}</p>
        <p>Defensive: {name(a.defPoy)}</p>
        <p>Off. Rookie: {name(a.oroy)}</p>
        <PhaseAction />
      </article>
    );
  }
  if (save.phase === "retirement") {
    return (
      <article className="space-y-3 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-3xl">Retirement ceremony</h2>
        <ul className="space-y-2">
          {save.pendingRetirees.map((id) => {
            const p = save.players[id];
            return (
              <li key={id}>
                {p ? `${playerName(p)}, ${p.pos}, age ${p.age}` : id}
              </li>
            );
          })}
          {!save.pendingRetirees.length && <p className="text-muted">Nobody is walking away this winter.</p>}
        </ul>
        <PhaseAction />
      </article>
    );
  }
  if (save.phase === "hof") {
    return (
      <article className="space-y-3 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-3xl">Hall of Fame</h2>
        <ul>
          {save.pendingHof.map((id) => {
            const p = save.players[id];
            return <li key={id}>{p ? playerName(p) : id}</li>;
          })}
          {!save.pendingHof.length && <p className="text-muted">Canton waits.</p>}
        </ul>
        <PhaseAction />
      </article>
    );
  }
  if (save.phase === "expansion" && save.expansion) {
    return (
      <article className="space-y-3 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-3xl">{save.weekLabel}</h2>
        <p className="text-muted">
          New clubs: {save.expansion.newTeamIds.map((id) => displayName(save.year, id)).join(", ")}.
        </p>
        <p className="text-sm text-muted">Moved {save.expansion.picksMade.length} veterans off existing rosters.</p>
        <PhaseAction />
      </article>
    );
  }
  return null;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "office", label: "Office" },
  { id: "roster", label: "Roster" },
  { id: "depth", label: "Depth" },
  { id: "staff", label: "Staff" },
  { id: "standings", label: "Standings" },
  { id: "schedule", label: "Schedule" },
  { id: "stats", label: "Stats" },
  { id: "draft", label: "Draft" },
  { id: "history", label: "History" },
];

function PlayShell() {
  const { save, tab, setTab, resign, exportJson } = useGameStore();
  const event = useMemo(() => {
    if (!save) return false;
    return ["superBowl", "proBowl", "awards", "retirement", "hof", "expansion"].includes(save.phase);
  }, [save]);
  if (!save) return <TitleScreen />;
  const download = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nfl-rewind-${save.userTeamId}-${save.year}.json`;
    a.click();
  };
  const showDraft = save.phase === "draft" && !event;
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo id={save.userTeamId} size={32} />
            <div>
              <p className="font-display text-sm leading-none">{displayName(save.year, save.userTeamId)}</p>
              <p className="text-xs text-muted">{save.weekLabel}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Btn onClick={download} className="hidden sm:inline-flex">
              Export
            </Btn>
            <Btn onClick={resign}>Title</Btn>
          </div>
        </div>
        <nav className="mx-auto mt-3 flex max-w-5xl gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-10 shrink-0 rounded-md px-3 text-sm ${
                tab === t.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {event ? <EventPane /> : null}
        {showDraft && tab !== "standings" && tab !== "history" ? <DraftNight /> : null}
        {!event && !showDraft && tab === "office" && <Office />}
        {!event && tab === "roster" && <Roster />}
        {!event && tab === "depth" && <Depth />}
        {!event && tab === "staff" && <Staff />}
        {!event && tab === "standings" && <Standings />}
        {!event && tab === "schedule" && <Schedule />}
        {!event && tab === "stats" && <Stats />}
        {!event && tab === "draft" && !showDraft && <DraftNight />}
        {!event && tab === "history" && <History />}
      </main>
    </div>
  );
}

export function GameApp() {
  const screen = useGameStore((s) => s.screen);
  if (screen === "title") return <TitleScreen />;
  if (screen === "select") return <TeamSelect />;
  return <PlayShell />;
}
