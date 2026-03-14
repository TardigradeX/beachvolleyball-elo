import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  updateDoc,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../../firebase";
import { getPlayers } from "./players";
import { calculateMatchElo, type EloInputPlayer } from "../utils/elo";
import type { Match, Player, PlayerSnapshot, TeamLabel } from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function toSnapshot(p: Player): PlayerSnapshot {
  return { id: p.uid, displayName: p.displayName, photoUrl: p.photoUrl, elo: p.elo };
}

function toEloInput(p: Player): EloInputPlayer {
  return {
    uid:         p.uid,
    currentElo:  p.elo,
    gamesPlayed: p.gamesPlayed,
    wins:        p.wins,
    losses:      p.losses,
  };
}

// ── Create ───────────────────────────────────────────────────────────────────

export interface CreateMatchParams {
  creatorUid: string;
  team1Partner: Player;
  team2Player1: Player;
  team2Player2: Player;
  creatorPlayer: Player;
}

/**
 * Creates a new match document. The creator is always team1Player1.
 * All 4 players' current ELOs are snapshotted into the document.
 * Returns the new match ID.
 */
export async function createMatch(params: CreateMatchParams): Promise<string> {
  const { creatorUid, team1Partner, team2Player1, team2Player2, creatorPlayer } = params;

  const matchId = crypto.randomUUID();
  const matchRef = doc(db, "matches", matchId);

  await writeBatch(db)
    // We use a batch even for create so it's easy to extend later.
    // setDoc inside a batch is fine.
    .set(matchRef, {
      matchId,
      creatorId:             creatorUid,
      team1Player1Id:        creatorUid,
      team1Player2Id:        team1Partner.uid,
      team2Player1Id:        team2Player1.uid,
      team2Player2Id:        team2Player2.uid,
      playerIds:             [creatorUid, team1Partner.uid, team2Player1.uid, team2Player2.uid],
      status:                "pending_result",
      reportedWinner:        null,
      verifiedBy:            null,
      createdAt:             serverTimestamp(),
      reportedAt:            null,
      verifiedAt:            null,
      // ELO snapshots at creation
      team1Player1EloBefore: creatorPlayer.elo,
      team1Player2EloBefore: team1Partner.elo,
      team2Player1EloBefore: team2Player1.elo,
      team2Player2EloBefore: team2Player2.elo,
      // Deltas null until verified
      team1Player1EloDelta:  null,
      team1Player2EloDelta:  null,
      team2Player1EloDelta:  null,
      team2Player2EloDelta:  null,
      // Denormalized player snapshots for rendering match cards without extra reads
      team1Player1: toSnapshot(creatorPlayer),
      team1Player2: toSnapshot(team1Partner),
      team2Player1: toSnapshot(team2Player1),
      team2Player2: toSnapshot(team2Player2),
    })
    .commit();

  return matchId;
}

// ── State transitions ────────────────────────────────────────────────────────

/**
 * Creator reports the match result.
 * Moves status: pending_result → pending_verification.
 */
export async function reportResult(
  matchId: string,
  reportedWinner: TeamLabel
): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    status:         "pending_verification",
    reportedWinner,
    reportedAt:     serverTimestamp(),
  });
}

/**
 * A team2 player verifies the result.
 * Calculates ELO for all 4 players and commits everything atomically:
 *   - Match: status → completed, deltas written
 *   - All 4 player docs: elo / gamesPlayed / wins / losses updated
 *
 * The player updates include `_verifyingMatchId` so the Firestore Security
 * Rule can validate this is a legitimate cross-document batch write.
 *
 * @returns ELO results for all 4 players (for display in the UI)
 */
export async function verifyResult(
  match: Match,
  verifierUid: string
): Promise<ReturnType<typeof calculateMatchElo>> {
  // Fetch the current (live) ELOs — not the snapshots — so we calculate
  // from up-to-date values.
  const playerIds = [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id,
  ];
  const players = await getPlayers(playerIds);
  if (players.length !== 4) {
    throw new Error("Could not fetch all 4 player documents");
  }

  const pm = Object.fromEntries(players.map((p) => [p.uid, p]));

  const results = calculateMatchElo(
    [toEloInput(pm[match.team1Player1Id]), toEloInput(pm[match.team1Player2Id])],
    [toEloInput(pm[match.team2Player1Id]), toEloInput(pm[match.team2Player2Id])],
    match.reportedWinner === "team1"
  );

  const rm = Object.fromEntries(results.map((r) => [r.uid, r]));

  const batch = writeBatch(db);

  // 1. Update match: set status to completed + write ELO deltas
  batch.update(doc(db, "matches", match.matchId), {
    status:               "completed",
    verifiedBy:           verifierUid,
    verifiedAt:           serverTimestamp(),
    team1Player1EloDelta: rm[match.team1Player1Id].delta,
    team1Player2EloDelta: rm[match.team1Player2Id].delta,
    team2Player1EloDelta: rm[match.team2Player1Id].delta,
    team2Player2EloDelta: rm[match.team2Player2Id].delta,
  });

  // 2. Update all 4 players. `_verifyingMatchId` is read by the Security Rule
  //    to confirm this batch is part of a legitimate pending_verification match.
  for (const r of results) {
    batch.update(doc(db, "players", r.uid), {
      elo:               r.newElo,
      gamesPlayed:       r.gamesPlayed,
      wins:              r.wins,
      losses:            r.losses,
      _verifyingMatchId: match.matchId,
    });
  }

  await batch.commit();
  return results;
}

/**
 * A team2 player disputes the reported result.
 * Moves status: pending_verification → disputed.
 */
export async function disputeResult(matchId: string): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    status: "disputed",
  });
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getMatch(matchId: string): Promise<Match | null> {
  const snap = await getDoc(doc(db, "matches", matchId));
  return snap.exists() ? (snap.data() as Match) : null;
}

// ── Real-time listeners ───────────────────────────────────────────────────────

/**
 * Subscribe to real-time updates for all matches involving the given player.
 * Returns an unsubscribe function. Ordered newest-first.
 */
export function onMyMatchesSnapshot(
  uid: string,
  callback: (matches: Match[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "matches"),
    where("playerIds", "array-contains", uid),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as Match));
  });
}

/**
 * Subscribe to real-time updates for a single match document.
 * Used on the MatchDetail page so the creator sees live updates
 * when an opponent verifies.
 */
export function onMatchSnapshot(
  matchId: string,
  callback: (match: Match | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, "matches", matchId), (snap) => {
    callback(snap.exists() ? (snap.data() as Match) : null);
  });
}
