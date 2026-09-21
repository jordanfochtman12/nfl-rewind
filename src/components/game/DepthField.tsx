import { playerName, starterCount, starters, type Player, type Pos, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";

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
        hurt ? "border-brick/70 bg-brick/40" : "border-brass/60 bg-black/45"
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
  const team = save.teams[id];
  const off = team.offScheme;
  const def = team.defScheme;
  const at = (pos: Pos) => starters(save, id, pos, starterCount(pos, off, def));

  const wr = at("WR");
  const te = at("TE");
  const fb = at("FB");
  const rb = at("RB");
  const qb = at("QB");
  const lt = at("LT")[0];
  const lg = at("LG")[0];
  const c = at("C")[0];
  const rg = at("RG")[0];
  const rt = at("RT")[0];
  const de = at("DE");
  const dt = at("DT");
  const olb = at("OLB");
  const mlb = at("MLB");
  const cb = at("CB");
  const s = at("S");
  const k = at("K")[0];
  const p = at("P")[0];

  const dl: { p?: Player; label: string }[] =
    def === "3-4"
      ? [
          { p: de[0], label: "DE" },
          { p: dt[0], label: "NT" },
          { p: de[1], label: "DE" },
        ]
      : [
          { p: de[0], label: "DE" },
          { p: dt[0], label: "DT" },
          { p: dt[1], label: "DT" },
          { p: de[1], label: "DE" },
        ];
  const lb: { p?: Player; label: string }[] =
    def === "3-4"
      ? [
          { p: olb[0], label: "OLB" },
          { p: mlb[0], label: "ILB" },
          { p: mlb[1], label: "ILB" },
          { p: olb[1], label: "OLB" },
        ]
      : [
          { p: olb[0], label: "OLB" },
          { p: mlb[0], label: "MLB" },
          { p: olb[1], label: "OLB" },
        ];

  return (
    <div className="space-y-4">
      <div
        className="overflow-x-auto rounded-xl border border-line p-4"
        style={{ background: "linear-gradient(#2f5a3a, #24482e 50%, #2f5a3a)" }}
      >
        <p className="mb-3 text-center text-[11px] tracking-[0.4em] text-white/70">
          OFFENSE · {off.toUpperCase()}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {wr[0] && <Chip p={wr[0]} label="WR" />}
          {te.map((x) => (
            <Chip key={x.id} p={x} label="TE" />
          ))}
          {wr.slice(1).map((x) => (
            <Chip key={x.id} p={x} label="WR" />
          ))}
        </div>
        <div className="mt-3 flex justify-center gap-1">
          <Chip p={lt} label="LT" />
          <Chip p={lg} label="LG" />
          <Chip p={c} label="C" />
          <Chip p={rg} label="RG" />
          <Chip p={rt} label="RT" />
        </div>
        <div className="mt-3 flex justify-center">
          <Chip p={qb[0]} label="QB" />
        </div>
        <div className="mt-3 flex justify-center gap-6">
          {fb[0] && <Chip p={fb[0]} label="FB" />}
          <Chip p={rb[0]} label="RB" />
        </div>

        <div className="my-5 h-px bg-white/20" />
        <p className="mb-3 text-center text-[11px] tracking-[0.4em] text-white/70">
          DEFENSE · {def.toUpperCase()}
        </p>
        <div className="flex flex-wrap justify-center gap-1">
          {dl.map((x, i) => (
            <Chip key={x.p?.id ?? `dl-${i}`} p={x.p} label={x.label} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          {lb.map((x, i) => (
            <Chip key={x.p?.id ?? `lb-${i}`} p={x.p} label={x.label} />
          ))}
        </div>
        <div className="mt-3 flex justify-around">
          <Chip p={cb[0]} label="CB" />
          <Chip p={s[0]} label="S" />
          <Chip p={s[1]} label="S" />
          <Chip p={cb[1]} label="CB" />
        </div>
        <div className="mt-5 flex justify-center gap-4">
          <Chip p={k} label="K" />
          <Chip p={p} label="P" />
        </div>
      </div>
    </div>
  );
}
