import type { PlayLog, TeamId } from "@/lib/game";

/*
 * Running player lines read off the broadcast's own play-by-play, so the booth's graphics can
 * say what a player has done today: "Rushing yards today: 112".
 */

interface Line {
  teamId: TeamId;
  rush: number;
  car: number;
  rushTd: number;
  rec: number;
  recYds: number;
  recTd: number;
  cmp: number;
  att: number;
  passYds: number;
  passTd: number;
}

const NAME = "([A-Z][\\w.'’-]*(?: [A-Z][\\w.'’-]*){1,3})";
const RUN = new RegExp(`^${NAME} runs? for (-?\\d+) yards?`);
const PASS = new RegExp(`^${NAME} to ${NAME} for (-?\\d+) yards?`);
const INC = new RegExp(`^${NAME} incomplete`);

function lines(log: PlayLog[], upto: number): Map<string, Line> {
  const out = new Map<string, Line>();
  const get = (name: string, teamId: TeamId) => {
    let l = out.get(name);
    if (!l) out.set(name, (l = { teamId, rush: 0, car: 0, rushTd: 0, rec: 0, recYds: 0, recTd: 0, cmp: 0, att: 0, passYds: 0, passTd: 0 }));
    return l;
  };
  for (let k = 0; k <= upto && k < log.length; k++) {
    const p = log[k]!;
    const td = p.tag === "td";
    let m = p.text.match(PASS);
    if (m) {
      const y = Number(m[3]);
      const qb = get(m[1]!, p.poss);
      const wr = get(m[2]!, p.poss);
      qb.cmp += 1;
      qb.att += 1;
      qb.passYds += y;
      wr.rec += 1;
      wr.recYds += y;
      if (td) {
        qb.passTd += 1;
        wr.recTd += 1;
      }
      continue;
    }
    m = p.text.match(RUN);
    if (m) {
      const r = get(m[1]!, p.poss);
      r.car += 1;
      r.rush += Number(m[2]);
      if (td) r.rushTd += 1;
      continue;
    }
    m = p.text.match(INC);
    if (m) get(m[1]!, p.poss).att += 1;
  }
  return out;
}

export interface Rolling {
  name: string;
  teamId: TeamId;
  kicker: string;
  value: string;
  line: string;
}

/** A player on this snap who's having a day, with the graphic for it (or nothing). */
export function rollingLine(log: PlayLog[], i: number): Rolling | undefined {
  const p = log[i];
  if (!p) return;
  const all = lines(log, i);
  const pass = p.text.match(PASS);
  const run = p.text.match(RUN);
  // One graphic every few snaps at most, so it reads as a moment, not a ticker.
  const pick = (name: string, kind: "rush" | "rec" | "pass") => {
    const l = all.get(name);
    if (!l) return;
    if (kind === "rush" && (l.rush >= 75 || l.rushTd >= 2)) return { name, teamId: l.teamId, kicker: "RUSHING YARDS TODAY", value: String(l.rush), line: `${l.car} car · ${(l.rush / Math.max(1, l.car)).toFixed(1)} avg${l.rushTd ? ` · ${l.rushTd} TD` : ""}` };
    if (kind === "rec" && (l.recYds >= 80 || l.recTd >= 2)) return { name, teamId: l.teamId, kicker: "RECEIVING YARDS TODAY", value: String(l.recYds), line: `${l.rec} catches${l.recTd ? ` · ${l.recTd} TD` : ""}` };
    if (kind === "pass" && (l.passYds >= 200 || l.passTd >= 3)) return { name, teamId: l.teamId, kicker: "PASSING YARDS TODAY", value: String(l.passYds), line: `${l.cmp}/${l.att}${l.passTd ? ` · ${l.passTd} TD` : ""}` };
    return;
  };
  const found = run ? pick(run[1]!, "rush") : pass ? (pick(pass[2]!, "rec") ?? pick(pass[1]!, "pass")) : undefined;
  if (!found) return;
  // Shown the snap he crosses the mark, then every third touch after.
  const touches = log.slice(0, i).filter((x) => x.text.includes(found.name)).length;
  const before = lines(log, i - 1).get(found.name);
  const crossedNow =
    !before ||
    (found.kicker.startsWith("RUSHING") ? before.rush < 75 && before.rushTd < 2 : found.kicker.startsWith("RECEIVING") ? before.recYds < 80 && before.recTd < 2 : before.passYds < 200 && before.passTd < 3);
  return crossedNow || touches % 3 === 0 ? found : undefined;
}
