/**
 * The rulebook, on the dates the real league changed it. Each entry matches a rule the sim
 * already plays by from that season on (era.ts and sim.ts), so the story told at training camp
 * is the game the league actually plays that year.
 */
import type { DynastySave } from "./types.ts";
import { addNews } from "./news.ts";

export interface RuleChange {
  year: number;
  title: string;
  body: string;
  /** What it does to the game, in a line the booth can read. */
  effect: string;
}

export const RULE_CHANGES: RuleChange[] = [
  { year: 1970, title: "One league", body: "The NFL and AFL merge into one league of two conferences, the AFC and NFC, with a single playoff field.", effect: "Four playoff clubs per conference, champions meet in the Super Bowl." },
  { year: 1972, title: "Hash marks move in", body: "The hash marks move to 70 feet, 9 inches from the sidelines, putting every kick closer to the middle.", effect: "Fewer field goals from bad angles; accuracy climbs." },
  { year: 1974, title: "Goal posts to the end line", body: "The posts move from the goal line to the back of the end zone, kickoffs move back to the 35, and sudden-death overtime comes to the regular season. A missed field goal from beyond the 20 now returns to the line of scrimmage.", effect: "Ten yards added to every field goal; fewer long tries; overtime in the regular season." },
  { year: 1974, title: "Pass interference at the spot", body: "Defensive pass interference is now a spot foul, and downfield contact on receivers is limited.", effect: "A deep ball drawing a flag is a big gain." },
  { year: 1978, title: "The Mel Blount rule", body: "Defenders may contact a receiver only within five yards of the line. Offensive linemen may extend their arms in pass protection. The schedule grows to 16 games and a fifth playoff club joins each conference.", effect: "The passing game opens up: more completions, more yards, fewer sacks." },
  { year: 1990, title: "Twelve-team playoffs", body: "A sixth playoff club joins each conference; the top two seeds earn byes.", effect: "Six clubs a conference reach January." },
  { year: 1994, title: "The two-point conversion", body: "The NFL adopts the two-point try after touchdowns, and kickoffs move back to the 30.", effect: "Trailing clubs can go for two; more kickoff returns." },
  { year: 1999, title: "Instant replay returns", body: "Coaches may challenge calls on the field, with a replay official in the booth for the final two minutes of each half.", effect: "Fewer missed calls on big plays." },
  { year: 2002, title: "Eight divisions", body: "Houston's arrival brings 32 clubs and a realignment into eight divisions of four.", effect: "Four division winners per conference." },
  { year: 2010, title: "Playoff overtime changes", body: "In the postseason, a field goal on the first possession of overtime no longer ends the game.", effect: "Both sides get a chance unless the first drive scores a touchdown." },
  { year: 2011, title: "Kickoffs to the 35", body: "Kickoffs move up to the 35-yard line.", effect: "Touchbacks become common; fewer returns." },
  { year: 2012, title: "Modified overtime for all", body: "The postseason overtime rule extends to the regular season.", effect: "A first-possession field goal no longer wins in overtime." },
  { year: 2015, title: "The long extra point", body: "Extra points are snapped from the 15-yard line, a 33-yard kick.", effect: "Kickers miss more extra points; more clubs go for two." },
  { year: 2016, title: "Touchbacks to the 25", body: "A touchback on a kickoff now brings the ball out to the 25.", effect: "Even more touchbacks." },
  { year: 2017, title: "Ten-minute overtime", body: "Regular-season overtime is shortened to ten minutes, and some clock-stopping fouls now carry a ten-second runoff.", effect: "More ties; late-game penalties cost time." },
  { year: 2020, title: "Fourteen-team playoffs", body: "A seventh playoff club joins each conference; only the top seed earns a bye.", effect: "Seven clubs a conference reach January." },
  { year: 2021, title: "A 17-game season", body: "The regular season grows to 17 games.", effect: "Room for new single-season records." },
];

export function rulesTakingEffect(year: number): RuleChange[] {
  return RULE_CHANGES.filter((r) => r.year === year);
}

/** Every change on the books by a given season, newest first. */
export function rulebookThrough(year: number): RuleChange[] {
  return RULE_CHANGES.filter((r) => r.year <= year).sort((a, b) => b.year - a.year);
}

/** Announced once, when camps open in the season a change takes effect. */
export function announceRuleChanges(save: DynastySave): void {
  for (const r of rulesTakingEffect(save.year)) {
    const headline = `New for ${save.year}: ${r.title.toLowerCase()}`;
    if (save.news.some((n) => n.year === save.year && n.headline === headline)) continue;
    addNews(save, { kind: "headline", headline, body: `${r.body} ${r.effect}`, teamIds: [], playerIds: [] });
  }
}
