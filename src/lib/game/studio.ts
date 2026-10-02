/** Editorial production built only from this dynasty's recorded results. No random state consumed. */
import type { DynastySave, GameResult, PrimetimeShow, TeamId } from "./types.ts";
import { displayName, teamAbbr, roman, superBowlNumber, conferenceOf } from "./teams.ts";
import { depthAt, playerName } from "./players.ts";
import { superBowlSite } from "./data/bowlSites.ts";

type Episode = NonNullable<PrimetimeShow["episode"]>;
type Chapter = Episode["chapters"][number];
const win = (g: GameResult) => (g.homeScore > g.awayScore ? g.homeId : g.awayId) as TeamId;
const score = (g: GameResult) =>
  `${teamAbbr(g.awayId as TeamId)} ${g.awayScore}, ${teamAbbr(g.homeId as TeamId)} ${g.homeScore}`;
const involved = (g: GameResult, id: TeamId) => g.homeId === id || g.awayId === id;
const record = (s: DynastySave, id: TeamId) => {
  const t = s.teams[id];
  return `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`;
};

export function produceEpisode(
  save: DynastySave,
  show: PrimetimeShow,
  games: GameResult[],
  upcoming: GameResult[],
  finale: boolean,
): Episode {
  const name = (id: TeamId) => displayName(show.year, id);
  const sbPreview = upcoming.find((g) => g.phase === "superBowl");
  const edition: Episode["edition"] =
    show.kind === "superBowl"
      ? "superBowl"
      : show.kind === "awards"
        ? "awards"
        : sbPreview
          ? "championship"
          : finale
            ? "seasonFinale"
            : show.kind === "playoffs"
              ? "playoffs"
              : "weekly";
  const id = `${show.year}-${edition}-${show.week}-${games
    .map((g) => g.id)
    .sort()
    .join("_")}`;
  const chapters: Chapter[] = [];
  const add = (
    id: string,
    kicker: string,
    title: string,
    teamIds: TeamId[],
    host: string,
    analyst?: string,
    reporter?: string,
  ) => {
    chapters.push({
      id,
      kicker,
      title,
      teamIds,
      lines: [
        { speaker: "HOST", text: host },
        ...(analyst ? [{ speaker: "ANALYST" as const, text: analyst }] : []),
        ...(reporter ? [{ speaker: "REPORTER" as const, text: reporter }] : []),
      ],
    });
  };
  const previous = [...(save.primetimeArchive ?? []), ...(save.primetime ? [save.primetime] : [])]
    .filter((s) => s.year === show.year && s.episode?.id !== id)
    .at(-1);
  const season = save.schedule.filter(
    (g) => g.year === show.year && g.played && g.phase === "regular",
  );
  const featured = games.slice().sort((a, b) => {
    const weight = (g: GameResult) =>
      45 -
      Math.abs(g.homeScore - g.awayScore) * 2 +
      (g.ot ? 35 : 0) +
      (g.rivalry ? 12 : 0) +
      (involved(g, save.userTeamId) ? 6 : 0);
    return weight(b) - weight(a);
  });
  const lead = featured[0];
  const headline =
    edition === "superBowl" && lead
      ? `${name(win(lead))}. Champions.`
      : edition === "championship" && sbPreview
        ? `${name(sbPreview.awayId as TeamId)}. ${name(sbPreview.homeId as TeamId)}. One trophy.`
        : edition === "seasonFinale"
          ? `${show.year}: the field is set`
          : edition === "awards"
            ? `${show.year}: the season belongs to them`
            : lead
              ? lead.homeScore === lead.awayScore
                ? `${name(lead.homeId as TeamId)} and ${name(lead.awayId as TeamId)} cannot be separated`
                : `${name(win(lead))} ${lead.ot ? "survive overtime" : Math.abs(lead.homeScore - lead.awayScore) <= 3 ? "win on the edge" : "take the spotlight"}`
              : `${show.year} · the league notebook`;
  const subtitle =
    edition === "championship"
      ? `Championship review / Super Bowl ${roman(superBowlNumber(show.year))} preview`
      : edition === "seasonFinale"
        ? "Regular-season wrap / Studio awards / Playoff opening round"
        : edition === "superBowl"
          ? `Super Bowl ${roman(superBowlNumber(show.year))} / Championship celebration / Year in review`
          : edition === "awards"
            ? "Official honors / Legacy / Next season"
            : `${show.title} / ${games.length} games / The stories behind the scores`;
  const total = games.reduce((n, g) => n + g.homeScore + g.awayScore, 0);
  const close = games.filter((g) => Math.abs(g.homeScore - g.awayScore) <= 7).length;
  add(
    "opening",
    "ON THE AIR",
    headline,
    lead ? [lead.awayId as TeamId, lead.homeId as TeamId] : [],
    `${subtitle}. ${games.length ? `${total} points ${games.length === 1 ? "in the featured game" : `across ${games.length} games`}${games.length > 1 ? `; ${close} finished within one possession` : ""}. ${lead ? `${score(lead)} is where we begin.` : ""}` : "The next chapter starts with the teams still standing."}`,
    edition === "seasonFinale"
      ? "The regular-season evidence is complete. Tonight we separate the full-season resume from the single-elimination test ahead."
      : edition === "championship"
        ? "Both finalists have earned their place. We will trace their routes, compare the season numbers and identify what each side needs to do on a neutral field."
        : undefined,
  );

  for (const g of featured.slice(0, edition === "weekly" ? 3 : 6)) {
    const home = g.homeId as TeamId,
      away = g.awayId as TeamId,
      tied = g.homeScore === g.awayScore;
    const winner = win(g),
      loser = winner === home ? away : home;
    const recap = show.recaps.find((r) => r.homeId === home && r.awayId === away);
    const to =
      g.homeTo !== undefined && g.awayTo !== undefined
        ? `${name(home)} committed ${g.homeTo} turnovers; ${name(away)} committed ${g.awayTo}.${g.homeTo !== g.awayTo ? ` ${name(g.homeTo < g.awayTo ? home : away)} won the turnover battle by ${Math.abs(g.homeTo - g.awayTo)}.` : ""}`
        : "";
    const prior = season
      .filter((x) => x.id !== g.id && involved(x, winner) && x.week < g.week)
      .slice(-3);
    const form = prior.length
      ? `${name(winner)} entered this game ${prior.filter((x) => x.homeScore !== x.awayScore && win(x) === winner).length}-${prior.filter((x) => x.homeScore !== x.awayScore && win(x) !== winner).length}${prior.some((x) => x.homeScore === x.awayScore) ? `-${prior.filter((x) => x.homeScore === x.awayScore).length}` : ""} over the previous ${prior.length} games.`
      : "";
    add(
      `film-${g.id}`,
      g.round ?? "THE FILM ROOM",
      recap?.line ?? score(g),
      [away, home],
      `${score(g)}${g.ot ? ", in overtime" : ""}. ${recap?.note ?? ""}`,
      `${to} ${recap?.performers?.join(". ") ?? ""}`,
      g.phase !== "regular"
        ? g.phase === "superBowl"
          ? `${name(winner)} finish the job. ${name(loser)} finish one victory short of the championship.`
          : `${name(winner)} advance. ${name(loser)} are eliminated from this postseason.`
        : `${form} ${tied ? "Both teams add a tie." : `${name(winner)} now stand ${record(save, winner)}; ${name(loser)} are ${record(save, loser)}.`}`,
    );
  }

  if (edition === "weekly") {
    const candidates = (show.stories ?? []).filter(
      (s) => !previous?.episode?.focusIds.includes(s.headline),
    );
    for (const s of candidates.slice(0, 2))
      add(`story-${chapters.length}`, s.tag, s.headline, s.teamIds, s.body);
    const lastPick = previous?.previews?.find((p) =>
      games.some((g) => g.homeId === p.homeId && g.awayId === p.awayId),
    );
    const result =
      lastPick && games.find((g) => g.homeId === lastPick.homeId && g.awayId === lastPick.awayId);
    if (lastPick && result)
      add(
        "accountability",
        "LAST WEEK / THIS WEEK",
        "Checking the desk's pick",
        [lastPick.awayId, lastPick.homeId],
        `Last show we picked ${name(lastPick.pick)} in this matchup. The result: ${score(result)}.`,
        result.homeScore === result.awayScore
          ? "A tie settles neither side's case. We record this one as a push."
          : win(result) === lastPick.pick
            ? "The pick held up. The performance and margin are now part of the next matchup's evidence."
            : `We got that one wrong. ${name(win(result))} earned the result; our forecast was an opinion, not a guarantee.`,
      );
    const rotating = show.week % 4;
    if (rotating === 0 && show.chases?.length)
      for (const c of show.chases.slice(0, 2))
        add(`chase-${c.playerId}`, "RECORD WATCH", c.name, [c.teamId], c.text);
    else if (rotating === 1 && show.injuries?.length)
      for (const i of show.injuries.filter((i) => i.fresh).slice(0, 2))
        add(
          `medical-${i.playerId}`,
          "AVAILABILITY",
          `${i.name}: the lineup changes`,
          [i.teamId],
          `${i.injury}. ${i.ir ? "On injured reserve." : `Out ${i.weeks} weeks.`} ${name(i.teamId)} must account for that absence in the next game plan.`,
        );
    else if (rotating === 2 && show.power?.length) {
      const p = show.power[0]!;
      add(
        "contender",
        "CONTENDER CHECK",
        `${name(p.teamId)} lead the board`,
        [p.teamId],
        `${p.record}. ${p.blurb}`,
        p.prev
          ? `Previously ranked ${p.prev}; now number ${p.rank}. This is the desk's assessment, not an official playoff seed.`
          : "The rankings reflect the games played so far, not a guaranteed postseason place.",
      );
    } else if (show.rumors?.length) {
      const r = show.rumors[0]!;
      add(
        "market",
        "LEAGUE NOTEBOOK",
        "What the front offices are watching",
        r.teamIds,
        r.text,
        "This is reporting from the game's rumor board; a proposed move is not a completed transaction.",
      );
    }
  }

  if (finale || edition === "awards") {
    for (const a of show.awards ?? [])
      add(
        `award-${a.label}`,
        finale ? "STUDIO AWARDS BALLOT" : "OFFICIAL SEASON HONORS",
        a.label,
        [a.honoree.teamId],
        `${a.honoree.name}, ${name(a.honoree.teamId)}. ${a.honoree.line}.`,
        finale
          ? "Our selection from the completed regular-season statistics. Official honors are recorded at awards night."
          : "This honor is now part of the player's dynasty record.",
      );
  }

  for (const g of upcoming.slice(0, edition === "weekly" ? 1 : 8)) {
    const home = g.homeId as TeamId,
      away = g.awayId as TeamId;
    const neutral = g.phase === "superBowl";
    const p = show.previews?.find((p) => p.homeId === home && p.awayId === away);
    const teamCase = (tid: TeamId) => {
      const t = save.teams[tid],
        gp = t.wins + t.losses + t.ties;
      const qb = depthAt(save, tid, "QB").find((p) => p.injuredWeeks <= 0 && !p.onIR);
      const stats = qb?.stats[save.year];
      return `${name(tid)}: ${record(save, tid)}${gp ? `, ${(t.pf / gp).toFixed(1)} points scored and ${(t.pa / gp).toFixed(1)} allowed per regular-season game` : ""}. ${qb ? `${playerName(qb)} is the available starting quarterback${stats ? `: ${stats.passYds} yards, ${stats.passTd} touchdowns, ${stats.passInt} interceptions this season` : ""}.` : "The depth chart has no healthy quarterback available."} ${t.offScheme} offense against the opponent's ${save.teams[tid === home ? away : home].defScheme} defense.`;
    };
    const site = neutral ? superBowlSite(save.year) : undefined;
    add(
      `preview-${g.id}`,
      neutral ? "SUPER BOWL / THE MATCHUP" : "NEXT ON THE SCHEDULE",
      `${name(away)} vs. ${name(home)}`,
      [away, home],
      `${g.round ?? `Week ${g.week}`}. ${site ? `${site.site}, ${site.city}. Neutral field; neither club receives a home-field advantage.` : `${name(home)} host.`} ${p?.series ?? ""} ${p?.last ?? ""}`,
      teamCase(away),
      teamCase(home),
    );
    if (neutral) {
      for (const tid of [away, home]) {
        const path = save.playoffGames.filter((x) => x.played && involved(x, tid));
        const hurt = Object.values(save.players)
          .filter((p) => p.teamId === tid && (p.injuredWeeks > 0 || p.onIR))
          .sort((a, b) => b.ovr - a.ovr)
          .slice(0, 3);
        add(
          `road-${tid}`,
          `${conferenceOf(save.year, tid)} CHAMPION`,
          `How ${name(tid)} got here`,
          [tid],
          path.map((x) => `${x.round}: ${score(x)}${x.ot ? " in overtime" : ""}`).join(". "),
          hurt.length
            ? `Availability watch: ${hurt.map((p) => `${playerName(p)} — ${p.injuryName ?? "injured"}, ${p.onIR ? "injured reserve" : `${p.injuredWeeks} weeks remaining`}`).join("; ")}.`
            : "No current injuries are listed on this roster.",
        );
      }
      const ah = save.teams[away],
        hh = save.teams[home];
      const ag = ah.wins + ah.losses + ah.ties || 1,
        hg = hh.wins + hh.losses + hh.ties || 1;
      add(
        "sb-verdict",
        "THE DESK / TWO PATHS TO VICTORY",
        "Where the championship can turn",
        [away, home],
        `${name(away)} score ${(ah.pf / ag).toFixed(1)} per game; ${name(home)} allow ${(hh.pa / hg).toFixed(1)}. On the other side, ${name(home)} score ${(hh.pf / hg).toFixed(1)} against ${(ah.pa / ag).toFixed(1)} allowed by ${name(away)}.`,
        `${name(away)} need to turn their ${ah.offScheme} identity into sustained possessions. ${name(home)} need their ${hh.defScheme} defense to force difficult third downs. Reverse the ball and the same test falls on ${name(home)}'s ${hh.offScheme} attack. These are matchup keys, not predicted events.`,
        p
          ? `The desk leans ${name(p.pick)}. Our projected line: ${p.line}. ${p.note} Kickoff will settle the argument.`
          : undefined,
      );
    }
  }

  if (edition === "superBowl" && lead) {
    const champion = win(lead),
      runner = champion === lead.homeId ? (lead.awayId as TeamId) : (lead.homeId as TeamId);
    const site = superBowlSite(save.year);
    const mvp = lead.mvpPlayerId ? save.players[lead.mvpPlayerId] : undefined;
    add(
      "champions",
      "THE TROPHY PRESENTATION",
      `${name(champion)} own ${show.year}`,
      [champion],
      `From ${site.site} in ${site.city}: ${score(lead)}. Super Bowl ${roman(superBowlNumber(show.year))} belongs to ${name(champion)}.`,
      mvp
        ? `${playerName(mvp)} is the Super Bowl MVP. ${show.recaps.find((r) => r.homeId === lead.homeId)?.performers?.find((s) => s.startsWith(playerName(mvp))) ?? "The award recognizes the championship game's standout."}`
        : "The trophy is the lasting result of tonight's performance.",
    );
    const path = save.playoffGames.filter((g) => g.played && involved(g, champion));
    const old = save.history.superBowls.filter(
      (b) => b.year < save.year && (b.homeScore > b.awayScore ? b.homeId : b.awayId) === champion,
    );
    add(
      "legacy",
      "THE YEAR IN REVIEW",
      "The championship road",
      [champion],
      `${name(champion)} finished the regular season ${record(save, champion)}. ${path.map((g) => `${g.round}: ${score(g)}`).join(". ")}. Tonight: ${score(lead)}.`,
      `${old.length ? `${old.length} earlier Super Bowl title${old.length === 1 ? "" : "s"} in this dynasty's almanac; this adds another.` : "Their first Super Bowl title recorded in this dynasty's almanac."} ${name(runner)} leave as runners-up after a ${record(save, runner)} regular season.`,
    );
    const best = season
      .slice()
      .sort((a, b) => b.homeScore + b.awayScore - (a.homeScore + a.awayScore))[0];
    if (best)
      add(
        "season-moment",
        "SEASON REWIND",
        "The highest-scoring Sunday",
        [best.awayId as TeamId, best.homeId as TeamId],
        `Week ${best.week}: ${score(best)}. ${best.homeScore + best.awayScore} combined points, the season's highest regular-season total.`,
        best.highlights?.[0],
      );
    for (const b of show.leaders?.slice(0, 3) ?? []) {
      const r = b.rows[0];
      if (r)
        add(
          `leader-${b.label}`,
          "THE SEASON'S STANDARD",
          b.label,
          [r.teamId],
          `${r.name}: ${r.value.toLocaleString("en-US")}. The final regular-season leader on this board.`,
        );
    }
  }
  add(
    "signoff",
    "UNTIL NEXT TIME",
    edition === "superBowl" ? "One season ends. A new chase begins." : "The next chapter",
    [],
    edition === "superBowl"
      ? `${name(win(lead!))} are champions of ${show.year}. Next come official awards, the Pro Bowl, retirements and the work of building next year's roster.`
      : edition === "championship"
        ? `The next result will decide Super Bowl ${roman(superBowlNumber(show.year))}. The matchup is set; the ending is unwritten.`
        : finale
          ? `The ${show.year} regular season is closed. The next show follows the opening playoff round.`
          : upcoming.length
            ? `${upcoming.length} matchups are on the next slate. We will revisit the picks after the games are played.`
            : `That closes ${show.title}. The league's calendar carries the story forward.`,
  );
  return {
    id,
    edition,
    headline,
    subtitle,
    chapters,
    focusIds: (show.stories ?? []).map((s) => s.headline),
  };
}
