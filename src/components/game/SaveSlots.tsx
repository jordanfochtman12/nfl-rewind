/**
 * The title screen's save slots: pick which dynasty to play, start a new one in an empty
 * slot without touching the others, or clear a slot.
 */
import { useEffect, useRef, useState } from "react";
import type { TeamId } from "@/lib/game";
import { flushSaves, useGameStore } from "@/lib/game-store";
import { SLOT_COUNT, slotIndex, type SlotMeta } from "@/lib/save-slots";
import { downloadText, duplicateSlot, fmtBytes, recoverSlots, slotBytes, slotExport, storageRoom } from "@/lib/save-tools";
import { Logo } from "./chrome";

const KIND_LABEL: Record<SlotMeta["kind"], string> = { dynasty: "Dynasty", watch: "Watch history", history: "History mode" };

function when(t: number): string {
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SaveSlots() {
  const storeSlot = useGameStore((s) => s.slot);
  // The active slot lives in this browser's storage; the server can't know it, so the first
  // paint uses slot 1 (as the server did) and the real one comes in after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const slot = mounted ? storeSlot : 1;
  const save = useGameStore((s) => s.save);
  const switchSlot = useGameStore((s) => s.switchSlot);
  const clearSlot = useGameStore((s) => s.clearSlot);
  const continueGame = useGameStore((s) => s.continueGame);
  const [index, setIndex] = useState<Record<number, SlotMeta>>({});
  const [confirm, setConfirm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [bytes, setBytes] = useState<Record<number, number>>({});
  const [room, setRoom] = useState<{ used: number; quota: number } | null>(null);
  const [note, setNote] = useState("");
  const [menu, setMenu] = useState<number | null>(null);
  const importJson = useGameStore((s) => s.importJson);
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreTo = useRef<number>(1);
  // The index lives in localStorage and changes as saves are written; re-read when the save does.
  useEffect(() => setIndex(slotIndex()), [save, slot]);
  // Saves the list lost track of come back on it (once per visit to the title screen). Anything
  // still waiting to be written goes first, so the list shows the game just left.
  useEffect(() => {
    let live = true;
    void flushSaves()
      .then(() => {
        if (live) setIndex(slotIndex());
        return recoverSlots();
      })
      .then((n) => {
      if (!live || !n) return;
      setIndex(slotIndex());
      setNote(`Found ${n} saved ${n === 1 ? "dynasty" : "dynasties"} that had dropped off the list.`);
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    void (async () => {
      const out: Record<number, number> = {};
      for (let n = 1; n <= SLOT_COUNT; n++) out[n] = await slotBytes(n);
      const r = await storageRoom();
      if (live) {
        setBytes(out);
        setRoom(r);
      }
    })();
    return () => {
      live = false;
    };
  }, [index]);
  const firstEmpty = Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).find((n) => !index[n]);
  const backup = async (n: number) => {
    const text = await slotExport(n);
    const m = index[n];
    if (!text || !m) return setNote("That slot is empty.");
    downloadText(`nfl-rewind-slot${n}-${m.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${m.year}.json`, text);
    setNote(`Slot ${n} backed up to a file.`);
  };
  const duplicate = async (n: number) => {
    if (!firstEmpty) return setNote("No empty slot to copy into. Clear one first.");
    const ok = await duplicateSlot(n, firstEmpty);
    setIndex(slotIndex());
    setNote(ok ? `Copied slot ${n} into slot ${firstEmpty}.` : "Couldn't copy that slot.");
  };
  const restore = (n: number) => {
    restoreTo.current = n;
    fileRef.current?.click();
  };

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
              className={`flex min-h-16 flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${on ? "border-brass bg-brass/10" : "border-line bg-black/40"}`}
            >
              <span className="tabular w-5 shrink-0 font-display text-lg text-muted">{n}</span>
              {m?.teamId ? <Logo id={m.teamId as TeamId} year={m.year} size={28} /> : <span className="w-7 shrink-0" />}
              <span className="min-w-0 flex-1">
                {m ? (
                  <>
                    <span className="block truncate text-sm text-paper">{m.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {KIND_LABEL[m.kind]} · {m.year} · {m.weekLabel} · {when(m.t)}
                      {bytes[n] ? ` · ${fmtBytes(bytes[n]!)}` : ""}
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
                  <button
                    type="button"
                    className={`min-h-11 rounded-md border border-line px-2 text-xs text-muted hover:text-white ${menu === n ? "border-brass text-white" : ""}`}
                    aria-label={`More for slot ${n}`}
                    aria-expanded={menu === n}
                    onClick={() => setMenu(menu === n ? null : n)}
                  >
                    ⋯
                  </button>
                </span>
              )}
              {menu === n && (
                <span className="flex w-full flex-wrap gap-1.5 pt-1">
                  {m && (
                    <button type="button" className="bx-chip min-h-9 px-3 text-[11px]" disabled={busy} onClick={() => void backup(n)}>
                      Back up to file
                    </button>
                  )}
                  {m && firstEmpty && (
                    <button type="button" className="bx-chip min-h-9 px-3 text-[11px]" disabled={busy} onClick={() => void duplicate(n)}>
                      Copy to slot {firstEmpty}
                    </button>
                  )}
                  <button type="button" className="bx-chip min-h-9 px-3 text-[11px]" disabled={busy} onClick={() => restore(n)}>
                    {m ? "Replace from file" : "Restore from file"}
                  </button>
                  {m && (
                    <button type="button" className="bx-chip min-h-9 px-3 text-[11px] text-brick" onClick={() => setConfirm(n)}>
                      Delete
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Restore a save file into a slot"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const n = restoreTo.current;
          void (async () => {
            setBusy(true);
            try {
              const text = await f.text();
              await switchSlot(n);
              importJson(text);
              setNote(`Restored into slot ${n}.`);
            } catch {
              setNote("That file couldn't be restored. Choose an NFL Rewind save file.");
            } finally {
              setBusy(false);
              setMenu(null);
              setIndex(slotIndex());
            }
          })();
        }}
      />
      {note && <p className="text-xs text-brass" aria-live="polite">{note}</p>}
      {room && (
        <p className="text-xs text-subtle">
          Saves use {fmtBytes(Object.values(bytes).reduce((a, b) => a + b, 0))} · browser storage {fmtBytes(room.used)} of {fmtBytes(room.quota)} used
        </p>
      )}
      <p className="text-xs text-subtle">Each new game takes its own empty slot, so your other saves stay put. Tap Load to switch dynasties.</p>
    </section>
  );
}
