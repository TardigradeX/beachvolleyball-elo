import type { Timestamp } from "firebase/firestore";

// ── Shared enums ─────────────────────────────────────────────────────────────

export type Gender    = "male" | "female";
export type MatchType = "male" | "female" | "mixed";

// ── Player ───────────────────────────────────────────────────────────────────

export interface Player {
  uid: string;
  displayName: string;
  displayNameLower: string;
  email: string;
  photoUrl: string | null;
  gender: Gender | null;
  /** ELO used in gender-specific (male-only / female-only) matches */
  eloGender: number;
  /** ELO used in mixed matches */
  eloMixed: number;
  /** Overall stats (gender + mixed combined) */
  gamesPlayed: number;
  wins: number;
  losses: number;
  /** Gender-match stats */
  winsGender: number;
  lossesGender: number;
  /** Mixed-match stats */
  winsMixed: number;
  lossesMixed: number;
  createdAt: Timestamp;
}

/** Lightweight snapshot stored inside a match document at creation time */
export interface PlayerSnapshot {
  id: string;
  displayName: string;
  photoUrl: string | null;
  gender: Gender | null;
  /** ELO at the time the match was created (relevant to the match type) */
  elo: number;
}

// ── Match ────────────────────────────────────────────────────────────────────

export type MatchStatus =
  | "pending_result"
  | "pending_verification"
  | "completed"
  | "disputed";

export type TeamLabel = "team1" | "team2";

export interface Match {
  matchId: string;
  matchType: MatchType;

  // Raw player IDs (for permission checks and batch writes)
  team1Player1Id: string;
  team1Player2Id: string;
  team2Player1Id: string;
  team2Player2Id: string;

  /** All 4 IDs in one array — enables array-contains queries */
  playerIds: string[];

  creatorId: string;
  status: MatchStatus;
  reportedWinner: TeamLabel | null;
  verifiedBy: string | null;
  disputedBy: string | null;

  createdAt: Timestamp;
  reportedAt: Timestamp | null;
  verifiedAt: Timestamp | null;

  // ELO at match creation time (stored for history display)
  team1Player1EloBefore: number;
  team1Player2EloBefore: number;
  team2Player1EloBefore: number;
  team2Player2EloBefore: number;

  // ELO change applied after verification (null until completed)
  team1Player1EloDelta: number | null;
  team1Player2EloDelta: number | null;
  team2Player1EloDelta: number | null;
  team2Player2EloDelta: number | null;

  // Denormalized player info — avoids extra reads when rendering match lists
  team1Player1: PlayerSnapshot;
  team1Player2: PlayerSnapshot;
  team2Player1: PlayerSnapshot;
  team2Player2: PlayerSnapshot;
}
