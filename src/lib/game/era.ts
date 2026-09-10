export interface EraProfile {
  name: string;
  cmpPct: number;
  passAtt: number;
  ypa: number;
  intRate: number;
  sackRate: number;
  rushAtt: number;
  ypc: number;
  pointsMu: number;
  teRecCap: number;
  recCap: number;
  rushTdCap: number;
  passTdCap: number;
  intCap: number;
  sackCap: number;
  teamSackCap: number;
}

export function eraProfile(year: number): EraProfile {
  if (year <= 1969) {
    return {
      name: "pre-merger",
      cmpPct: 0.505,
      passAtt: 28,
      ypa: 6.7,
      intRate: 0.055,
      sackRate: 0.07,
      rushAtt: 35,
      ypc: 3.85,
      pointsMu: 21.4,
      teRecCap: 55,
      recCap: 75,
      rushTdCap: 16,
      passTdCap: 32,
      intCap: 28,
      sackCap: 18,
      teamSackCap: 42,
    };
  }
  if (year <= 1977) {
    return {
      name: "dead-ball",
      cmpPct: 0.52,
      passAtt: 29.5,
      ypa: 6.6,
      intRate: 0.05,
      sackRate: 0.075,
      rushAtt: 34,
      ypc: 3.8,
      pointsMu: 19.8,
      teRecCap: 60,
      recCap: 80,
      rushTdCap: 16,
      passTdCap: 30,
      intCap: 24,
      sackCap: 20,
      teamSackCap: 48,
    };
  }
  if (year <= 1989) {
    return {
      name: "pass-boom",
      cmpPct: 0.545,
      passAtt: 32,
      ypa: 6.9,
      intRate: 0.042,
      sackRate: 0.072,
      rushAtt: 32,
      ypc: 3.95,
      pointsMu: 20.8,
      teRecCap: 70,
      recCap: 95,
      rushTdCap: 18,
      passTdCap: 38,
      intCap: 22,
      sackCap: 22,
      teamSackCap: 55,
    };
  }
  if (year <= 1999) {
    return {
      name: "nineties",
      cmpPct: 0.575,
      passAtt: 33,
      ypa: 6.9,
      intRate: 0.034,
      sackRate: 0.068,
      rushAtt: 29,
      ypc: 4.0,
      pointsMu: 21.5,
      teRecCap: 80,
      recCap: 105,
      rushTdCap: 18,
      passTdCap: 40,
      intCap: 20,
      sackCap: 20,
      teamSackCap: 52,
    };
  }
  if (year <= 2009) {
    return {
      name: "aughts",
      cmpPct: 0.60,
      passAtt: 33.5,
      ypa: 7.0,
      intRate: 0.03,
      sackRate: 0.065,
      rushAtt: 28,
      ypc: 4.1,
      pointsMu: 21.8,
      teRecCap: 90,
      recCap: 110,
      rushTdCap: 20,
      passTdCap: 42,
      intCap: 18,
      sackCap: 20,
      teamSackCap: 50,
    };
  }
  if (year <= 2019) {
    return {
      name: "spread",
      cmpPct: 0.63,
      passAtt: 35,
      ypa: 7.2,
      intRate: 0.025,
      sackRate: 0.062,
      rushAtt: 27,
      ypc: 4.2,
      pointsMu: 23.2,
      teRecCap: 100,
      recCap: 120,
      rushTdCap: 20,
      passTdCap: 48,
      intCap: 16,
      sackCap: 20,
      teamSackCap: 50,
    };
  }
  return {
    name: "modern",
    cmpPct: 0.65,
    passAtt: 35,
    ypa: 7.2,
    intRate: 0.023,
    sackRate: 0.063,
    rushAtt: 27,
    ypc: 4.25,
    pointsMu: 23.0,
    teRecCap: 110,
    recCap: 130,
    rushTdCap: 20,
    passTdCap: 50,
    intCap: 15,
    sackCap: 19,
    teamSackCap: 52,
  };
}

export function playoffTeamCount(year: number): { perConf: number; total: number } {
  if (year < 1970) {
    if (year === 1969) return { perConf: 4, total: 8 };
    if (year >= 1967) return { perConf: 4, total: 6 };
    return { perConf: 1, total: 4 };
  }
  if (year <= 1977) return { perConf: 4, total: 8 };
  if (year <= 1989) return { perConf: 5, total: 10 };
  if (year <= 2019) return { perConf: 6, total: 12 };
  return { perConf: 7, total: 14 };
}
