import type { PlayLog } from "./types.ts";

/** Spoken phrasing stays anchored to recorded results; no invented pressure or routes. */
export function boothLine(play: PlayLog, index: number): string {
  const text = play.text;
  const pass = text.match(/^(.+?) to (.+?) for (-?\d+) yards?\./);
  const run = text.match(/^(.+?) runs for (-?\d+) yards?\./);
  if (play.tag === "td") {
    if (!pass && !run) return text;
    const call = pass ? `${pass[1]} finds ${pass[2]}.` : run ? `${run[1]} takes it in.` : text;
    return `${call} Touchdown!${text.includes("kick is good") ? " And the extra point is good." : ""}`;
  }
  if (play.tag === "to") return `Turnover! ${text}`;
  if (pass) {
    const open =
      index % 2
        ? `${pass[1]}. Complete to ${pass[2]}, for ${pass[3]} yards.`
        : `${pass[1]} finds ${pass[2]}. A gain of ${pass[3]}.`;
    return `${open}${play.snap && play.snap.yards >= play.togo ? " That moves the chains." : ""}`;
  }
  if (run)
    return index % 2
      ? `${run[1]} with the carry. Picks up ${run[2]} yards.`
      : `${run[1]} on the ground, for ${run[2]}.${play.snap && play.snap.yards >= play.togo ? " First down." : ""}`;
  return text.replace(/ — /g, ". ").replace(/\bQ([1-4])\b/g, "quarter $1");
}

/* ------------------------------------------------------------------ the two-man booth */

export interface BoothLine {
  speaker: "PBP" | "COLOR";
  text: string;
}

export interface BoothContext {
  /** Club nicknames, for field position ("the Bears 35"). */
  nick: (id: string) => string;
  homeId: string;
  awayId: string;
  /** The booth's first names, so they talk to each other. */
  pbpFirst: string;
  colorFirst: string;
  colorBackground: string;
  prev?: PlayLog;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A phrase for this slot on this snap: it moves with every play, so two calls in a row differ. */
function pick(slot: string, index: number, list: readonly string[]): string {
  return list[(hash(slot) + index * 7) % list.length]!;
}

const DOWN = ["", "First", "Second", "Third", "Fourth"];

function where(play: PlayLog, ctx: BoothContext): string {
  const def = play.poss === ctx.homeId ? ctx.awayId : ctx.homeId;
  if (play.spot === 50) return "midfield";
  return play.spot < 50 ? `their own ${play.spot}` : `the ${ctx.nick(def)} ${100 - play.spot}`;
}

function situation(play: PlayLog, ctx: BoothContext): string {
  if (!play.down || play.down > 4) return "";
  const togo = play.spot + play.togo >= 100 ? "goal" : String(play.togo);
  return `${DOWN[play.down]} and ${togo} from ${where(play, ctx)}.`;
}

/**
 * The call for one snap: the play-by-play line, and on the plays that deserve it, the color
 * analyst's reaction. Built from the recorded result only, never an invented detail.
 */
export function boothCall(play: PlayLog, index: number, ctx: BoothContext): BoothLine[] {
  const text = play.text;
  const out: BoothLine[] = [];
  const pbp = (t: string) => out.push({ speaker: "PBP", text: t });
  const color = (t: string) => out.push({ speaker: "COLOR", text: t });
  const pass = text.match(/^(.+?) to (.+?) for (-?\d+) yards?\./);
  const run = text.match(/^(.+?) runs for (-?\d+) yards?\./);
  const loss = text.match(/^(.+?) dropped for a loss of (\d+)/);
  const inc = text.match(/^(.+?) incomplete\./);
  const sack = text.match(/^(.+?) sacked by (.+?)\./);
  const pick6 = text.match(/^(.+?) is intercepted by (.+?)\./);
  const fumble = text.match(/^(.+?) coughs it up/) ?? text.match(/\. (.+?) coughs it up/);
  const fg = text.match(/^(.+?) field goal is (good|no good)/);
  const punt = text.match(/^(.+?) punts (\d+) yards/);
  const hurt = text.match(/([A-Z][\w.'-]+(?: [A-Z][\w.'-]+)+) is (down|shaken up)/);
  const yards = play.snap?.yards ?? 0;
  const moved = !!play.snap && yards >= play.togo && play.down > 0;
  const lead = (play.down === 3 || play.down === 4) && (index + play.spot) % 3 === 0 ? `${situation(play, ctx)} ` : "";
  const P = ctx.pbpFirst;

