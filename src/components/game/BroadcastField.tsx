import { memo, useId, useMemo, type CSSProperties } from "react";
import { Logo } from "./chrome";
import { fieldLook, teamAbbr, type FieldLook, type GameResult, type PlayLog, type TeamId } from "@/lib/game";

/*
 * The broadcast field, drawn to scale (12 units a yard) as vector art, so it is sharp at any
 * size or pixel density: real hash spacing and goal-post position for the year, grass with mow
 * stripes and wear, 1970s AstroTurf with its seams or modern FieldTurf, end zones and the
 * midfield mark as the club painted them, a baseball infield on a shared ballpark, snow, rain
 * and stadium lights. The play sits on a separate layer so the ball's flight never repaints
 * the field.
 */

const U = 12; // units per yard
const PAD = 30;
const X0 = PAD; // left end line
const GL = X0 + 10 * U; // left goal line
const GR = GL + 100 * U; // right goal line
const XE = GR + 10 * U; // right end line
const Y0 = PAD; // far sideline
const W = 160 / 3; // 53 1/3 yards
const Y1 = Y0 + W * U; // near sideline
const MID = (Y0 + Y1) / 2;
const VW = XE + PAD;
const VH = Y1 + PAD;
const yx = (yardFromLeftGoal: number) => GL + yardFromLeftGoal * U;

