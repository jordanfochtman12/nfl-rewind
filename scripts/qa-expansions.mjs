import { createNewGame } from '../src/lib/game/engine.ts'
import { activeTeams, conferenceOf, divisionOf, expansionSpecs } from '../src/lib/game/era.ts'
for (const [year,spec] of Object.entries(expansionSpecs)) { const ids=activeTeams(Number(year)); if(Number(year)===1996 && ids.includes('cle')) throw new Error('CLE should be inactive in 1996'); if(Number(year)!==1996&&!ids.includes(spec.id)) throw new Error(`${year}: ${spec.id} missing`); const g=createNewGame('gnb',Number(year)); const t=g.teams[spec.id]; if(t && Number(year)!==1996) console.log(`${year} ${spec.id}: roster ${t.roster.length}, coach ${spec.coach}`) }
if(conferenceOf(1970,'gnb')!=='NFC') throw new Error('1970 labels not AFC/NFC')
if(divisionOf(2002,'sea')!=='NFC West') throw new Error('Seattle alignment failed')
if(activeTeams(2002).length!==32) throw new Error('Expected 32 teams')
console.log('qa-expansions: identities, merger labels, and 2002 alignment: OK')
