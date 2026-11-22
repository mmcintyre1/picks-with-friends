import { Market, Side, TeamSide } from "@/app/generated/prisma/enums";
import { normalizePlayerName } from "@/lib/playerstats/gamelogStats";
import { teamNamesMatch } from "@/lib/teamNamesMatch";

// Same-game correlation, detected from the legs themselves (no odds-API cost). A sportsbook
// prices a same-game parlay below the multiplied odds when its legs tend to hit together --
// e.g. four Jets legs showing +1125 multiplied vs +625 at DraftKings -- so this flags those
// pairs where people can see them: while making a pick, and on the parlay.

export type CorrelationLeg = {
  owner: string;
  homeTeam: string;
  awayTeam: string;
  market: Market;
  side: Side;
  teamSide: TeamSide | null;
  playerName: string | null;
  propType: string | null;
  // The real team the player is on (for prop legs), if a roster could resolve it.
  playerTeam: string | null;
  summary: string;
};

export type CorrelationDirection = "together" | "against" | "sameGame";

export type Correlation = { a: CorrelationLeg; b: CorrelationLeg; direction: CorrelationDirection; reason: string };

// Per game, the roster: normalized player name -> team name. Built server-side from ESPN.
export type GameRoster = { homeTeam: string; awayTeam: string; players: Record<string, string> };

export function sameGame(a: { homeTeam: string; awayTeam: string }, b: { homeTeam: string; awayTeam: string }): boolean {
  return (
    (teamNamesMatch(a.homeTeam, b.homeTeam) && teamNamesMatch(a.awayTeam, b.awayTeam)) ||
    (teamNamesMatch(a.homeTeam, b.awayTeam) && teamNamesMatch(a.awayTeam, b.homeTeam))
  );
}

export function resolvePlayerTeam(rosters: GameRoster[], game: { homeTeam: string; awayTeam: string }, playerName: string | null): string | null {
  if (!playerName) return null;
  const roster = rosters.find((r) => sameGame(r, game));
  return roster?.players[normalizePlayerName(playerName)] ?? null;
}

type Stance =
  | { kind: "teamWin"; team: string }
  | { kind: "gameTotal"; over: boolean }
  | { kind: "teamTotal"; team: string; over: boolean }
  | { kind: "player"; player: string; team: string | null; up: boolean; stat: "passing" | "receiving" | "rushing" | "td" | "other" };

function statGroup(propType: string | null): "passing" | "receiving" | "rushing" | "td" | "other" {
  const p = (propType ?? "").toLowerCase();
  if (p.includes("pass") || p.includes("completion")) return "passing";
  if (p.includes("recei") || p.includes("reception")) return "receiving";
  if (p.includes("rush")) return "rushing";
  if (p.includes("td") || p.includes("touchdown")) return "td";
  return "other";
}

function stance(leg: CorrelationLeg): Stance {
  // Side.HOME and TeamSide.HOME are both the string "HOME".
  const teamOf = (s: Side | TeamSide | null) => (s === "HOME" ? leg.homeTeam : leg.awayTeam);
  switch (leg.market) {
    case Market.MONEYLINE:
    case Market.SPREAD:
      return { kind: "teamWin", team: teamOf(leg.side) };
    case Market.TOTAL:
      return { kind: "gameTotal", over: leg.side === Side.OVER };
    case Market.TEAM_TOTAL:
      return { kind: "teamTotal", team: teamOf(leg.teamSide), over: leg.side === Side.OVER };
    default:
      return {
        kind: "player",
        player: normalizePlayerName(leg.playerName ?? ""),
        team: leg.playerTeam,
        up: leg.side === Side.OVER || leg.side === Side.YES,
        stat: statGroup(leg.propType),
      };
  }
}

const sameTeam = (x: string | null, y: string | null) => x !== null && y !== null && teamNamesMatch(x, y);
const possessive = (team: string) => (team.endsWith("s") ? `${team}'` : `${team}'s`);

