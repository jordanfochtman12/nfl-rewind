import { createNewGame } from '../src/lib/game/engine.ts'
const game=createNewGame('gnb',1966)
if(Object.keys(game.teams).length!==24) throw new Error('Expected 24 teams')
if(game.draftBoard.length<1 || !game.draftBoard.some(id=>game.players[id]?.name==='Tommy Nobis')) throw new Error('1966 draft board missing Tommy Nobis')
if(game.schedule.length!==0) throw new Error('Preseason should not schedule before opening day')
game.phase='regular'; game.week=1
const weekOne=['1:clt@gnb','1:ram@atl','1:chi@det','1:cle@was','1:phi@crd','1:min@sfo','1:pit@nyg']
const { scheduleForYear }=await import('../src/lib/game/schedules.ts')
if(JSON.stringify(scheduleForYear(1966).slice(0,7))!==JSON.stringify(weekOne)) throw new Error('1966 Week 1 schedule mismatch')
console.log('qa-season: 24 teams, 1966 historical Week 1, Tommy Nobis draft board: OK')
console.log('Schedule catalog currently covers the first two 1966 NFL weeks; remaining seasons are explicitly pending ingest.')
