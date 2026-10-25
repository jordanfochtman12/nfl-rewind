/** The first-time walkthroughs: watch mode and TV mode. */
export interface TourStep {
  title: string;
  body: string;
  /** data-tour id of the control this step is about. */
  target?: string;
}

export const WATCH_TOUR: TourStep[] = [
  { title: "Watch history", body: "Every club is on autopilot with real rosters, real draft classes and real coaches. You just watch the league write its own history, with real results next to every score." },
  { title: "Move the calendar", body: "This button takes the next step: the next pick, the next week, the next round. Its label always says what it will do.", target: "watch-next" },
  { title: "Sit back", body: "Auto-play runs the calendar for you and stops for the big nights. The sim buttons jump ahead to the playoffs, the Super Bowl or next year's draft.", target: "watch-auto" },
  { title: "TV mode", body: "The whole season as one broadcast: preview show, every Sunday's whip-around, studio recaps, the Super Bowl live, awards night and the draft. Great on a phone you can prop up.", target: "watch-tv" },
  { title: "Everything else", body: "Standings, stats, the league's record books, team histories and the Hall of Fame are in these tabs.", target: "tabs" },
  { title: "Make it yours", body: "Voices, music, auto-play speed, TV options, the era broadcast look and storage are in Settings. You can replay this tour from there.", target: "settings" },
];

export const TV_TOUR: TourStep[] = [
  { title: "Rewind TV", body: "The channel runs itself. Each segment hands off to the next: pregame, the whip-around, the studio recap, then the next week." },
  { title: "Hold", body: "Hold pauses the countdowns between segments, so you can read the storylines and races at your own pace.", target: "tv-hold" },
  { title: "Skip", body: "Skip ends the current segment and moves on.", target: "tv-skip" },
  { title: "The whip-around", body: "Every game plays at once. The channel cuts to scores, turnovers and red-zone trips; tap any game on the scoreboard to stay with it." },
  { title: "Step out any time", body: "Exit TV takes you back to the desk. Your place in the season is saved.", target: "tv-exit" },
];
