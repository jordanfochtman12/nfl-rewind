/**
 * The club's helmet as the season on screen wore it, for the broadcast stand-in portrait: the
 * shell, the facemask, the stripe down the crown and the mark on the side. Close to the real
 * thing at card size, not a licensed logo.
 */
import type { Pos, TeamId } from "./types.ts";

export type HelmetMark = "none" | "star" | "bolt" | "horn" | "ring" | "letter" | "stripes";

export interface Helmet {
  shell: string;
  mask: string;
  /** Crown stripe, outside in (e.g. green, white, green); empty for a plain crown. */
  stripe: string[];
  mark: HelmetMark;
  markColor: string;
  /** The side letter, for mark "letter". */
  letter?: string;
}

const GRAY = "#8f969e";

function h(
  shell: string,
  mask: string,
  stripe: string[],
  mark: HelmetMark,
  markColor: string,
  letter?: string,
): Helmet {
  return { shell, mask, stripe, mark, markColor, letter };
}

/** His club's helmet in `year`. */
export function helmetOf(id: TeamId, year: number): Helmet {
  const old = year < 1980;
  switch (id) {
    case "atl":
      return year < 1990
        ? h("#a71930", GRAY, ["#000", "#fff", "#000"], "ring", "#000")
        : h("#101820", old ? GRAY : "#101820", ["#a71930", "#fff", "#a71930"], "ring", "#a71930");
    case "ram":
      return year < 2000 || year >= 2020
        ? h(year >= 2020 ? "#003594" : "#00337c", old ? GRAY : "#00337c", [], "horn", "#ffd100")
        : h("#002244", "#002244", [], "horn", "#c9a96e");
    case "pit":
      return h("#101820", old ? GRAY : "#101820", ["#ffb612"], "ring", "#ffb612");
    case "phi":
      return year < 1996
        ? h("#00863f", GRAY, [], "horn", "#c0c5cb")
        : h("#004c54", "#101820", [], "horn", "#c0c5cb");
    case "dal":
      return h(
        "#a5acb5",
        year < 1985 ? GRAY : "#041e42",
        ["#041e42", "#fff", "#041e42"],
        "star",
        "#041e42",
      );
    case "was":
      return h(
        "#5a1414",
        year < 1978 ? GRAY : "#ffb612",
        ["#ffb612", "#fff", "#ffb612"],
        "letter",
        "#ffb612",
        "R",
      );
    case "min":
      return h("#4f2683", old ? GRAY : "#4f2683", [], "horn", "#fff");
    case "crd":
      return h("#fff", GRAY, [], "ring", "#97233f");
    case "gnb":
      return h(
        "#ffb612",
        old ? GRAY : "#203731",
        ["#203731", "#fff", "#203731"],
        "letter",
        "#203731",
        "G",
      );
    case "nyg":
      return h(
        "#0b2265",
        GRAY,
        year >= 1976 ? ["#a71930", "#fff", "#a71930"] : [],
        "letter",
        year >= 1976 && year < 2000 ? "#a71930" : "#fff",
        year >= 1976 && year < 2000 ? "G" : "ny",
      );
    case "sfo":
      return h(
        "#b3995d",
        year < 1996 ? GRAY : "#aa0000",
        ["#aa0000", "#fff", "#aa0000"],
        "ring",
        "#aa0000",
      );
    case "chi":
      return h("#0b162a", GRAY, [], "letter", "#c83803", "C");
    case "cle":
      return h(
        "#ff3c00",
        year < 2006 ? GRAY : "#311d00",
        ["#311d00", "#fff", "#311d00"],
        "none",
        "#311d00",
      );
    case "clt":
      return h("#fff", GRAY, ["#002c5f"], "ring", "#002c5f");
    case "det":
      return h(
        "#b0b7bc",
        year < 1983 ? GRAY : "#0076b6",
        ["#0076b6", "#fff", "#0076b6"],
        "ring",
        "#0076b6",
      );
    case "mia":
      return h(
        "#fff",
        year < 1980 ? GRAY : "#008e97",
        ["#fc4c02", "#008e97", "#fc4c02"],
        "ring",
        "#008e97",
      );
    case "den":
      return year < 1997
        ? h("#0a2343", GRAY, ["#fb4f14", "#fff", "#fb4f14"], "letter", "#fb4f14", "D")
        : h("#0a2343", "#0a2343", ["#fb4f14"], "horn", "#fb4f14");
    case "oti":
      return year < 1997
        ? h(
            year < 1981 ? "#fff" : "#6cace4",
            GRAY,
            ["#c8102e", "#fff", "#c8102e"],
            "ring",
            "#c8102e",
          )
        : h("#fff", "#0c2340", ["#4b92db", "#c8102e", "#4b92db"], "ring", "#4b92db");
    case "nwe":
      return year < 1993
        ? h("#fff", GRAY, ["#c60c30", "#002244", "#c60c30"], "ring", "#c60c30")
        : h("#b0b7bc", "#002244", ["#002244", "#fff", "#c60c30"], "horn", "#002244");
    case "buf":
      return year >= 1984 && year < 2011
        ? h("#c60c30", "#00338d", ["#00338d", "#fff", "#00338d"], "horn", "#00338d")
        : h(
            "#fff",
            year < 1984 ? GRAY : "#00338d",
            ["#c60c30", "#00338d", "#c60c30"],
            "horn",
            "#00338d",
          );
    case "nyj":
      return year < 1978
        ? h("#fff", GRAY, ["#125740"], "ring", "#125740")
        : h("#125740", year < 1998 ? GRAY : "#fff", ["#fff"], "ring", "#fff");
    case "rai":
      return h("#a5acaf", GRAY, ["#000"], "ring", "#000");
    case "sdg":
      return h(
        year >= 1974 && year < 1988 ? "#002244" : "#fff",
        year >= 1974 && year < 1988 ? "#ffc20e" : GRAY,
        ["#002244", "#ffc20e", "#002244"],
        "bolt",
        "#ffc20e",
      );
    case "kan":
      return h("#e31837", old ? GRAY : "#fff", ["#fff", "#000", "#fff"], "ring", "#fff");
    case "nor":
      return h(
        "#d3bc8d",
        old ? GRAY : "#101820",
        ["#101820", "#fff", "#101820"],
        "ring",
        "#101820",
      );
    case "cin":
      return year < 1981
        ? h("#fb4f14", GRAY, [], "letter", "#000", "B")
        : h("#fb4f14", "#000", [], "stripes", "#000");
    case "tam":
      return year < 1997
        ? h("#fff", GRAY, ["#d50a0a"], "ring", "#ff7f00")
        : h("#7d7a75", "#34302b", ["#d50a0a"], "ring", "#d50a0a");
    case "sea":
      return h(
        year < 2002 ? "#a5acaf" : year < 2012 ? "#4e5d6c" : "#002244",
        year < 2002 ? GRAY : "#002244",
        ["#002244", "#fff", "#002244"],
        "horn",
        year < 2002 ? "#002244" : "#69be28",
      );
    case "car":
      return h("#a5acaf", "#101820", ["#0085ca"], "horn", "#0085ca");
    case "jax":
      return h("#101820", "#101820", ["#9f792c", "#006778"], "horn", "#d7a22a");
    case "rav":
      return h("#241773", "#000", [], "horn", "#000");
    case "htx":
      return h("#03202f", "#03202f", [], "ring", "#a71930");
  }
}

export type MaskStyle = "bar" | "twobar" | "cage" | "modern";

/** The facemask he'd have worn: one bar for the old kickers, a cage up front, the wraparound today. */
export function maskOf(pos: Pos, year: number): MaskStyle {
  const line = ["LT", "LG", "C", "RG", "RT", "DE", "DT", "MLB", "OLB", "TE", "FB"].includes(pos);
  if (year >= 1996) return line ? "cage" : "modern";
  if ((pos === "K" || pos === "P") && year < 1990) return "bar";
  if (line) return "cage";
  return pos === "QB" && year < 1980 ? "bar" : "twobar";
}
