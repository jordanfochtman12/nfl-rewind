import { useMemo } from 'react';
import { ArrowUpRight, Activity, Shield, Target, Users, CalendarDays, TrendingUp } from 'lucide-react';
import { useGameStore, type Tab } from '@/lib/game-store';
import { displayName, nicknameOf, rosterOf, deskHoles, formatMoney, teamPayroll, standingRows, venueOf, superBowlSite } from '@/lib/game';
import type { TeamId } from '@/lib/game';
import { nextMatchup, seasonForm, unitReport } from '@/lib/game/briefing';
import { Logo } from './chrome';

export function FranchiseHQ() {
  const save = useGameStore(s => s.save)!;
  const setTab = useGameStore(s => s.setTab);
  const live = useGameStore(s => s.liveGameId);
  const units = useMemo(() => unitReport(save, save.userTeamId), [save]);
  const form = useMemo(() => seasonForm(save, save.userTeamId, live), [save, live]);
  const roster = rosterOf(save, save.userTeamId);
  const holes = deskHoles(save, save.userTeamId);
  const hurt = roster.filter(p => p.injuredWeeks > 0 || p.onIR);
  const holdouts = roster.filter(p => p.holdout);
  const group = standingRows(save).find(g => g.teams.some(t => t.id === save.userTeamId));
  const rank = (group?.teams.findIndex(t => t.id === save.userTeamId) ?? -1) + 1;
  const payroll = teamPayroll(save, save.userTeamId);
  const scored = form.reduce((n, g) => n + g.scored, 0);
  const allowed = form.reduce((n, g) => n + g.allowed, 0);
  const priorities: { title: string; detail: string; tab: Tab; urgent?: boolean }[] = [];
  if (holdouts.length) priorities.push({ title: `${holdouts.length} contract holdout${holdouts.length > 1 ? 's' : ''}`, detail: 'Resolve negotiations in the office before kickoff.', tab: 'office', urgent: true });
  if (holes.length) priorities.push({ title: `Reinforce ${holes.slice(0, 3).map(h => h.pos).join(' / ')}`, detail: `${holes.length} positions below the depth target. Explore the market.`, tab: 'market', urgent: true });
  if (hurt.length) priorities.push({ title: `${hurt.length} unavailable player${hurt.length > 1 ? 's' : ''}`, detail: 'Review injuries and set your replacement starters.', tab: 'depth', urgent: true });
  if (save.salaryCap && payroll > save.salaryCap) priorities.push({ title: 'Over the salary cap', detail: `${formatMoney(payroll - save.salaryCap, save.year)} above the limit. Review contracts.`, tab: 'roster', urgent: true });
  priorities.push({ title: 'Prepare the call sheet', detail: 'Choose your attack, tempo and fourth-down approach.', tab: 'staff' });
  priorities.push({ title: 'Know your division', detail: 'Study the race and the road to the postseason.', tab: 'standings' });
  return <section className="hq" aria-label="Franchise intelligence">
    <div className="hq-section-heading"><div><span className="hq-eyebrow">FRANCHISE INTELLIGENCE</span><h2>Your week. Your decisions.</h2></div><span className="hq-season-tag">{save.year} / {save.weekLabel}</span></div>
    <div className="hq-metrics">
      <button onClick={() => setTab('standings')} className="hq-metric"><TrendingUp size={18}/><span>Division standing</span><strong>{live || !form.length ? '—' : `#${rank}`}<small>{group ? `${group.conf} ${group.div}` : ''}</small></strong></button>
      <button onClick={() => setTab('stats')} className="hq-metric"><Activity size={18}/><span>Points per game</span><strong>{form.length ? (scored / form.length).toFixed(1) : '—'}<small>{form.length ? `${(allowed / form.length).toFixed(1)} allowed` : 'Awaiting kickoff'}</small></strong></button>
      <button onClick={() => setTab('roster')} className="hq-metric"><Users size={18}/><span>Available players</span><strong>{roster.filter(p => !p.onIR && p.injuredWeeks <= 0 && !p.holdout).length}<small>of {roster.length} on the roster</small></strong></button>
      <button onClick={() => setTab('market')} className="hq-metric"><Shield size={18}/><span>{save.salaryCap ? 'Cap space' : 'Annual payroll'}</span><strong>{formatMoney(save.salaryCap ? save.salaryCap - payroll : payroll, save.year)}<small>{save.salaryCap ? 'Manage your commitments' : 'No salary cap in this era'}</small></strong></button>
    </div>
    <div className="hq-grid">
      <article className="hq-panel"><div className="hq-panel-heading"><h3><Target size={17}/> On your desk</h3><span>{priorities.filter(p => p.urgent).length} priorities</span></div>
        <div className="hq-actions">{priorities.slice(0, 4).map(p => <button key={p.title} onClick={() => setTab(p.tab)}><span className={`hq-dot ${p.urgent ? 'urgent' : ''}`}/><span><strong>{p.title}</strong><small>{p.detail}</small></span><ArrowUpRight size={17}/></button>)}</div>
      </article>
      <article className="hq-panel"><div className="hq-panel-heading"><h3><Shield size={17}/> Personnel report</h3><button onClick={() => setTab('depth')}>Depth chart ↗</button></div>
        <p className="hq-caption">Available starters · scouting grades · vacancies count as zero</p>
        <div className="hq-units">{units.map(u => <div key={u.name}><span>{u.name}</span><div className="hq-bar" role="meter" aria-label={u.name} aria-valuemin={0} aria-valuemax={99} aria-valuenow={u.grade}><i style={{ width: `${u.grade}%` }} /></div><b>{u.grade}</b><small>{u.available}/{u.slots}</small></div>)}</div>
      </article>
    </div>
    <OpponentPreview />
    <article className="hq-panel"><div className="hq-panel-heading"><h3><CalendarDays size={17}/> Season pulse</h3><button onClick={() => setTab('schedule')}>Full schedule ↗</button></div>
      {form.length ? <div className="hq-form">{form.slice(-6).map(g => <button key={g.id} onClick={() => setTab('schedule')} aria-label={`Week ${g.week}, ${g.result}, ${nicknameOf(save.year, g.opponent)}, ${g.scored} to ${g.allowed}`}><span>WEEK {g.week}</span><Logo id={g.opponent} year={save.year} size={30}/><strong>{g.home ? 'vs' : '@'} {nicknameOf(save.year, g.opponent)}</strong><b className={g.result === 'W' ? 'text-good' : g.result === 'L' ? 'text-brick' : 'text-muted'}>{g.result} <em>{g.scored}–{g.allowed}</em></b></button>)}</div> : <p className="hq-empty">A new chapter starts here. Your results and recent form appear after the first game.</p>}
    </article>
  </section>;
}

