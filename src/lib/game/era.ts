import type { TeamId } from './types'
export const STARTING_YEAR = 1966
export const TEAM_IDS: TeamId[] = ['atl','ram','pit','phi','dal','was','min','crd','gnb','nyg','sfo','chi','cle','clt','det','mia','den','oti','nwe','buf','nyj','rai','sdg','kan','nor','cin','tam','sea','car','jax','rav','htx']
export const BASE_1966: TeamId[] = ['atl','ram','pit','phi','dal','was','min','crd','gnb','nyg','sfo','chi','cle','clt','det','mia','den','oti','nwe','buf','nyj','rai','sdg','kan']
export function gamesInSeason(year:number){ return year >= 2021 ? 17 : year >= 1978 ? 16 : 14 }
export function confLabel(year:number){ return year < 1970 ? ['AFL','NFL'] : ['AFC','NFC'] }
export function conferenceOf(year:number, id:TeamId){
  if (year < 1970) return BASE_1966.slice(15).includes(id) ? 'AFL' : 'NFL'
  const afc:TeamId[] = ['buf','mia','nwe','nyj','rai','sdg','den','kan','oti','cin','cle','pit','clt','jax','rav','htx']
  return afc.includes(id) ? 'AFC' : 'NFC'
}
export function divisionOf(year:number,id:TeamId){
  if(year<1970) return conferenceOf(year,id)==='AFL' ? 'AFL' : id==='dal'||id==='was'||id==='nyg'||id==='cle'||id==='phi' ? 'East' : 'West'
  if(year<2002) return conferenceOf(year,id)==='AFC' ? (['buf','mia','nwe','nyj'].includes(id)?'East':['pit','cle','cin','oti'].includes(id)?'Central':['den','kan','rai','sdg'].includes(id)?'West':'Other') : (['dal','nyg','phi','was'].includes(id)?'East':['chi','det','gnb','tam'].includes(id)?'Central':['atl','car','nor','sfo'].includes(id)?'West':'Other')
  const map:Record<string,string>={buf:'AFC East',mia:'AFC East',nwe:'AFC East',nyj:'AFC East',pit:'AFC North',cle:'AFC North',cin:'AFC North',rav:'AFC North',den:'AFC West',kan:'AFC West',rai:'AFC West',sdg:'AFC West',clt:'AFC South',jax:'AFC South',oti:'AFC South',htx:'AFC South',dal:'NFC East',nyg:'NFC East',phi:'NFC East',was:'NFC East',chi:'NFC North',det:'NFC North',gnb:'NFC North',min:'NFC North',atl:'NFC South',car:'NFC South',nor:'NFC South',tam:'NFC South',crd:'NFC West',ram:'NFC West',sfo:'NFC West',sea:'NFC West'}
  return map[id] ?? 'Independent'
}
export function locationOf(year:number,id:TeamId){ const m:Record<string,string>={nwe:year<=1970?'Boston': 'New England',rai:year<1982?'Oakland':year<1995?'Los Angeles':year<2020?'Oakland':'Las Vegas',ram:year<1995?'Los Angeles':year<2016?'St. Louis':'Los Angeles',crd:year<1988?'St. Louis':year<1994?'Phoenix':'Arizona',oti:year<1997?'Houston':year<1999?'Tennessee':'Tennessee'}; return m[id] ?? id.toUpperCase() }
export const expansionSpecs:Record<number,{id:TeamId;name:string;coach:string}>={1967:{id:'nor',name:'Saints',coach:'Tom Fears'},1968:{id:'cin',name:'Bengals',coach:'Paul Brown'},1976:{id:'tam',name:'Buccaneers',coach:'John McKay'},1976.1:{id:'sea',name:'Seahawks',coach:'Jack Patera'},1995:{id:'car',name:'Panthers',coach:'Dom Capers'},1995.1:{id:'jax',name:'Jaguars',coach:'Tom Coughlin'},1996:{id:'rav',name:'Ravens',coach:'Ted Marchibroda'},1999:{id:'cle',name:'Browns',coach:'Chris Palmer'},2002:{id:'htx',name:'Texans',coach:'Dom Capers'}}
export function activeTeams(year:number):TeamId[]{let ids=[...BASE_1966]; for(const y of Object.keys(expansionSpecs).map(Number).sort((a,b)=>a-b)){if(y<=year&&!ids.includes(expansionSpecs[y].id))ids.push(expansionSpecs[y].id)} if(year===1996)ids=ids.filter(id=>id!=='cle'); if(year>=1999&&!ids.includes('cle'))ids.push('cle'); return ids}
