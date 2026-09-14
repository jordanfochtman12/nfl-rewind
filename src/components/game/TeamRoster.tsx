import { useEffect } from "react";
import { displayName, rosterOf, teamColors, visibleOvr } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { KitChips } from "./KitChips";
import { PlayerLink } from "./PlayerProfile";

export function TeamRosterModal() {
  const save = useGameStore((s) => s.save);
  const viewTeamId = useGameStore((s) => s.viewTeamId);
  const closeTeam = useGameStore((s) => s.closeTeam);
  const openProfile = useGameStore((s) => s.openProfile);

  useEffect(() => {
    if (!viewTeamId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTeam();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewTeamId, closeTeam]);

  if (!save || !viewTeamId) return null;

  const colors = teamColors(viewTeamId, save.year);
  const coachId = save.teams[viewTeamId]?.coachId;
  const coach = coachId ? save.coaches[coachId] : undefined;
  const rows = rosterOf(save, viewTeamId)
    .slice()
    .sort((a, b) => visibleOvr(b) - visibleOvr(a));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-studio/80 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Close roster" onClick={closeTeam} />
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-roster-name"
        className="relative z-10 flex max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-none border-0 border-line bg-bg sm:max-h-[92dvh] sm:rounded-xl sm:border"
      >
        <header className="chrome-bevel flex items-center gap-4 border-b border-line bg-surface px-4 py-4 sm:px-5">
          <div
            className="flex size-16 shrink-0 items-center justify-center rounded-lg sm:size-20"
            style={{ background: colors.primary }}
          >
            <Logo id={viewTeamId} size={48} year={save.year} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-[0.3em] text-brass">{save.year} ROSTER</p>
            <h2 id="team-roster-name" className="font-display text-3xl leading-none sm:text-4xl">
              {displayName(save.year, viewTeamId)}
            </h2>
            <p className="mt-1 text-sm text-muted">
              HC {coach?.name ?? "—"} · {rows.length} on the roster
            </p>
          </div>
          <button
            type="button"
            onClick={closeTeam}
            aria-label="Close"
            className="chrome-bevel inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-surface-2 text-fg hover:brightness-110"
          >
            ✕
          </button>
        </header>
        <div className="overflow-y-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs tracking-wider text-muted">
              <tr>
                {["#", "Player", "Pos", "College", "Grade", "Age", "Kit", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="cursor-pointer border-t border-line hover:bg-surface-2" onClick={() => openProfile(p.id)}>
                  <td className="tabular px-3 py-2 text-muted">{p.jersey}</td>
                  <td className="px-3 py-2">
                    <PlayerLink player={p} className="font-display text-base" />
                  </td>
                  <td className="px-3 py-2">{p.pos}</td>
                  <td className="px-3 py-2 text-muted">{p.college ?? "—"}</td>
                  <td className="tabular px-3 py-2">{p.revealed ? p.ovr : `sc ${visibleOvr(p)}`}</td>
                  <td className="tabular px-3 py-2">{p.age}</td>
                  <td className="px-3 py-2">
                    <KitChips player={p} compact />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.onIR ? (
                      <span className="text-brick">IR</span>
                    ) : p.injuredWeeks > 0 ? (
                      <span className="text-brick">hurt · {p.injuredWeeks}w</span>
                    ) : (
                      <span className="text-good">active</span>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className="px-3 py-4 text-muted" colSpan={8}>
                    No roster yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