// Returns the direction plus a short "why" for one pair of same-game stances.
function classify(x: Stance, y: Stance): { direction: CorrelationDirection; why: string } {
  // Order pairs so each combination is handled once.
  const order = ["teamWin", "teamTotal", "gameTotal", "player"];
  if (order.indexOf(x.kind) > order.indexOf(y.kind)) [x, y] = [y, x];
  const pick = (together: boolean, why: string) => ({ direction: (together ? "together" : "against") as CorrelationDirection, why });
  const weak = { direction: "sameGame" as CorrelationDirection, why: "same game" };

  if (x.kind === "teamWin" && y.kind === "teamWin")
    return sameTeam(x.team, y.team) ? pick(true, `both need ${x.team} to come through`) : pick(false, "they need opposite teams to come through");
  if (x.kind === "teamWin" && y.kind === "teamTotal") {
    const same = sameTeam(x.team, y.team);
    return pick(same === y.over, same ? `${x.team} scoring ${y.over ? "more" : "less"} ${y.over ? "helps" : "hurts"} them win` : `${y.team} scoring ${y.over ? "more" : "less"} ${y.over ? "hurts" : "helps"} ${x.team}`);
  }
  if (x.kind === "teamWin" && y.kind === "player") {
    if (!y.team) return weak;
    const same = sameTeam(x.team, y.team);
    return pick(same === y.up, same ? `a big game from one of ${possessive(x.team)} players usually means ${x.team} is winning` : `a big game from the other team's player usually means ${x.team} is struggling`);
  }
  if (x.kind === "teamTotal" && y.kind === "teamTotal")
    return sameTeam(x.team, y.team) ? pick(x.over === y.over, "same team total") : weak;
  if (x.kind === "teamTotal" && y.kind === "gameTotal")
    return pick(x.over === y.over, `${possessive(x.team)} points count toward the game total`);
  if (x.kind === "teamTotal" && y.kind === "player") {
    if (!sameTeam(x.team, y.team)) return weak;
    return pick(x.over === y.up, `${x.team} scoring and their own player producing go hand in hand`);
  }
  if (x.kind === "gameTotal" && y.kind === "gameTotal") return pick(x.over === y.over, "both on the game total");
  if (x.kind === "gameTotal" && y.kind === "player")
    return pick(x.over === y.up, `a high-scoring game means more ${y.stat === "other" ? "stats" : y.stat === "td" ? "touchdowns" : `${y.stat} yards`}`);
  if (x.kind === "player" && y.kind === "player") {
    if (x.player && x.player === y.player) return pick(x.up === y.up, "same player");
    if (sameTeam(x.team, y.team)) {
      const qbAndCatcher = (a: Stance & { kind: "player" }, b: Stance & { kind: "player" }) =>
        a.stat === "passing" && (b.stat === "receiving" || b.stat === "td");
      if (qbAndCatcher(x, y) || qbAndCatcher(y, x)) return pick(x.up === y.up, "a quarterback's yards come from his own receivers");
    }
    return weak;
  }
  // teamWin + gameTotal and anything else: real but weak.
  return weak;
}

// Every same-game pair among `legs`. Cross-game pairs are independent and never flagged.
export function findCorrelations(legs: CorrelationLeg[]): Correlation[] {
  const out: Correlation[] = [];
  for (let i = 0; i < legs.length; i++) {
    for (let j = i + 1; j < legs.length; j++) {
      const a = legs[i];
      const b = legs[j];
      if (!sameGame(a, b)) continue;
      const { direction, why } = classify(stance(a), stance(b));
      out.push({ a, b, direction, reason: why });
    }
  }
  return out;
}

// Correlations between one candidate pick and everyone else's legs.
export function correlationsWith(candidate: CorrelationLeg, others: CorrelationLeg[]): Correlation[] {
  return others.flatMap((other) => findCorrelations([candidate, other]));
}

export const DIRECTION_LABEL: Record<CorrelationDirection, string> = {
  together: "tend to hit together",
  against: "work against each other",
  sameGame: "same game",
};
