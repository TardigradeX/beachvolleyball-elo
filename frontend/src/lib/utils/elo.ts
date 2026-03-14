// ── Types ────────────────────────────────────────────────────────────────────

export interface EloInputPlayer {
  uid: string;
  currentElo: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
}

export interface EloResult {
  uid: string;
  newElo: number;
  delta: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const K_FACTOR  = 32;
const ELO_FLOOR = 100;

// ── Core calculation ─────────────────────────────────────────────────────────

function teamAvgElo(p1Elo: number, p2Elo: number): number {
  return (p1Elo + p2Elo) / 2;
}

function expectedScore(myTeamElo: number, opponentTeamElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentTeamElo - myTeamElo) / 400));
}

/**
 * Calculate new ELOs for all 4 players in a 2v2 beach volleyball match.
 *
 * Team strength = average of the two players' individual ELOs.
 * Each player gets the same delta as their partner (they share the same
 * expected score since they share the same team average).
 *
 * @param team1 - [creator, partner]
 * @param team2 - [opponent1, opponent2]
 * @param team1Won - true if team1 won, false if team2 won
 * @returns EloResult for all 4 players in the same order
 */
export function calculateMatchElo(
  team1: [EloInputPlayer, EloInputPlayer],
  team2: [EloInputPlayer, EloInputPlayer],
  team1Won: boolean
): [EloResult, EloResult, EloResult, EloResult] {
  const team1AvgElo = teamAvgElo(team1[0].currentElo, team1[1].currentElo);
  const team2AvgElo = teamAvgElo(team2[0].currentElo, team2[1].currentElo);

  const team1Expected = expectedScore(team1AvgElo, team2AvgElo);
  const team2Expected = expectedScore(team2AvgElo, team1AvgElo);

  const team1Actual = team1Won ? 1 : 0;
  const team2Actual = team1Won ? 0 : 1;

  const applyElo = (
    player: EloInputPlayer,
    actual: number,
    expected: number,
    won: boolean
  ): EloResult => {
    const delta  = Math.round(K_FACTOR * (actual - expected));
    const newElo = Math.max(ELO_FLOOR, player.currentElo + delta);
    return {
      uid:         player.uid,
      newElo,
      delta,
      gamesPlayed: player.gamesPlayed + 1,
      wins:        player.wins   + (won ? 1 : 0),
      losses:      player.losses + (won ? 0 : 1),
    };
  };

  return [
    applyElo(team1[0], team1Actual, team1Expected, team1Won),
    applyElo(team1[1], team1Actual, team1Expected, team1Won),
    applyElo(team2[0], team2Actual, team2Expected, !team1Won),
    applyElo(team2[1], team2Actual, team2Expected, !team1Won),
  ];
}

// ── Preview helpers (used in CreateMatch) ────────────────────────────────────

/**
 * Returns predicted ELO delta for one player given their team's average ELO
 * and the opponent team's average ELO.
 */
export function previewEloChange(
  myTeamAvgElo: number,
  opponentTeamAvgElo: number
): { ifWin: number; ifLoss: number } {
  const expected = expectedScore(myTeamAvgElo, opponentTeamAvgElo);
  return {
    ifWin:  Math.round(K_FACTOR * (1 - expected)),
    ifLoss: Math.round(K_FACTOR * (0 - expected)),
  };
}

export function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`;
}
