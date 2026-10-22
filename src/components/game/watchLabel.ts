import { weekIsInTheBooks, type DynastySave } from "@/lib/game";

/** What the next press does, said the way a viewer would. */
export function watchLabel(save: DynastySave): string {
  switch (save.phase) {
    case "preDraft":
      return "Open the draft room";
    case "draft":
      return "Next pick";
    case "freeAgency":
      return "Close free agency";
    case "expansion":
      return save.expansion?.done ? "On to the college draft" : "Finish the expansion draft";
    case "preseason":
      return save.camp?.year === save.year ? "Kick off the season" : "Open training camp";
    case "regular":
      return weekIsInTheBooks(save) ? "Next week" : `Play week ${save.week}`;
    case "deadline":
      return "Close the trade window";
    case "playoffs":
      return save.weekFilm ? (save.playoffGames.some((g) => !g.played) ? "Next round" : "On to the Super Bowl") : "Play the round";
    case "superBowl":
      return save.superBowl?.played ? "On to awards night" : "Play the Super Bowl";
    case "awards":
      return "The Pro Bowl";
    case "proBowl":
      return "Retirements";
    case "retirement":
      return "The Hall of Fame";
    case "hof":
      return "The coaching carousel";
    case "carousel":
      return "Turn the calendar";
    case "relocation":
      return "Continue";
    case "complete":
      return "The end of the line";
    default:
      return "Continue";
  }
}
