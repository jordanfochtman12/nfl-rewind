import type { DynastySave, NewsItem, Phase, TeamId, TxKind } from "./types.ts";

export function addNews(
  save: DynastySave,
  item: Omit<NewsItem, "id" | "year" | "week" | "phase"> & { phase?: Phase },
): NewsItem {
  save.nextNewsSeq += 1;
  const n: NewsItem = {
    id: `n-${save.nextNewsSeq}`,
    year: save.year,
    week: save.week,
    phase: item.phase ?? save.phase,
    kind: item.kind,
    headline: item.headline,
    body: item.body,
    teamIds: item.teamIds,
    playerIds: item.playerIds,
  };
  save.news.unshift(n);
  save.weekNews.unshift(n);
  if (save.news.length > 400) save.news.length = 400;
  return n;
}

export function addTx(
  save: DynastySave,
  kind: TxKind,
  playerId: string,
  from: string,
  to: string,
  detail: string,
): void {
  save.transactions.unshift({
    id: `tx-${save.nextNewsSeq}-${playerId}`,
    year: save.year,
    week: save.week,
    kind,
    playerId,
    from,
    to,
    detail,
  });
  // A whole season's moves (a 32-club league runs to a thousand-odd): the screen reads them all.
  if (save.transactions.length > 1500) save.transactions.length = 1500;
}

export function teamIdsOf(ids: TeamId[]): TeamId[] {
  return ids;
}