function Defs({ look, id }: { look: FieldLook; id: string }) {
  const grass = look.surface === "grass";
  const turf = look.surface === "astroturf";
  // Grass blades: fine noise stretched along the mow direction, a dark pass and a light one.
  const dark = grass ? "0 0 0 0 0.04  0 0 0 0 0.16  0 0 0 0 0.03  0 0 0 1.25 -0.52" : turf ? "0 0 0 0 0.05  0 0 0 0 0.25  0 0 0 0 0.08  0 0 0 0.9 -0.5" : "0 0 0 0 0.03  0 0 0 0 0.12  0 0 0 0 0.04  0 0 0 1.1 -0.5";
  const light = grass ? "0 0 0 0 0.62  0 0 0 0 0.82  0 0 0 0 0.38  0 0 0 1.2 -0.78" : "0 0 0 0 0.6  0 0 0 0 0.8  0 0 0 0 0.6  0 0 0 0.8 -0.6";
  const freq = grass ? "1.1 0.32" : turf ? "2.6 2.6" : "1.8 0.9";
  return (
    <defs>
      <filter id={`${id}-blades`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={grass ? 4 : 2} seed="7" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values={dark} />
      </filter>
      <filter id={`${id}-glint`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency={grass ? "0.9 0.25" : "3 3"} numOctaves="3" seed="19" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values={light} />
      </filter>
      <filter id={`${id}-patch`} x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="3" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="60" />
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <filter id={`${id}-snow`} x="0" y="0" width="100%" height="100%">
        {/* A dusting that drifts: broad banks plus fine flakes, never a solid white sheet. */}
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="2" seed="11" result="bank" />
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="23" result="flake" />
        <feComposite in="bank" in2="flake" operator="arithmetic" k1="0" k2="0.75" k3="0.6" k4="-0.35" />
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.8 -0.25" />
      </filter>
      <linearGradient id={`${id}-sun`} x1="0" y1="0" x2="0" y2="1">
        {/* Day games: the stands throw a shadow across the far side of the field. */}
        <stop offset="0" stopColor="#000" stopOpacity={look.night ? 0 : 0.28} />
        <stop offset="0.22" stopColor="#000" stopOpacity={look.night ? 0 : 0.1} />
        <stop offset="0.24" stopColor="#fff" stopOpacity={look.night ? 0 : 0.05} />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${id}-lights`} cx="0.5" cy="0.5" r="0.75">
        <stop offset="0" stopColor="#fffbe8" stopOpacity={look.night ? 0.16 : 0.06} />
        <stop offset="0.7" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity={look.night ? 0.45 : 0.25} />
      </radialGradient>
      <linearGradient id={`${id}-wet`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#bfe3ff" stopOpacity="0.14" />
        <stop offset="0.5" stopColor="#bfe3ff" stopOpacity="0" />
        <stop offset="1" stopColor="#bfe3ff" stopOpacity="0.12" />
      </linearGradient>
      {(["left", "right"] as const).map((side) => {
        const z = look[side];
        if (z.style !== "stripes") return null;
        return (
          <pattern key={side} id={`${id}-${side}-stripes`} width={U * 3} height={U * 3} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={U * 3} height={U * 3} fill={z.fill} />
            <rect width={U * 1.5} height={U * 3} fill={z.stripe} />
          </pattern>
        );
      })}
      <clipPath id={`${id}-field`}>
        <rect x={X0} y={Y0} width={XE - X0} height={Y1 - Y0} />
      </clipPath>
    </defs>
  );
}

function EndZone({ look, side, id }: { look: FieldLook; side: "left" | "right"; id: string }) {
  const z = look[side];
  const x = side === "left" ? X0 : GR;
  const cx = x + 5 * U;
  const fill = z.style === "stripes" ? `url(#${id}-${side}-stripes)` : z.fill;
  const size = Math.min(7.2 * U, ((W - 6) * U) / Math.max(4, z.text.length * 0.62));
  return (
    <g>
      <rect x={x} y={Y0} width={10 * U} height={W * U} fill={fill} />
      {z.style !== "plain" && <rect x={x} y={Y0} width={10 * U} height={W * U} filter={`url(#${id}-blades)`} opacity=".35" />}
      <text
        x={cx}
        y={MID}
        transform={`rotate(${side === "left" ? -90 : 90} ${cx} ${MID})`}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Barlow Condensed', 'Oswald', Impact, sans-serif"
        fontWeight="900"
        fontSize={size}
        letterSpacing={size * 0.06}
        fill={z.textFill}
        stroke={z.textStroke}
        strokeWidth={size * 0.06}
        paintOrder="stroke"
        strokeLinejoin="round"
      >
        {z.text}
      </text>
    </g>
  );
}

/** A baseball diamond laid over one end: a full skin infield on grass, base cut-outs on turf. */
function Infield({ look }: { look: FieldLook }) {
  if (!look.dirt) return null;
  // Home plate sits off the near corner behind the left end zone; the diamond opens up-field.
  const hx = X0 - 2 * U;
  const hy = Y1 + 2 * U;
  const r = Math.SQRT1_2;
  const at = (along: number, across: number): [number, number] => [hx + (along + across) * r * U, hy - (along - across) * r * U];
  const bases = [at(30, 0), at(30, 30), at(0, 30)];
  const mound = at(20.2, 20.2);
  const dirt = "#a8794c";
  if (look.dirt === "cutouts")
    return (
      <g opacity=".95">
        {[...bases, at(1.5, 1.5)].map(([bx, by], i) => (
          <circle key={i} cx={bx} cy={by} r={2.2 * U} fill={dirt} />
        ))}
        <circle cx={mound[0]} cy={mound[1]} r={3 * U} fill={dirt} />
      </g>
    );
  // The infield grass: the diamond inside the base paths.
  const g = (a: number, b: number) => at(a, b).join(" ");
  return (
    <g>
      <circle cx={mound[0]} cy={mound[1]} r={31.7 * U} fill={dirt} />
      <path d={`M${g(3, 3)} L${g(27, 3)} L${g(27, 27)} L${g(3, 27)} Z`} fill={look.green} opacity=".97" />
      <circle cx={mound[0]} cy={mound[1]} r={3 * U} fill={dirt} />
      {bases.map(([bx, by], i) => (
        <rect key={i} x={bx - U * 0.5} y={by - U * 0.5} width={U} height={U} fill="#f3eee2" opacity=".55" transform={`rotate(45 ${bx} ${by})`} />
      ))}
    </g>
  );
}

function GoalPost({ look, side }: { look: FieldLook; side: "left" | "right" }) {
  const x = look.postsAt === "goal" ? (side === "left" ? GL : GR) : side === "left" ? X0 : XE;
  const out = side === "left" ? -1 : 1;
  const half = (18.5 / 3 / 2) * U; // 18'6" between the uprights
  const c = look.postColor;
  // A long shadow up-field: the uprights stand 30-plus feet.
  return (
    <g>
      <path d={`M${x} ${MID - half} l${-out * 2 * U} ${-9 * U} M${x} ${MID + half} l${-out * 2 * U} ${-9 * U}`} stroke="#00000055" strokeWidth={U * 0.35} strokeLinecap="round" />
      {look.postStyle === "slingshot" ? (
        <>
          <path d={`M${x + out * 2 * U} ${MID} q${-out * 1.5 * U} 0 ${-out * 2 * U} 0`} stroke={c} strokeWidth={U * 0.55} fill="none" />
          <circle cx={x + out * 2 * U} cy={MID} r={U * 0.8} fill="#1f2a44" stroke={c} strokeWidth={U * 0.2} />
        </>
      ) : (
        [MID - half, MID + half].map((y) => <circle key={y} cx={x} cy={y} r={U * 0.55} fill="#e9e6dc" />)
      )}
      <line x1={x} x2={x} y1={MID - half} y2={MID + half} stroke={c} strokeWidth={U * 0.4} strokeLinecap="round" />
      <circle cx={x} cy={MID - half} r={U * 0.3} fill={c} />
      <circle cx={x} cy={MID + half} r={U * 0.3} fill={c} />
    </g>
  );
}

const arrow = (x: number, y: number, dir: number) => `M${x} ${y} l${dir * U * 0.9} ${-U * 0.45} v${U * 0.9} Z`;

function Markings({ look }: { look: FieldLook }) {
  const white = "#f7f7f2";
  const lines = [];
  for (let yd = 0; yd <= 100; yd += 5) {
    const goal = yd === 0 || yd === 100;
    lines.push(<line key={`l${yd}`} x1={yx(yd)} x2={yx(yd)} y1={Y0} y2={Y1} stroke={white} strokeWidth={goal ? U * 0.66 : U * 0.33} opacity={goal ? 1 : 0.92} />);
  }
  const h1 = Y0 + look.hashFromSideline * U;
  const h2 = Y1 - look.hashFromSideline * U;
  const hashes = [];
  for (let yd = 1; yd < 100; yd++) {
    if (yd % 5 === 0) continue;
    const x = yx(yd);
    hashes.push(
      <path key={`h${yd}`} d={`M${x} ${Y0 + U * 0.35}v${U * 0.67} M${x} ${Y1 - U * 0.35}v${-U * 0.67} M${x} ${h1 - U * 0.33}v${U * 0.67} M${x} ${h2 - U * 0.33}v${U * 0.67}`} stroke={white} strokeWidth={U * 0.3} opacity=".9" />,
    );
  }
  // The try line, 2 yards out.
  const tries = [2, 98].map((yd) => <line key={`t${yd}`} x1={yx(yd)} x2={yx(yd)} y1={MID - U * 0.5} y2={MID + U * 0.5} stroke={white} strokeWidth={U * 0.3} />);
  const nums = [];
  for (let yd = 10; yd <= 90; yd += 10) {
    const n = Math.min(yd, 100 - yd);
    const x = yx(yd);
    const font = { fontFamily: "'Clarendon', 'Roboto Slab', 'Rockwell', Georgia, serif", fontWeight: 700, fontSize: U * 2.4, fill: white, letterSpacing: 0 };
    // Numbers stand 6 feet tall, bottoms 12 yards in from each sideline; the far set reads upside down.
    const nearY = Y1 - 12 * U;
    const farY = Y0 + 12 * U;
    const ax = x + (yd < 50 ? -3.4 : 3.4) * U;
    const ad = yd < 50 ? 1 : -1; // the point aims at the nearer goal
    nums.push(
      <g key={`n${yd}`} opacity=".95">
        {/* Two digits either side of the yard line, as painted. */}
        {[nearY, farY].map((ny) => (
          <g key={ny} transform={ny === farY ? `rotate(180 ${x} ${ny})` : undefined}>
            <text x={x - U * 0.5} y={ny} {...font} textAnchor="end">
              {Math.floor(n / 10)}
            </text>
            <text x={x + U * 0.5} y={ny} {...font} textAnchor="start">
              {n % 10}
            </text>
          </g>
        ))}
        {look.arrows && n !== 50 && (
          <>
            <path d={arrow(ax, nearY - 0.9 * U, ad)} fill={white} />
            <path d={arrow(ax, farY + 0.9 * U, ad)} fill={white} />
          </>
        )}
      </g>,
    );
  }
  return (
    <g>
      {lines}
      {hashes}
      {tries}
      {nums}
      {/* The 6-foot white border around the playing field. */}
      <rect x={X0 - U} y={Y0 - U} width={XE - X0 + 2 * U} height={Y1 - Y0 + 2 * U} fill="none" stroke={white} strokeWidth={U * 2} />
      {look.pylons &&
        [X0, GL, GR, XE].flatMap((x) => [Y0, Y1].map((y) => <rect key={`${x}-${y}`} x={x - U * 0.2} y={y - U * 0.2} width={U * 0.4} height={U * 0.4} fill="#ff6a13" stroke="#b33e00" strokeWidth=".6" />))}
    </g>
  );
}

/** The field itself: memoized, so it paints once per game, not once per play. */
const Field = memo(function Field({ look, label }: { look: FieldLook; label: string }) {
  const id = useId().replace(/:/g, "");
  const box = { x: X0, y: Y0, width: XE - X0, height: Y1 - Y0 };
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="field-layer" role="img" aria-label={label} shapeRendering="geometricPrecision" textRendering="geometricPrecision">
      <Defs look={look} id={id} />
      <rect width={VW} height={VH} fill={look.apron} />
      <rect width={VW} height={VH} fill="#000" opacity=".22" />
      <g clipPath={`url(#${id}-field)`}>
        <rect {...box} fill={look.green} />
        {look.surface !== "astroturf" &&
          // Mowed (or, on FieldTurf, sewn) in alternating 5-yard bands.
          Array.from({ length: 10 }, (_, k) => <rect key={k} x={yx(k * 10)} y={Y0} width={5 * U} height={W * U} fill={look.stripe} />)}
        {look.surface === "astroturf" &&
          // The rolls ran the length of the field, 15 feet wide; the seams show.
          Array.from({ length: 10 }, (_, k) => <line key={k} x1={X0} x2={XE} y1={Y0 + (k + 1) * 5 * U} y2={Y0 + (k + 1) * 5 * U} stroke="#1d6b2c" strokeWidth="1" opacity=".6" />)}
        <rect {...box} filter={`url(#${id}-blades)`} />
        <rect {...box} filter={`url(#${id}-glint)`} opacity={look.surface === "grass" ? 0.55 : 0.25} />
        <Infield look={look} />
        {look.wear > 0.05 && (
          <g filter={`url(#${id}-patch)`} opacity={Math.min(0.85, look.wear)}>
            {/* Between the hashes, worst at midfield and in front of each goal. */}
            <ellipse cx={yx(50)} cy={MID} rx={22 * U} ry={7.5 * U} fill="#7a6640" opacity=".55" />
            <ellipse cx={yx(8)} cy={MID} rx={9 * U} ry={6 * U} fill="#6e5a37" opacity=".6" />
            <ellipse cx={yx(92)} cy={MID} rx={9 * U} ry={6 * U} fill="#6e5a37" opacity=".6" />
            <rect x={yx(15)} y={MID - 5 * U} width={70 * U} height={10 * U} fill="#7d6a45" opacity=".25" />
          </g>
        )}
        <EndZone look={look} side="left" id={id} />
        <EndZone look={look} side="right" id={id} />
        {look.snow && <rect {...box} filter={`url(#${id}-snow)`} opacity=".7" />}
        {look.midfield && <image href={look.midfield} x={yx(50) - 6 * U} y={MID - 6 * U} width={12 * U} height={12 * U} preserveAspectRatio="xMidYMid meet" opacity={look.snow ? 0.5 : 0.95} />}
        <rect {...box} fill={`url(#${id}-sun)`} />
        {look.rain && <rect {...box} fill={`url(#${id}-wet)`} />}
      </g>
      {/* Lines go down after the snow: the grounds crew swept them. */}
      <Markings look={look} />
      <GoalPost look={look} side="left" />
      <GoalPost look={look} side="right" />
      <rect width={VW} height={VH} fill={`url(#${id}-lights)`} pointerEvents="none" />
    </svg>
  );
});

/** Eleven on each side, set at the line: enough of a picture to read the snap. */
function formation(los: number, dir: number, kind: string | undefined) {
  const o: [number, number][] = [
    [-0.9, 0], [-0.9, -1.3], [-0.9, 1.3], [-0.9, -2.6], [-0.9, 2.6], // the line
    [-1.8, 3.9], // tight end
    [kind === "pass" ? -5 : -1.6, 0], // QB under center, or back in the pocket
    [-6.5, 0], // the back
    [-1.3, -18], [-1.3, 16], [-2.4, 11], // receivers
  ];
  const d: [number, number][] = [
    [1, -0.7], [1, 0.7], [1, -2.2], [1, 2.2], // front four
    [4.5, 0], [4.5, -4.5], [4.5, 4.5], // linebackers
    [6.5, -17], [6.5, 15], // corners
    [12, -6], [13.5, 6], // safeties
  ];
  const place = ([along, across]: [number, number]) => ({ x: los + dir * along * U, y: MID + across * U });
  return { offense: o.map(place), defense: d.map(place) };
}

const CALLS: Record<string, string> = { pa: "Play action", med: "Medium pass", deep: "Deep pass", short: "Short pass", fg: "Field goal try", punt: "Punt", special: "Special teams / stoppage", sneak: "QB sneak", kneel: "Victory formation", spike: "Clock stop" };

export function BroadcastField({
  play,
  home,
  away,
  homeColor,
  awayColor,
  playing,
  index,
  duration = 1100,
  year,
  game,
  driveStart,
  drivePlays = 0,
}: {
  /** Where this drive began (offense's own yard line) and how many snaps it's run. */
  driveStart?: number;
  drivePlays?: number;
  play: PlayLog;
  home: TeamId;
  away: TeamId;
  homeColor: string;
  awayColor: string;
  playing: boolean;
  index: number;
  duration?: number;
  /** The season: the field as it looked that year. */
  year?: number;
  /** The game: stadium, surface, weather, night, neutral site. */
  game?: Partial<GameResult>;
}) {
  const season = year ?? game?.year ?? 2000;
  const look = useMemo(() => fieldLook(season, home, away, game), [season, home, away, game]);
  const right = play.poss === away;
  const dir = right ? 1 : -1;
  const x = (spot: number) => yx(Math.max(-9, Math.min(109, right ? spot : 100 - spot)));
  const start = x(play.spot);
  const finish = x(play.spot + (play.snap?.yards ?? 0));
  const first = x(play.spot + play.togo);
  const color = play.poss === home ? homeColor : awayColor;
  const other = play.poss === home ? awayColor : homeColor;
  const moving = !!play.snap && ["run", "pass"].includes(play.snap.kind) && play.snap.yards !== 0;
  const callLabel = play.snap ? CALLS[play.snap.call] ?? play.snap.call : "";
  const tag = play.tag === "td" ? "TOUCHDOWN" : play.tag === "to" ? "TURNOVER" : play.tag === "fg" ? "FIELD GOAL" : play.tag === "safety" ? "SAFETY" : null;
  // Sportvision's yellow first-down line first aired in 1998; before it, the chains.
  const tv = season >= 1998;
  const team = formation(start, dir, play.snap?.kind);
  const surface = look.surface === "grass" ? "Natural grass" : look.surface === "astroturf" ? "AstroTurf" : "FieldTurf";
  const label = `${look.stadium}, ${surface.toLowerCase()}`;
  const kind = play.snap?.kind;
  // The red zone: inside the opponent's 20, the end the offense is attacking glows.
  const redZone = play.spot >= 80 && play.spot < 100;
  const rz0 = x(80);
  const rz1 = x(100);
  const drive = driveStart !== undefined && drivePlays > 1 && driveStart !== play.spot ? x(driveStart) : undefined;
  const downText = `${["", "1ST", "2ND", "3RD", "4TH"][Math.min(4, play.down)] ?? "4TH"} & ${play.spot + play.togo >= 100 ? "GOAL" : play.togo}`;
  // A run cuts once on its way; a pass flies; a sack drives the passer back.
  const path =
    kind === "pass"
      ? `M${start} ${MID} Q${(start + finish) / 2} ${MID - 14 * U} ${finish} ${MID}`
      : kind === "run"
        ? `M${start} ${MID} C${start + dir * 2 * U} ${MID + 4 * U} ${start + (finish - start) * 0.45} ${MID - 3 * U} ${finish} ${MID + U}`
        : `M${start} ${MID} L${finish} ${MID}`;
  const camX = `${((start / VW) * 100).toFixed(1)}%`;
  return (
    <div className="broadcast-field">
      <div className="flex flex-wrap justify-between gap-2 px-4 py-2 text-[11px] uppercase tracking-widest text-muted">
        <span>
          {look.stadium} · {surface} · {teamAbbr(play.poss)} {right ? "→" : "←"}
        </span>
        <span>
          {play.snap
            ? `${callLabel}${["kick", "other"].includes(play.snap.kind) ? "" : ` · ${play.snap.kind === "sack" ? "Sacked" : `${play.snap.yards} yds`}`}`
            : "Archived film · pre-snap position"}
        </span>
      </div>
      <div className="k5-cam" style={{ "--cam-x": camX } as CSSProperties}>
      <div className="field-stack" style={{ aspectRatio: `${VW} / ${VH}` }} role="group" aria-label={`${teamAbbr(play.poss)} at their ${play.spot}. ${play.text}`}>
        <Field look={look} label={label} />
        <svg viewBox={`0 0 ${VW} ${VH}`} className="field-layer" aria-hidden="true" shapeRendering="geometricPrecision">
          {redZone && (
            <g className="k5-redzone">
              <rect x={Math.min(rz0, rz1)} y={Y0} width={Math.abs(rz1 - rz0)} height={Y1 - Y0} fill="#ff1f3d" opacity=".22" />
              <text x={(rz0 + rz1) / 2} y={Y0 + U * 3.2} textAnchor="middle" fontSize={U * 2.2} fontWeight="900" fontStyle="italic" fill="#ffd0d6" letterSpacing={U * 0.3}>
                RED ZONE
              </text>
            </g>
          )}
          {drive !== undefined && (
            <g className="k5-drive">
              <rect x={Math.min(drive, start)} y={MID - U * 0.9} width={Math.abs(start - drive)} height={U * 1.8} fill={color} opacity=".55" rx={U * 0.4} />
              <rect x={Math.min(drive, start)} y={MID - U * 0.9} width={Math.abs(start - drive)} height={U * 1.8} fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth={U * 0.12} rx={U * 0.4} />
              <circle cx={drive} cy={MID} r={U * 0.7} fill="#fff" opacity=".8" />
              <text x={(drive + start) / 2} y={MID + U * 3.2} textAnchor="middle" fontSize={U * 1.9} fontWeight="900" fontStyle="italic" fill="#fff" stroke="#000" strokeWidth={U * 0.25} paintOrder="stroke">
                DRIVE · {drivePlays} PLAYS · {Math.abs(play.spot - (driveStart ?? play.spot))} YDS
              </text>
            </g>
          )}
          {tv ? (
            <>
              <line x1={start} x2={start} y1={Y0} y2={Y1} stroke="#3fb8ff" strokeWidth={U * 0.45} opacity=".9" />
              <line x1={first} x2={first} y1={Y0} y2={Y1} stroke="#ffd400" strokeWidth={U * 0.55} opacity=".92" />
            </>
          ) : (
            <>
              <line x1={start} x2={start} y1={Y0} y2={Y1} stroke="#ffffff" strokeWidth={U * 0.2} strokeDasharray={`${U} ${U}`} opacity=".45" />
              <line x1={first} x2={first} y1={Y0} y2={Y1} stroke="#ffcf4a" strokeWidth={U * 0.2} strokeDasharray={`${U} ${U}`} opacity=".55" />
              <line x1={start} x2={first} y1={Y0 - U * 1.4} y2={Y0 - U * 1.4} stroke="#d9d9d9" strokeWidth={U * 0.15} />
              {[start, first].map((cx, k) => (
                <rect key={k} x={cx - U * 0.45} y={Y0 - U * 2.6} width={U * 0.9} height={U * 2.4} rx={U * 0.2} fill="#ff6a13" stroke="#fff" strokeWidth={U * 0.1} />
              ))}
            </>
          )}
          <g opacity=".95">
            {team.defense.map((p, k) => (
              <circle key={`d${k}`} cx={p.x} cy={p.y} r={U * 0.62} fill={other} stroke="#fff" strokeWidth={U * 0.14} />
            ))}
            {team.offense.map((p, k) => (
              <circle key={`o${k}`} cx={p.x} cy={p.y} r={U * 0.62} fill={color} stroke="#fff" strokeWidth={U * 0.14} />
            ))}
          </g>
          <g key={index} style={{ animationPlayState: playing ? "running" : "paused" }}>
            <path
              className="k5-path"
              d={path}
              fill="none"
              stroke={kind === "sack" ? "#ff5168" : kind === "pass" ? "#ffe6a2" : "#9ff0ff"}
              strokeWidth={U * 0.4}
              strokeDasharray={`${U * 0.8} ${U * 0.6}`}
              opacity={moving || kind === "sack" ? 0.95 : 0}
            />
            {kind === "sack" && (
              <path d={`M${finish - U} ${MID - U}L${finish + U} ${MID + U}M${finish + U} ${MID - U}L${finish - U} ${MID + U}`} stroke="#ff5168" strokeWidth={U * 0.45} />
            )}
            {!moving && (
              <g>
                <ellipse cx={start} cy={MID} rx={U * 0.75} ry={U * 0.45} fill="#8a4b22" stroke="#fff" strokeWidth={U * 0.1} />
              </g>
            )}
            <g className="k5-downflag">
              <rect x={first - U * 4} y={MID - U * 9} width={U * 8} height={U * 2.4} rx={U * 0.3} fill={tv ? "#ffd400" : "#ff6a13"} stroke="#000" strokeOpacity=".4" strokeWidth={U * 0.12} />
              <text x={first} y={MID - U * 7.2} textAnchor="middle" fontSize={U * 1.7} fontWeight="900" fontStyle="italic" fill="#140d00">
                {downText}
              </text>
            </g>
            {moving && (
              <g
                className="broadcast-ball"
                style={
                  {
                    "--travel": `${finish - start}px`,
                    animationPlayState: playing ? "running" : "paused",
                    animationDuration: `${duration}ms`,
                  } as CSSProperties
                }
              >
                <ellipse cx={start} cy={MID} rx={U * 0.75} ry={U * 0.45} fill="#8a4b22" stroke="#fff" strokeWidth={U * 0.1} />
                <path d={`M${start - U * 0.35} ${MID}h${U * 0.7}`} stroke="#fff" strokeWidth={U * 0.1} />
              </g>
            )}
            {moving && <circle cx={finish} cy={MID} r={U * 1.3} fill="none" stroke="#ffe6a2" strokeWidth={U * 0.2} />}
          </g>
        </svg>
      </div>
      </div>
      {/* The lower third: who has it and what just happened, in the club's colors. */}
      <div key={`lt-${index}`} className="k5-lower3" style={{ "--team": color } as CSSProperties}>
        <span className="k5-lower3-logo">
          <Logo id={play.poss} size={38} year={season} />
        </span>
        <span className="k5-lower3-body">
          <span className="k5-lower3-kicker">
            {teamAbbr(play.poss)} · {play.q > 4 ? "OT" : `Q${play.q}`} · {callLabel || "Play"}
          </span>
          <span className="k5-lower3-text">{play.text}</span>
        </span>
      </div>
      {/* The big moments take the whole screen: the club's colors wipe across behind its logo. */}
      {tag && (
        <div key={`${index}-${tag}`} className="broadcast-event k5-takeover" role="status" style={{ "--team": tag === "TURNOVER" || tag === "SAFETY" ? other : color } as CSSProperties}>
          <span className="k5-takeover-wipe" aria-hidden />
          <span className="k5-takeover-logo">
            <Logo id={(tag === "TURNOVER" || tag === "SAFETY" ? (play.poss === home ? away : home) : play.poss) as TeamId} size={92} year={season} />
          </span>
          <strong className="k5-takeover-word">{tag}</strong>
          <span>
            {play.as} — {play.hs}
          </span>
        </div>
      )}
      <div className="flex flex-wrap justify-between gap-2 px-4 pb-3 text-[10px] text-muted">
        <span>
          {tv ? (
            <>
              <span className="text-sky-300">━</span> Line of scrimmage <span className="ml-3 text-amber-200">━</span> First down
            </>
          ) : (
            <>
              <span className="text-orange-300">▮</span> Chains and down box <span className="ml-3 text-amber-200">┅</span> First down
            </>
          )}
        </span>
        <span>
          Hashes {look.hashFromSideline >= 23 ? "at goal-post width" : `${Math.round(look.hashFromSideline)} yds in`} · posts on the {look.postsAt === "goal" ? "goal line" : "end line"}
        </span>
      </div>
    </div>
  );
}
