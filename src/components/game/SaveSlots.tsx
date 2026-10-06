/**
 * The title screen's save slots: pick which dynasty to play, start a new one in an empty
 * slot without touching the others, or clear a slot.
 */
import { useEffect, useState } from "react";
import type { TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { SLOT_COUNT, slotIndex, type SlotMeta } from "@/lib/save-slots";
import { Logo } from "./chrome";

const KIND_LABEL: Record<SlotMeta["kind"], string> = { dynasty: "Dynasty", watch: "Watch history", history: "History mode" };

function when(t: number): string {
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SaveSlots() {
  const slot = useGameStore((s) => s.slot);
  const save = useGameStore((s) => s.save);
  const switchSlot = useGameStore((s) => s.switchSlot);
  const clearSlot = useGameStore((s) => s.clearSlot);
  const continueGame = useGameStore((s) => s.continueGame);
  const [index, setIndex] = useState<Record<number, SlotMeta>>({});
  const [confirm, setConfirm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // The index lives in localStorage and changes as saves are written; re-read when the save does.
  useEffect(() => setIndex(slotIndex()), [save, slot]);

  const go = async (n: number, play: boolean) => {
    setBusy(true);
    try {
      await switchSlot(n);
      if (play && slotIndex()[n]) continueGame();
    } finally {
      setBusy(false);
      setIndex(slotIndex());
    }
  };

  return (
    <section aria-label="Save slots" className="space-y-2">
      <p className="text-xs tracking-[0.25em] text-muted">SAVE SLOTS</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((n) => {
          const m = index[n];
          const on = n === slot;
          return (
            <li
              key={n}
              className={`flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2 ${on ? "border-brass bg-brass/10" : "border-line bg-black/40"}`}
            >
              <span className="tabular w-5 shrink-0 font-display text-lg text-muted">{n}</span>
              {m?.teamId ? <Logo id={m.teamId as TeamId} year={m.year} size={28} /> : <span className="w-7 shrink-0" />}
              <span className="min-w-0 flex-1">
                {m ? (
                  <>
                    <span className="block truncate text-sm text-paper">{m.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {KIND_LABEL[m.kind]} · {m.year} · {m.weekLabel} · {when(m.t)}
                    </span>
                  </>
                ) : (
                  <span className="block text-sm text-subtle">Empty slot</span>
                )}
              </span>
              {confirm === n ? (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="min-h-11 rounded-md border border-brick px-3 text-xs text-brick"
                    disabled={busy}
                    onClick={() => {
                      setConfirm(null);
                      void clearSlot(n).then(() => setIndex(slotIndex()));
                    }}
                  >
                    Delete
                  </button>
                  <button type="button" className="min-h-11 rounded-md border border-line px-3 text-xs" onClick={() => setConfirm(null)}>
                    Keep
                  </button>
                </span>
              ) : (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="min-h-11 rounded-md border border-line px-3 text-xs text-paper hover:border-brass disabled:opacity-50"
                    disabled={busy || (on && !m)}
                    onClick={() => void go(n, !!m)}
                    aria-label={m ? `${on ? "Play" : "Load"} slot ${n}` : `Use slot ${n}`}
                  >
                    {m ? (on ? "Play" : "Load") : on ? "In use" : "Use"}
                  </button>
                  {m && (
                    <button
                      type="button"
                      className="min-h-11 rounded-md border border-line px-2 text-xs text-muted hover:text-brick"
                      aria-label={`Delete slot ${n}`}
                      onClick={() => setConfirm(n)}
                    >
                      ✕
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-subtle">New games start in the highlighted slot. Pick an empty one to keep your other saves.</p>
    </section>
  );
}
