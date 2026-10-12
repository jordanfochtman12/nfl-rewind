/**
 * The owner's draft room: how a prospect fits the club's systems, how sure the scouts really
 * are (a grade is a range, not a number), where the roster needs help, a counter-offer on a
 * trade call, and, years later, whether the crowd in the room was right. No React.
 */
import { BUDGETS, ownerGrade, scoutState } from "./scouting.ts";
import { STARTS } from "./morale.ts";
import { playerName, starters } from "./players.ts";
import { activeTeamIds, displayName } from "./teams.ts";
import { allPicks } from "./draft.ts";
import { draftPickValue, type PickDeal } from "./draftTrades.ts";
import type { DynastySave, Player, Pos, TeamId } from "./types.ts";

export interface SchemeFit {
  score: number;
  label: "Ideal fit" | "Good fit" | "Neutral" | "Poor fit";
  why: string;
}

/** How a prospect's tools match what the club's offense and defense ask of his position. */
export function schemeFit(save: DynastySave, teamId: TeamId, p: Player): SchemeFit {
  const t = save.teams[teamId];
  const r = p.ratings;
  const off = t?.offScheme ?? "multiple";
  const def = t?.defScheme ?? "4-3";
  let score = 0;
  let why = "";
  const z = (v: number) => (v - 70) / 10;
  switch (p.pos) {
    case "QB":
      if (off === "vertical") { score = z(r.throwPow); why = "arm strength for the vertical game"; }
      else if (off === "westcoast") { score = z(r.throwAcc); why = "timing and accuracy for the West Coast"; }
      else if (off === "smashmouth") { score = z(r.awareness) * 0.6; why = "game management in a run-first offense"; }
      break;
    case "RB":
    case "FB":
      if (off === "smashmouth") { score = z((r.truck + r.btk) / 2); why = "power to run between the tackles"; }
      else if (off === "westcoast") { score = z((r.catch + r.elu) / 2); why = "hands and wiggle out of the backfield"; }
      else if (off === "vertical") { score = z(r.speed) * 0.6; why = "home-run speed"; }
      break;
    case "WR":
      if (off === "vertical") { score = z(r.speed); why = "speed to stretch the field"; }
      else if (off === "westcoast") { score = z(r.rrt); why = "route running for a timing offense"; }
      else if (off === "smashmouth") { score = z(r.runBlk ?? 60) * 0.5; why = "blocking on the perimeter"; }
      break;
    case "TE":
      score = off === "smashmouth" ? z(r.runBlk) : z(r.catch);
      why = off === "smashmouth" ? "an in-line blocker for the run game" : "a receiving threat up the seam";
      break;
    case "LT": case "LG": case "C": case "RG": case "RT":
      score = off === "smashmouth" ? z(r.runBlk) : off === "vertical" ? z(r.passBlk) : 0;
      why = off === "smashmouth" ? "road-grading for a power run game" : off === "vertical" ? "pass protection for deep drops" : "";
      break;
    case "DE":
      if (def === "3-4") { score = z(r.str); why = "two-gap strength as a 3-4 end"; }
      else if (def === "wide-9") { score = z((r.speed + r.prs) / 2); why = "get-off for the wide-9 rush"; }
      else { score = z(r.prs) * 0.7; why = "pass rush off the edge"; }
      break;
    case "OLB":
      if (def === "3-4") { score = z(r.prs); why = "rushing the passer as a 3-4 outside backer"; }
      else if (def === "cover-2") { score = z(r.cov); why = "dropping into coverage in the Cover 2"; }
      break;
    case "MLB":
      score = def === "cover-2" ? z(r.cov) : z(r.tak) * 0.6;
      why = def === "cover-2" ? "running the deep middle in the Tampa 2" : "a downhill tackler";
      break;
    case "CB":
    case "S":
      score = def === "cover-2" ? z((r.cov + r.tak) / 2) : z(r.speed) * 0.6;
      why = def === "cover-2" ? "zone eyes and tackling for the Cover 2" : "man-coverage speed";
      break;
  }
  score = Math.max(-3, Math.min(3, score));
  const label = score >= 1.5 ? "Ideal fit" : score >= 0.5 ? "Good fit" : score <= -1 ? "Poor fit" : "Neutral";
  return { score, label, why: why || "a plug-in at any system" };
}

export interface GradeRange {
  grade: number;
  lo: number;
  hi: number;
  confidence: "High" | "Medium" | "Low";
}

/** The owner's grade as the scouts would put it: a range, narrower with a bigger budget, a visit or a workout. */
export function gradeRange(save: DynastySave, p: Player): GradeRange {
  const grade = ownerGrade(save, p);
  if (p.revealed || p.draftYear !== save.year || save.sandbox) return { grade, lo: grade, hi: grade, confidence: "High" };
  const s = scoutState(save);
  const a = s.visits.includes(p.id) ? 0.88 : BUDGETS[s.budget].accuracy;
  const worked = p.combine && !p.combine.satOut ? 2 : 0;
  const spread = Math.max(1, Math.round((1 - a) * 16) - worked);
  return { grade, lo: Math.max(40, grade - spread), hi: Math.min(99, grade + spread), confidence: spread <= 3 ? "High" : spread <= 6 ? "Medium" : "Low" };
}

