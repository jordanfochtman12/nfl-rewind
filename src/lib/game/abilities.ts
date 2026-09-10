import type { Player, Pos, Ratings } from "./types.ts";

export function abilitiesFrom(pos: Pos, r: Ratings): string[] {
  const out: string[] = [];
  if (pos === "QB") {
    if (r.throwPow >= 88) out.push("Cannon");
    if (r.throwAcc >= 88) out.push("Dead-eye");
    if (r.throwAwr >= 88) out.push("Field general");
    if (r.agi >= 85) out.push("Scrambler");
  }
  if (pos === "RB" || pos === "FB") {
    if (r.elu >= 88) out.push("Elusive");
    if (r.truck >= 88) out.push("North-south");
    if (r.btk >= 88) out.push("Leg drive");
    if (r.speed >= 90) out.push("Home run");
  }
  if (pos === "WR" || pos === "TE") {
    if (r.catch >= 90) out.push("Sure hands");
    if (r.cit >= 88) out.push("Contested");
    if (r.speed >= 90) out.push("Burner");
    if (r.rrt >= 88) out.push("Separator");
  }
  if (["LT", "LG", "C", "RG", "RT"].includes(pos)) {
    if (r.passBlk >= 88) out.push("Pocket brick");
    if (r.runBlk >= 88) out.push("Mauler");
    if (r.str >= 90) out.push("Anchor");
  }
  if (["DE", "DT", "OLB"].includes(pos)) {
    if (r.prs >= 90) out.push("Edge");
    if (r.str >= 88) out.push("Two-gap");
    if (r.tak >= 88) out.push("Finisher");
  }
  if (["MLB", "OLB"].includes(pos)) {
    if (r.awareness >= 88) out.push("Quarterback of D");
    if (r.tak >= 90) out.push("Thumper");
  }
  if (pos === "CB" || pos === "S") {
    if (r.cov >= 90) out.push("Blanket");
    if (r.speed >= 88) out.push("Recovery");
    if (r.awareness >= 86) out.push("Ball hawk");
  }
  if (pos === "K" || pos === "P") {
    if (r.kickPow >= 88) out.push("Leg");
    if (r.kickAcc >= 88) out.push("Ice");
  }
  if (r.inj >= 90) out.push("Iron");
  if (r.stamina >= 90) out.push("Durability");
  return out.slice(0, 3);
}

export function abilityLine(p: Player): string {
  return p.abilities.length ? p.abilities.join(" · ") : "—";
}
