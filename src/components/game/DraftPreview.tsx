import { useMemo, useState, type ReactNode } from "react";
import {
  collegeLine,
  displayName,
  draftPreview,
  formatHt,
  POS_GROUPS,
  scoutLetter,
  sessionLabel,
  type PosGroup,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { FilmStill } from "./Art";

function Who({ id }: { id: string }) {
  const save = useGameStore((s) => s.save)!;
  const open = useGameStore((s) => s.openProfile);
  const p = save.players[id];
  if (!p) return <span>—</span>;
  return (
    <button type="button" onClick={() => open(id)} className="text-left font-display text-base font-bold uppercase italic leading-tight hover:text-brass">
      {p.firstName} {p.lastName}
    </button>
  );
}

function Grade({ g }: { g: number }) {
  const letter = scoutLetter(g);
  const tone = letter.startsWith("A") ? "bg-brass text-[#140f00]" : letter.startsWith("B") ? "bg-white text-black" : "bg-chrome-2 text-white";
  return (
    <span className={`inline-flex min-w-9 justify-center px-1.5 font-display text-sm font-extrabold italic [transform:skewX(-12deg)] ${tone}`}>
      <span className="[transform:skewX(12deg)]">{letter}</span>
    </span>
  );
}

function Segment({ n, title, children, id }: { n: number; title: string; children: ReactNode; id: string }) {
  return (
    <section id={`dp-${id}`} className="scroll-mt-32 border-t border-white/10">
      <div className="flex items-stretch bg-gradient-to-b from-[#161b26] to-[#07090e]">
        <span className="bx-primary flex items-center px-4 font-display text-lg font-extrabold italic">{n}</span>
        <h3 className="flex items-center px-4 py-2.5 text-lg text-white sm:text-xl">{title}</h3>
      </div>
      <div className="px-4 py-5 sm:px-5">{children}</div>
    </section>
  );
}

/** Draft week on the network: the mock, the big board, position rankings and the war room. */
export function DraftPreviewShow() {
  const save = useGameStore((s) => s.save)!;
  const setTab = useGameStore((s) => s.setTab);
  const [group, setGroup] = useState<PosGroup>("QB");
  const d = useMemo(() => draftPreview(save), [save.year, save.draftSession, save.draftPickIndex, save.phase]);
  const P = (id: string) => save.players[id];
  const meas = (id: string) => {
    const p = P(id);
    if (!p) return "";
    return [p.heightIn ? formatHt(p.heightIn) : "", p.weight ? `${p.weight}` : "", p.forty != null ? p.forty.toFixed(2) : ""].filter(Boolean).join(" · ");
  };
  const started = save.draftPickIndex > 0;

  const segs: { id: string; title: string; node: ReactNode }[] = [];

  segs.push({
    id: "mock",
    title: started ? "Mock first round · updated live" : "Mock first round",
    node: (
      <ol className="space-y-2">
        {d.mock.map((m) => {
          const id = m.actualId ?? m.mockId;
          const p = id ? P(id) : undefined;
          const mine = !save.sandbox && m.teamId === save.userTeamId;
          return (
            <li
              key={m.overall}
              className={`grid grid-cols-[2.25rem_auto_1fr] items-center gap-x-3 gap-y-1 border px-3 py-2.5 ${
                mine ? "border-brass/60 bg-brass/10" : "border-white/10 bg-black/35"
              }`}
            >
              <span className="bug-num text-2xl text-white">{m.overall}</span>
              <Logo id={m.teamId} size={34} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                  <span className="font-display font-bold uppercase italic tracking-wide text-chrome">{displayName(save.year, m.teamId)}</span>
                  <span>needs {m.needs.join(", ")}</span>
                  {m.actualId && <span className="bg-good px-1 font-display text-[10px] font-extrabold italic text-black">PICK IS IN</span>}
                  {mine && !m.actualId && <span className="bg-brass px-1 font-display text-[10px] font-extrabold italic text-black">YOUR PICK</span>}
                </p>
                {p && id ? (
                  <p className="flex flex-wrap items-center gap-x-2">
                    <Who id={id} />
                    <span className="text-sm text-muted">
                      {p.pos} · {p.college ?? "—"}
                    </span>
                    <Grade g={d.board.find((b) => b.playerId === id)?.grade ?? (p.scoutOvr ?? p.ovr)} />
                  </p>
                ) : null}
                <p className="text-xs text-subtle">{m.note}</p>
              </div>
            </li>
          );
        })}
      </ol>
    ),
  });

  if (d.warRoom.length && !save.sandbox) {
    segs.push({
      id: "war",
      title: `Your war room · ${displayName(save.year, save.userTeamId)}`,
      node: (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Biggest needs: <span className="font-display font-bold uppercase italic text-white">{d.userNeeds.join(" · ")}</span>
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {d.warRoom.map((w) => (
              <div key={w.overall} className="border border-white/10 bg-black/35 p-3">
                <p className="font-display text-sm font-bold uppercase italic tracking-wide text-brass">
                  Round {w.round} · pick {w.overall}
                </p>
                <p className="mb-2 text-xs text-subtle">Likely on the board</p>
                <ul className="space-y-1.5">
                  {w.likely.map((b) => (
                    <li key={b.playerId} className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <Who id={b.playerId} />
                        <span className="block text-xs text-muted">
                          {P(b.playerId)?.pos} · {P(b.playerId)?.college} · #{b.rank}
                        </span>
                      </span>
                      <Grade g={b.grade} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  segs.push({
    id: "big",
    title: "The big board · top 32",
    node: (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr>
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Prospect</th>
              <th className="px-2 py-2">Pos</th>
              <th className="px-2 py-2">School</th>
              <th className="px-2 py-2">Ht · Wt · 40</th>
              <th className="px-2 py-2">Grade</th>
            </tr>
          </thead>
          <tbody>
            {d.board.slice(0, 32).map((b) => (
              <tr key={b.playerId} className="border-t border-white/5">
                <td className="tabular px-2 py-1.5 text-muted">{b.rank}</td>
                <td className="px-2 py-1.5">
                  <Who id={b.playerId} />
                </td>
                <td className="px-2 py-1.5">{P(b.playerId)?.pos}</td>
                <td className="px-2 py-1.5 text-muted">{P(b.playerId)?.college}</td>
                <td className="tabular px-2 py-1.5 text-muted">{meas(b.playerId)}</td>
                <td className="px-2 py-1.5">
                  <Grade g={b.grade} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  });

  segs.push({
    id: "pos",
    title: "Position rankings · top 20",
    node: (
      <div className="space-y-3">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [&>button]:shrink-0">
          {POS_GROUPS.map((g) => (
            <button key={g} type="button" onClick={() => setGroup(g)} className={`min-h-9 px-3 text-xs ${group === g ? "bx-chip bx-chip-on" : "bx-chip"}`}>
              {g}
            </button>
          ))}
        </div>
        <ol className="space-y-2 md:hidden">
          {d.byGroup[group].map((b, i) => {
            const p = P(b.playerId);
            if (!p) return null;
            const c = collegeLine(save, p);
            return (
              <li key={b.playerId} className="border border-white/10 bg-black/35 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-baseline gap-2">
                      <span className="bug-num text-lg text-muted">{i + 1}</span>
                      <Who id={b.playerId} />
                    </p>
                    <p className="text-xs text-muted">
                      {p.pos} · {p.college ?? "—"} · {meas(b.playerId)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Grade g={b.grade} />
                    <p className="mt-1 font-display text-xs font-bold italic">Rd {b.projRound} · #{b.rank}</p>
                  </div>
                </div>
                <p className="tabular mt-1.5 text-sm text-paper">{c.line}</p>
                <p className="text-xs text-subtle">
                  {c.label}
                  {c.honor ? <span className="ml-2 font-display font-bold uppercase italic text-brass">{c.honor}</span> : null}
                  {p.realRound ? ` · went Rd ${p.realRound} in real life` : ""}
                </p>
              </li>
            );
          })}
        </ol>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Prospect</th>
                <th className="px-2 py-2">School</th>
                <th className="px-2 py-2">Ht · Wt · 40</th>
                <th className="px-2 py-2">Final college season</th>
                <th className="px-2 py-2">Grade</th>
                <th className="px-2 py-2">Proj.</th>
                <th className="px-2 py-2">Board</th>
              </tr>
            </thead>
            <tbody>
              {d.byGroup[group].map((b, i) => {
                const p = P(b.playerId);
                if (!p) return null;
                const c = collegeLine(save, p);
                return (
                  <tr key={b.playerId} className="border-t border-white/5 align-top">
                    <td className="tabular px-2 py-2 text-muted">{i + 1}</td>
                    <td className="px-2 py-2">
                      <Who id={b.playerId} />
                      <span className="block text-xs text-muted">
                        {p.pos}
                        {p.realRound ? ` · went Rd ${p.realRound} in real life` : ""}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-muted">{p.college ?? "—"}</td>
                    <td className="tabular px-2 py-2 text-muted">{meas(b.playerId)}</td>
                    <td className="px-2 py-2">
                      <span className="tabular text-paper">{c.line}</span>
                      <span className="block text-xs text-subtle">
                        {c.label}
                        {c.honor ? <span className="ml-2 font-display font-bold uppercase italic text-brass">{c.honor}</span> : null}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <Grade g={b.grade} />
                    </td>
                    <td className="px-2 py-2 font-display font-bold italic">Rd {b.projRound}</td>
                    <td className="tabular px-2 py-2 text-muted">#{b.rank}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-subtle">
          Grades are the scouting department&apos;s read, not the sealed truth. College lines are season estimates built from the scouting
          grade; the game has no college box scores.
        </p>
      </div>
    ),
  });

  if (d.combine.length || d.sleepers.length) {
    segs.push({
      id: "extras",
      title: "Combine standouts & sleepers",
      node: (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 font-display text-sm font-bold uppercase italic tracking-wide text-brass">Workout warriors</p>
            <ul className="space-y-2">
              {d.combine.map((c) => (
                <li key={c.playerId} className="border-l-2 border-red pl-3">
                  <Who id={c.playerId} />
                  <span className="block text-sm text-muted">
                    {P(c.playerId)?.pos} · {P(c.playerId)?.college}: {c.note}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 font-display text-sm font-bold uppercase italic tracking-wide text-brass">Sleepers · graded like early picks, projected day three</p>
            <ul className="space-y-2">
              {d.sleepers.map((b) => (
                <li key={b.playerId} className="flex items-center justify-between gap-2 border-l-2 border-brass pl-3">
                  <span>
                    <Who id={b.playerId} />
                    <span className="block text-sm text-muted">
                      {P(b.playerId)?.pos} · {P(b.playerId)?.college} · board #{b.rank}, projected Rd {b.projRound}
                    </span>
                  </span>
                  <Grade g={b.grade} />
                </li>
              ))}
              {!d.sleepers.length && <li className="text-sm text-muted">No hidden gems on this board. The grades and the projections agree.</li>}
            </ul>
          </div>
        </div>
      ),
    });
  }

  return (
    <article className="relative overflow-hidden rounded-xl border border-white/10 bg-studio shadow-[0_30px_80px_-30px_#000]">
      <FilmStill still="draft" veil="bottom" className="h-[440px]" />
      <div className="relative">
        <header className="sheen border-b border-white/10 px-5 pb-6 pt-8 sm:px-8 sm:pt-12">
          <p className="font-display text-xs font-bold uppercase italic tracking-[0.3em] text-brass">Draft week · live from the war room</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
            <h2 className="bg-gradient-to-b from-white via-[#e9edf3] to-[#9aa4b4] bg-clip-text pr-2 text-5xl font-black leading-[0.85] text-transparent sm:text-7xl">
              Draft Preview
            </h2>
            <span className="bx-primary mb-1 inline-flex px-3 py-1 font-display text-sm font-extrabold uppercase italic tracking-wider [transform:skewX(-12deg)]">
              <span className="[transform:skewX(12deg)]">
                {d.year} {sessionLabel(save)}
              </span>
            </span>
          </div>
          <ul className="mt-4 max-w-3xl space-y-1.5 text-[15px] text-paper">
            {d.storylines.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-2 h-2 w-2 shrink-0 bg-red [transform:skewX(-18deg)]" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Btn kind="primary" onClick={() => setTab("draft")}>
              To the draft room <span aria-hidden>▸</span>
            </Btn>
          </div>
        </header>
        <nav aria-label="Show rundown" className="flex flex-wrap gap-2 px-5 py-3">
          {segs.map((s) => (
            <a key={s.id} href={`#dp-${s.id}`} className="bx-chip px-3 py-1.5 text-[12px]">
              {s.title}
            </a>
          ))}
        </nav>
        {segs.map((s, i) => (
          <Segment key={s.id} id={s.id} n={i + 1} title={s.title}>
            {s.node}
          </Segment>
        ))}
      </div>
    </article>
  );
}


