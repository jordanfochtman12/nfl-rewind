import { playerName, rosterOf, type Player, type Pos, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";

function slot(saveTeam: Player[], pos: Pos, n = 0): Player | undefined {
  return saveTeam
    .filter((p) => p.pos === pos && !p.onIR)
    .sort((a, b) => {
      const ai = a.injuredWeeks > 0 ? 1 : 0;
      const bi = b.injuredWeeks > 0 ? 1 : 0;
      if (ai !== bi) return ai - bi;
      return b.ovr - a.ovr;
    })[n];
}

function Chip({ p, label }: { p?: Player; label: string }) {
  const openProfile = useGameStore((s) => s.openProfile);
  if (!p) {
    return (
      <div className="min-w-[72px] rounded-md border border-white/15 bg-black/30 px-2 py-1 text-center text-[10px] text-white/50">
        {label}
      </div>
    );
  }
  const hurt = p.injuredWeeks > 0;
  return (
    <button
      type="button"
      onClick={() => openProfile(p.id)}
      className={`min-w-[84px] rounded-md border px-2 py-1 text-center ${
        hurt ? "border-brick/70 bg-brick/40" : "border-white/20 bg-black/45"
      }`}
    >
      <p className="text-[10px] tracking-wider text-white/60">{label}</p>
      <p className="truncate font-display text-xs text-white">{playerName(p).split(" ").slice(-1)}</p>
      <p className="tabular text-[10px] text-white/70">
        {p.ovr}
        {hurt ? " · OUT" : ""}
      </p>
    </button>
  );
}

export function DepthField({ teamId }: { teamId?: TeamId }) {
  const save = useGameStore((s) => s.save)!;
  const id = teamId ?? save.userTeamId;
  const r = rosterOf(save, id);
  const qb = slot(r, "QB");
  const rb = slot(r, "RB");
  const fb = slot(r, "FB");
  const wr1 = slot(r, "WR", 0);
  const wr2 = slot(r, "WR", 1);
  const te = slot(r, "TE");
  const lt = slot(r, "LT");
  const lg = slot(r, "LG");
  const c = slot(r, "C");
  const rg = slot(r, "RG");
  const rt = slot(r, "RT");
  const de1 = slot(r, "DE", 0);
  const dt1 = slot(r, "DT", 0);
  const dt2 = slot(r, "DT", 1);
  const de2 = slot(r, "DE", 1);
  const olb1 = slot(r, "OLB", 0);
  const mlb = slot(r, "MLB");
  const olb2 = slot(r, "OLB", 1);
  const cb1 = slot(r, "CB", 0);
  const cb2 = slot(r, "CB", 1);
  const s1 = slot(r, "S", 0);
  const s2 = slot(r, "S", 1);
  const k = slot(r, "K");
  const p = slot(r, "P");
  return (
    <div className="space-y-4">
      <div
        className="overflow-x-auto rounded-xl border border-line p-4"
        style={{ background: "linear-gradient(#2f5a3a, #24482e 50%, #2f5a3a)" }}
      >
        <p className="mb-3 text-center text-[11px] tracking-[0.4em] text-white/70">OFFENSE</p>
        <div className="flex justify-around">
          <Chip p={wr1} label="WR" />
          <Chip p={te} label="TE" />
          <Chip p={wr2} label="WR" />
        </div>
        <div className="mt-3 flex justify-center gap-1">
          <Chip p={lt} label="LT" />
          <Chip p={lg} label="LG" />
          <Chip p={c} label="C" />
          <Chip p={rg} label="RG" />
          <Chip p={rt} label="RT" />
        </div>
        <div className="mt-3 flex justify-center">
          <Chip p={qb} label="QB" />
        </div>
        <div className="mt-3 flex justify-center gap-6">
          <Chip p={fb} label="FB" />
          <Chip p={rb} label="RB" />
        </div>

        <div className="my-5 h-px bg-white/20" />
        <p className="mb-3 text-center text-[11px] tracking-[0.4em] text-white/70">DEFENSE</p>
        <div className="flex justify-center gap-1">
          <Chip p={de1} label="DE" />
          <Chip p={dt1} label="DT" />
          <Chip p={dt2} label="DT" />
          <Chip p={de2} label="DE" />
        </div>
        <div className="mt-3 flex justify-center gap-3">
          <Chip p={olb1} label="OLB" />
          <Chip p={mlb} label="MLB" />
          <Chip p={olb2} label="OLB" />
        </div>
        <div className="mt-3 flex justify-around">
          <Chip p={cb1} label="CB" />
          <Chip p={s1} label="S" />
          <Chip p={s2} label="S" />
          <Chip p={cb2} label="CB" />
        </div>
        <div className="mt-5 flex justify-center gap-4">
          <Chip p={k} label="K" />
          <Chip p={p} label="P" />
        </div>
      </div>
    </div>
  );
}