export function OpponentPreview() {
  const save = useGameStore(s => s.save)!;
  const setTab = useGameStore(s => s.setTab);
  const game = nextMatchup(save);
  const opponent = game ? (game.homeId === save.userTeamId ? game.awayId : game.homeId) as TeamId : null;
  const report = useMemo(() => opponent ? unitReport(save, opponent) : [], [save, opponent]);
  if (!game || !opponent) return null;
  const team = save.teams[opponent];
  const strongest = [...report].sort((a, b) => b.grade - a.grade)[0];
  const weakest = [...report].sort((a, b) => a.grade - b.grade)[0];
  const neutral = game.neutral || game.phase === 'superBowl';
  const site = game.phase === 'superBowl' ? superBowlSite(save.year).site : game.site ?? venueOf(save.year, game.homeId as TeamId).stadium;
  return <article className="hq-matchup">
    <div className="hq-matchup-club"><span className="hq-eyebrow">NEXT OPPONENT / {neutral ? 'NEUTRAL SITE' : game.homeId === save.userTeamId ? 'HOME' : 'AWAY'}</span><div><Logo id={opponent} year={save.year} size={64}/><div><h3>{displayName(save.year, opponent)}</h3><p>{team.wins}–{team.losses}{team.ties ? `–${team.ties}` : ''} · {site}</p></div></div><span className="hq-caption">{team.offScheme} offense / {team.defScheme} defense</span></div>
    <div className="hq-matchup-notes"><div><span className="hq-eyebrow">RESPECT THE STRENGTH</span><strong>{strongest.name} <b>{strongest.grade}</b></strong><p>Account for their strongest available unit in your game plan.</p></div><div><span className="hq-eyebrow">LOOK FOR AN EDGE</span><strong>{weakest.name} <b>{weakest.grade}</b></strong><p>Their lowest graded unit. Compare it with your personnel.</p></div><button className="hq-link" onClick={() => setTab('staff')}>Build your game plan <ArrowUpRight size={16}/></button></div>
  </article>;
}
