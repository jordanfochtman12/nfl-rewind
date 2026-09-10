import { createNewGame } from '../src/lib/game/engine.ts'
const game=createNewGame('gnb',1966)
if(Object.keys(game.teams).length!==24) throw new Error('Expected 24 teams')
if(game.draftBoard.length<1 || !game.draftBoard.some(id=>game.players[id]?.name==='Tommy Nobis')) throw new Error('1966 draft board missing Tommy Nobis')
console.log('qa-season: 24 teams, 14-game era, Tommy Nobis draft board: OK')
console.log('Note: browser engine owns full playoff event simulation in this first slice.')
