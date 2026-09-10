import type { TeamId } from './types'

export interface HistoricalGame { year:number; week:number; away:TeamId; home:TeamId; source:string }

const pfr='https://www.pro-football-reference.com/years/1966/games.htm'

// Canonical games transcribed from the 1966 PFR schedule. AFL games are added
// separately as the historical league used a parallel calendar.
export const historicalGames:HistoricalGame[]=[
  {year:1966,week:1,away:'clt',home:'gnb',source:pfr},{year:1966,week:1,away:'ram',home:'atl',source:pfr},{year:1966,week:1,away:'chi',home:'det',source:pfr},{year:1966,week:1,away:'cle',home:'was',source:pfr},{year:1966,week:1,away:'phi',home:'crd',source:pfr},{year:1966,week:1,away:'min',home:'sfo',source:pfr},{year:1966,week:1,away:'pit',home:'nyg',source:pfr},
  {year:1966,week:2,away:'chi',home:'ram',source:pfr},{year:1966,week:2,away:'nyg',home:'dal',source:pfr},{year:1966,week:2,away:'atl',home:'phi',source:pfr},{year:1966,week:2,away:'gnb',home:'cle',source:pfr},{year:1966,week:2,away:'clt',home:'min',source:pfr},{year:1966,week:2,away:'was',home:'crd',source:pfr},{year:1966,week:2,away:'det',home:'pit',source:pfr},
]

export function gamesForYear(year:number){return historicalGames.filter(game=>game.year===year)}
export function scheduleForYear(year:number){return gamesForYear(year).map(game=>`${game.week}:${game.away}@${game.home}`)}
export function scheduleCoverage(year:number){const games=gamesForYear(year);return {games, weeks:[...new Set(games.map(game=>game.week))].sort((a,b)=>a-b), complete:year!==1966?false:games.length===98}}