  if (play.tag === "td") {
    if (pick6) {
      pbp(`${lead}${pick(`p6${index}`, index, [`Picked off by ${pick6[2]}! He's got nothing but green in front of him... touchdown!`, `${pick6[2]} jumps the route! Gone the other way! Touchdown!`, `Intercepted! ${pick6[2]}, and he takes it back for six!`])}`);
      color(pick(`p6c`, index, [`${P}, he read that quarterback's eyes the whole way. ${pick6[1]} never saw him.`, `That's a game-changer. You can't throw that ball late across the field.`, `Oh, that one stings. ${pick6[1]} will want that throw back.`]));
      return out;
    }
    if (pass) pbp(`${lead}${pick(`tdp`, index, [`${pass[1]} looking... fires for ${pass[2]}... touchdown!`, `${pass[1]} throws, ${pass[2]} has it! Touchdown!`, `${pass[1]} lofts it to ${pass[2]}... got it! Touchdown!`, `Here's ${pass[1]}, over the middle to ${pass[2]}, and he's in!`])}`);
    else if (run) pbp(`${lead}${pick(`tdr`, index, [`${run[1]} takes the handoff... he's in! Touchdown!`, `${run[1]} finds the hole and walks in for six!`, `${run[1]} pounds it in! Touchdown!`, `${run[1]} cuts back... he scores!`])}`);
    else pbp(text);
    if (text.includes("kick is good")) pbp(pick(`xp`, index, ["The extra point is good.", "And the kick is through.", "The point after is good."]));
    color(
      pass
        ? pick(`tdpc`, index, [`Look at the timing on that, ${P}. ${pass[2]} was open for about half a second and that was enough.`, `${pass[1]} stood in there and took a shot to deliver it. That's toughness.`, `The coverage busted on the back side and ${pass[1]} saw it right away.`, `Big-time throw, big-time catch. That's what you pay those guys for.`])
        : run
          ? pick(`tdrc`, index, [`The line won that one, ${P}. ${run[1]} could have walked in.`, `Low pad level, second effort. ${run[1]} just wanted it more.`, `That's how you finish a drive. Run it right at them.`, `Watch the pulling guard on the replay. He springs it.`])
          : `That's a big swing right there, ${P}.`,
    );
    return out;
  }
  if (play.tag === "to") {
    if (pick6) {
      pbp(`${lead}${pick(`int`, index, [`Intercepted! ${pick6[2]} steps in front of it!`, `${pick6[1]} throws... and it's picked off by ${pick6[2]}!`, `That's an interception! ${pick6[2]} with the ball!`])}`);
      color(pick(`intc`, index, [`${P}, that's a throw he can't make. He stared that receiver down from the snap.`, `Great read by ${pick6[2]}. He was sitting on that route the whole way.`, `You just can't give a defense free possessions like that.`, `The pressure got there a beat early and he threw it off his back foot.`]));
    } else if (fumble) {
      pbp(pick(`fum`, index, [`The ball is out! And the defense has it!`, `Fumble! ${fumble[1]} loses it and they recover!`, `He coughs it up! Turnover!`]));
      color(pick(`fumc`, index, [`Ball security, ${P}. You can't carry it away from your body in traffic.`, `They were punching at it all day and it finally came out.`, `That's a coach's nightmare. All that work and you give it right back.`]));
    } else {
      pbp(`Turnover! ${text}`);
      color(`That changes the whole feel of this game, ${P}.`);
    }
    return out;
  }
  if (sack) {
    pbp(`${lead}${pick(`sk`, index, [`${sack[1]} back to throw... and he's buried by ${sack[2]}!`, `Pressure! ${sack[2]} gets home and brings ${sack[1]} down.`, `${sack[1]} has nowhere to go. Sacked by ${sack[2]}.`, `${sack[2]} comes clean and takes ${sack[1]} down.`])}`);
    if ((index + play.spot) % 2 === 0)
      color(pick(`skc`, index, [`${sack[2]} beat his man off the edge before the quarterback even finished his drop.`, `That's a coverage sack, ${P}. Nobody was open, so he had to hold it.`, `They ran a stunt up front and the protection never picked it up.`, `As a ${ctx.colorBackground}, I'll tell you, that's the play that wins you the down and distance battle.`]));
    return out;
  }
  if (pass) {
    const g = Number(pass[3]);
    pbp(
      `${lead}${
        g >= 20
          ? pick(`bigp`, index, [`${pass[1]} goes deep... caught by ${pass[2]}! That's ${g} yards!`, `${pass[1]} lets it fly... ${pass[2]} hauls it in for ${g}!`, `A strike from ${pass[1]} to ${pass[2]}, and that's a chunk of ${g} yards.`])
          : g <= 0
            ? pick(`shp`, index, [`${pass[1]} dumps it to ${pass[2]}, who's tackled for no gain.`, `Quick throw to ${pass[2]}, and he's stopped right there.`])
            : pick(`p`, index, [`${pass[1]} finds ${pass[2]} for ${g}.`, `${pass[1]} to ${pass[2]}, a gain of ${g}.`, `Complete to ${pass[2]}. ${g} yards on the play.`, `${pass[1]} hits ${pass[2]} underneath, picks up ${g}.`, `${pass[2]} makes the grab for ${g}.`])
      }${moved ? pick(`fd`, index, [" That's a first down.", " And that moves the chains.", " First down."]) : ""}`,
    );
    if (g >= 20 || (moved && play.down >= 3))
      color(
        g >= 20
          ? pick(`bigpc`, index, [`${P}, that's a safety who bit on the play fake. ${pass[2]} was all alone.`, `${pass[1]} put that one right on the money. Couldn't have thrown it any better.`, `That's what this offense has been waiting for. A shot down the field.`, `You see the release off the line by ${pass[2]}? He won that rep right away.`])
          : pick(`3dc`, index, [`Big conversion. That's where you win games, on third down.`, `${pass[1]} hung in there and found his guy past the sticks. That's veteran stuff.`, `Smart route by ${pass[2]}, ${P}. He knew exactly where the marker was.`]),
      );
    return out;
  }
  if (inc) {
    pbp(`${lead}${pick(`inc`, index, [`${inc[1]} throws... incomplete.`, `Pass falls incomplete.`, `${inc[1]}'s pass is off the mark.`, `Incomplete, intended for the sideline.`, `${inc[1]} fires... broken up!`])}${text.includes("Two-minute warning") ? " And that will bring us to the two-minute warning." : ""}`);
    if (play.down === 4) color(`They gambled on fourth down and came up empty, ${P}. Turnover on downs.`);
    return out;
  }
  if (run) {
    const g = Number(run[2]);
    pbp(
      `${lead}${
        g >= 15
          ? pick(`bigr`, index, [`${run[1]} breaks into the clear! He's off for ${g}!`, `${run[1]} bounces it outside... and he's got room! ${g} yards!`, `${run[1]} through the hole, and he's into the secondary! A gain of ${g}.`])
          : g <= 1
            ? pick(`shr`, index, [`${run[1]} is stopped at the line.`, `${run[1]} gets nowhere. Stuffed.`, `${run[1]} into the pile, not much there.`])
            : pick(`r`, index, [`${run[1]} up the middle for ${g}.`, `Handoff to ${run[1]}, and he picks up ${g}.`, `${run[1]} off tackle, ${g} yards.`, `${run[1]} carries for ${g}.`, `${run[1]} slashes ahead for ${g}.`])
      }${moved ? pick(`fdr`, index, [" First down.", " He gets the first down.", " That's enough for the first."]) : ""}`,
    );
    if (g >= 15) color(pick(`bigrc`, index, [`${P}, look at that cut. He saw the backside open up and he was gone.`, `The offensive line is starting to lean on them now.`, `That's a back who's getting stronger as the game goes on.`]));
    else if (g <= 1 && (index % 4 === 0)) color(pick(`stuffc`, index, [`They had a hat on a hat there. Nowhere to go.`, `The defensive line got great penetration, ${P}.`, `That's the front seven winning at the point of attack.`]));
  } else if (loss) {
    pbp(pick(`loss`, index, [`${loss[1]} is dropped behind the line, a loss of ${loss[2]}.`, `${loss[1]} gets swarmed in the backfield. Lost ${loss[2]}.`]));
  } else if (fg) {
    pbp(fg[2] === "good" ? pick(`fg`, index, [`${fg[1]}, the kick is up... it's good!`, `The snap, the hold, the kick... good.`, `${fg[1]} puts it right down the middle.`]) : pick(`fgx`, index, [`${fg[1]}'s kick is up... and it's no good!`, `The kick is wide! No good.`]));
    if (fg[2] !== "good") color(pick(`fgxc`, index, [`Points left on the board, ${P}. That could come back to haunt them.`, `You can't come away empty in a game like this.`]));
  } else if (punt) {
    if (/blocked/i.test(text)) {
      pbp(pick(`blk`, index, [`${punt[1]} back to punt... and it's blocked! The ball is loose!`, `The punt is blocked! Somebody came free up the middle!`]));
      color(pick(`blkc`, index, [`${P}, that's a breakdown in protection. Somebody didn't block anybody.`, `Huge special teams play. That can swing a whole game.`]));
    } else pbp(pick(`punt`, index, [`${punt[1]} drops back to punt... a ${punt[2]}-yarder.`, `Here's the punt from ${punt[1]}, ${punt[2]} yards.`, `${punt[1]} gets a good foot into it. ${punt[2]} yards.`]));
  } else pbp(text.replace(/ — /g, ". ").replace(/\bQ([1-4])\b/g, "quarter $1"));

  if (hurt && !out.some((l) => l.speaker === "COLOR"))
    color(pick(`hurt`, index, [`Never want to see that, ${P}. ${hurt[1]} is down and the trainers are coming out.`, `Let's hope it's nothing serious. ${hurt[1]} has meant a lot to this team.`, `That's a big piece for them if he can't go.`]));
  // Now and then the analyst steps in on an ordinary snap, the way a booth breathes.
  else if (!out.some((l) => l.speaker === "COLOR") && hash(`aside${index}${play.poss}`) % 9 === 0 && play.q <= 4)
    color(
      pick(`aside`, index, [
        `You know, ${P}, the thing I notice is how patient they've been calling this.`,
        `Watch the line of scrimmage on the next one. That's where this game is being decided.`,
        `I like the tempo here. They're not letting the defense substitute.`,
        `As a ${ctx.colorBackground}, this is the kind of drive that wears on you.`,
        `They're going to need some points before the half, ${P}. The field position is shifting.`,
        `Both sides are playing it close to the vest so far.`,
      ]),
    );
  return out;
}
