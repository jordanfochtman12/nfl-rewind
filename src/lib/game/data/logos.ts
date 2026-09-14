/** Period-accurate club marks. Inclusive `from` year; last match wins, including returns. */
import type { TeamId } from "../types.ts";

export interface LogoEra {
  from: number;
  file: string;
}

export const LOGO_ERAS: Record<TeamId, LogoEra[]> = {
  atl: [
    { from: 1966, file: "atl.svg" },
    { from: 1990, file: "atl-modern.svg" },
    { from: 2003, file: "atl-2003.svg" },
  ],
  ram: [
    { from: 1948, file: "ram.svg" },
    { from: 2000, file: "ram-stl.svg" },
    { from: 2016, file: "ram-modern.svg" },
    { from: 2020, file: "ram-2020.svg" },
  ],
  pit: [{ from: 1962, file: "pit.svg" }],
  phi: [
    { from: 1948, file: "phi.svg" },
    { from: 1996, file: "phi-1996.svg" },
  ],
  dal: [{ from: 1964, file: "dal.svg" }],
  was: [
    { from: 1966, file: "was.svg" },
    { from: 2020, file: "was-wft.svg" },
    { from: 2022, file: "was-cmd.svg" },
  ],
  min: [
    { from: 1966, file: "min.svg" },
    { from: 2013, file: "min-2013.svg" },
  ],
  crd: [
    { from: 1960, file: "crd.svg" },
    { from: 2005, file: "crd-2005.svg" },
  ],
  gnb: [{ from: 1961, file: "gnb.svg" }],
  nyg: [
    { from: 1961, file: "nyg.svg" },
    { from: 1976, file: "nyg-1976.svg" },
  ],
  sfo: [
    { from: 1946, file: "sfo-early.svg" },
    { from: 1968, file: "sfo.svg" },
  ],
  chi: [{ from: 1962, file: "chi.svg" }],
  cle: [{ from: 1946, file: "cle.svg" }],
  clt: [{ from: 1953, file: "clt.svg" }],
  det: [
    { from: 1961, file: "det.svg" },
    { from: 1970, file: "det-1970.svg" },
    { from: 2009, file: "det-2009.svg" },
  ],
  mia: [
    { from: 1966, file: "mia.svg" },
    { from: 2013, file: "mia-2013.svg" },
  ],
  den: [
    { from: 1968, file: "den.svg" },
    { from: 1997, file: "den-modern.svg" },
  ],
  oti: [
    { from: 1960, file: "oti.svg" },
    { from: 1999, file: "oti-titans.svg" },
    { from: 2018, file: "oti-2018.svg" },
  ],
  nwe: [
    { from: 1961, file: "nwe.svg" },
    { from: 1993, file: "nwe-modern.svg" },
    { from: 2000, file: "nwe-2000.svg" },
  ],
  buf: [
    { from: 1962, file: "buf.svg" },
    { from: 1974, file: "buf-modern.svg" },
  ],
  nyj: [
    { from: 1963, file: "nyj.svg" },
    { from: 1978, file: "nyj-jets.svg" },
    { from: 1998, file: "nyj-modern.svg" },
    { from: 2019, file: "nyj-jets.svg" },
  ],
  rai: [{ from: 1963, file: "rai.svg" }],
  sdg: [
    { from: 1961, file: "sdg.svg" },
    { from: 1988, file: "sdg-modern.svg" },
    { from: 2007, file: "sdg.svg" },
    { from: 2017, file: "sdg-modern.svg" },
    { from: 2020, file: "sdg.svg" },
  ],
  kan: [{ from: 1963, file: "kan.svg" }],
  nor: [{ from: 1967, file: "nor.svg" }],
  cin: [
    { from: 1968, file: "cin.svg" },
    { from: 1981, file: "cin-modern.svg" },
    { from: 2004, file: "cin-2004.svg" },
  ],
  tam: [
    { from: 1976, file: "tam.svg" },
    { from: 1997, file: "tam-modern.svg" },
    { from: 2014, file: "tam-2014.svg" },
  ],
  sea: [
    { from: 1976, file: "sea.svg" },
    { from: 2002, file: "sea-modern.svg" },
  ],
  car: [
    { from: 1995, file: "car.svg" },
    { from: 2012, file: "car-2012.svg" },
  ],
  jax: [
    { from: 1995, file: "jax.svg" },
    { from: 2013, file: "jax-2013.svg" },
  ],
  rav: [{ from: 1996, file: "rav.svg" }],
  htx: [{ from: 2002, file: "htx.svg" }],
};

export function logoSrc(year: number, id: TeamId): string {
  const eras = LOGO_ERAS[id];
  let file = `${id}.svg`;
  for (const e of eras) {
    if (year >= e.from) file = e.file;
  }
  return `/logos/${file}`;
}