export interface Need {
  pos: Pos;
  severity: number;
  why: string;
}

/** Where the roster needs help, against the league's starters at each position. */
export function positionalNeeds(save: DynastySave, teamId: TeamId, max = 5): Need[] {
  const out: Need[] = [];
  const league = (pos: Pos, n: number) => {
    const vals: number[] = [];
    for (const id of activeTeamIds(save.year)) for (const p of starters(save, id, pos, n)) vals.push(p.ovr);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 70;
  };
  for (const [pos, n] of Object.entries(STARTS) as [Pos, number][]) {
    if (pos === "K" || pos === "P" || pos === "FB") continue;
    const mine = starters(save, teamId, pos, n);
    const have = mine.length ? mine.reduce((a, p) => a + p.ovr, 0) / mine.length : 50;
    let severity = league(pos, n) - have;
    const old = mine.filter((p) => p.age >= 31).length;
    const leaving = mine.filter((p) => (p.contractYears ?? 2) <= 1).length;
    severity += old * 2 + leaving * 1.5 + (mine.length < n ? 8 : 0);
    if (severity < 2) continue;
    const bits = [have < league(pos, n) - 2 ? `starters ${Math.round(have)} vs league ${Math.round(league(pos, n))}` : "", old ? `${old} starter${old > 1 ? "s" : ""} 31+` : "", leaving ? `${leaving} contract${leaving > 1 ? "s" : ""} up` : ""].filter(Boolean);
    out.push({ pos, severity, why: bits.join(" · ") || "depth" });
  }
  return out.sort((a, b) => b.severity - a.severity).slice(0, max);
}

/**
 * Ask a club calling to trade up for a little more: they'll add a spare pick if the deal still
 * sits within what they're willing to pay, and say no otherwise. One ask per call.
 */
export function counterOffer(save: DynastySave, deal: PickDeal): { deal?: PickDeal; reply: string } {
  const value = (p: { id: string } & Parameters<typeof draftPickValue>[1]) => draftPickValue(save, p);
  const have = new Set(deal.get.map((p) => p.id));
  const spare = allPicks(save)
    .filter((p) => p.owner === deal.partner && !p.used && !have.has(p.id) && p.year <= save.year + 1 && value(p) > 0)
    .sort((a, b) => value(a) - value(b));
  // They'll go to about 12% over the chart for a player they want; never beyond it.
  const ceiling = deal.giveValue * 1.12;
  const add = spare.find((p) => deal.getValue + value(p) <= ceiling);
  const who = displayName(save.year, deal.partner);
  if (!add) return { reply: `The ${who} won't go any higher. Take it or leave it.` };
  const slot = add.year === save.year ? "a pick later in this draft" : `a ${add.year} round-${add.round} pick`;
  return {
    deal: { ...deal, get: [...deal.get, add], getValue: deal.getValue + value(add), pitch: `${deal.pitch} After some back and forth, they've thrown in ${slot}.` },
    reply: `The ${who} grumble, then agree to add ${slot}.`,
  };
}

export interface CrowdVerdict {
  playerId: string;
  name: string;
  buzz: "cheered" | "booed";
  pick: number;
  reRank: number;
  text: string;
}

/** Years on: was the room right? Booed picks who became stars, cheered picks who busted. */
export function crowdVerdicts(save: DynastySave, picks: { playerId: string; pick: number; reRank: number }[]): CrowdVerdict[] {
  const out: CrowdVerdict[] = [];
  for (const x of picks) {
    const p = save.players[x.playerId];
    if (!p?.draftBuzz || p.draftBuzz === "mixed") continue;
    const outplayed = x.reRank <= Math.max(10, x.pick * 0.5);
    const busted = x.reRank > Math.max(40, x.pick * 2.5);
    if (p.draftBuzz === "booed" && outplayed)
      out.push({ playerId: p.id, name: playerName(p), buzz: "booed", pick: x.pick, reRank: x.reRank, text: `Booed at No. ${x.pick}. Re-drafted today, he goes No. ${x.reRank}. The fans were wrong.` });
    else if (p.draftBuzz === "booed" && busted)
      out.push({ playerId: p.id, name: playerName(p), buzz: "booed", pick: x.pick, reRank: x.reRank, text: `Booed at No. ${x.pick}, and the boos were right: he'd go No. ${x.reRank} now.` });
    else if (p.draftBuzz === "cheered" && busted)
      out.push({ playerId: p.id, name: playerName(p), buzz: "cheered", pick: x.pick, reRank: x.reRank, text: `The room cheered at No. ${x.pick}. Re-drafted, he falls to No. ${x.reRank}.` });
    else if (p.draftBuzz === "cheered" && outplayed && x.pick > 5)
      out.push({ playerId: p.id, name: playerName(p), buzz: "cheered", pick: x.pick, reRank: x.reRank, text: `Cheered at No. ${x.pick}, and the fans called it: he's No. ${x.reRank} in a re-draft.` });
  }
  return out.slice(0, 6);
}

