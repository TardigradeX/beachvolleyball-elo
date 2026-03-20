import {
  doc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  updateDoc,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../../firebase";
import { getPlayers } from "./players";
import { calculateMatchElo, type EloInputPlayer } from "../utils/elo";
import type { Match, MatchType, Player, PlayerSnapshot, TeamLabel } from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function toSnapshot(p: Player, matchType: MatchType): PlayerSnapshot {
  return {
    id:          p.uid,
    displayName: p.displayName,
    photoUrl:    p.photoUrl,
    gender:      p.gender,
    elo:         matchType === "mixed" ? p.eloMixed : p.eloGender,
  };
}

function toEloInput(p: Player, matchType: MatchType): EloInputPlayer {
  return {
    uid:         p.uid,
    currentElo:  matchType === "mixed" ? p.eloMixed : p.eloGender,
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
  matchType: MatchType;
}

/**
 * Creates a new match document. The creator is always team1Player1.
 * All 4 players' current ELOs (for the given matchType) are snapshotted.
 * Returns the new match ID.
 */
export async function createMatch(params: CreateMatchParams): Promise<string> {
  const { creatorUid, team1Partner, team2Player1, team2Player2, creatorPlayer, matchType } = params;

  const matchId  = crypto.randomUUID();
  const matchRef = doc(db, "matches", matchId);

  const relevantElo = (p: Player) => matchType === "mixed" ? p.eloMixed : p.eloGender;

  await writeBatch(db)
    .set(matchRef, {
      matchId,
      matchType,
      creatorId:             creatorUid,
      team1Player1Id:        creatorUid,
      team1Player2Id:        team1Partner.uid,
      team2Player1Id:        team2Player1.uid,
      team2Player2Id:        team2Player2.uid,
      playerIds:             [creatorUid, team1Partner.uid, team2Player1.uid, team2Player2.uid],
      status:                "pending_result",
      reportedWinner:        null,
      verifiedBy:            null,
      disputedBy:            null,
      createdAt:             serverTimestamp(),
      reportedAt:            null,
      verifiedAt:            null,
      // ELO snapshots at creation (relevant to match type)
      team1Player1EloBefore: relevantElo(creatorPlayer),
      team1Player2EloBefore: relevantElo(team1Partner),
      team2Player1EloBefore: relevantElo(team2Player1),
      team2Player2EloBefore: relevantElo(team2Player2),
      // Deltas null until verified
      team1Player1EloDelta:  null,
      team1Player2EloDelta:  null,
      team2Player1EloDelta:  null,
      team2Player2EloDelta:  null,
      // Denormalized player snapshots for rendering match cards without extra reads
      team1Player1: toSnapshot(creatorPlayer, matchType),
      team1Player2: toSnapshot(team1Partner,  matchType),
      team2Player1: toSnapshot(team2Player1,  matchType),
      team2Player2: toSnapshot(team2Player2,  matchType),
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
 * Updates eloGender or eloMixed depending on the match type, atomically.
 *
 * The player updates include `_verifyingMatchId` so the Firestore Security
 * Rule can validate this is a legitimate cross-document batch write.
 */
export async function verifyResult(
  match: Match,
  verifierUid: string
): Promise<ReturnType<typeof calculateMatchElo>> {
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
    [toEloInput(pm[match.team1Player1Id], match.matchType), toEloInput(pm[match.team1Player2Id], match.matchType)],
    [toEloInput(pm[match.team2Player1Id], match.matchType), toEloInput(pm[match.team2Player2Id], match.matchType)],
    match.reportedWinner === "team1"
  );

  const rm = Object.fromEntries(results.map((r) => [r.uid, r]));

  const batch = writeBatch(db);

  // 1. Update match
  batch.update(doc(db, "matches", match.matchId), {
    status:               "completed",
    verifiedBy:           verifierUid,
    verifiedAt:           serverTimestamp(),
    team1Player1EloDelta: rm[match.team1Player1Id].delta,
    team1Player2EloDelta: rm[match.team1Player2Id].delta,
    team2Player1EloDelta: rm[match.team2Player1Id].delta,
    team2Player2EloDelta: rm[match.team2Player2Id].delta,
  });

  // 2. Update all 4 players — write to the correct ELO and category stat fields
  const isMixed    = match.matchType === "mixed";
  const eloField   = isMixed ? "eloMixed"    : "eloGender";
  const winsField  = isMixed ? "winsMixed"   : "winsGender";
  const lossField  = isMixed ? "lossesMixed" : "lossesGender";

  for (const r of results) {
    const p   = pm[r.uid];
    const won = r.wins > p.wins;
    batch.update(doc(db, "players", r.uid), {
      [eloField]:        r.newElo,
      [winsField]:       p[winsField]  + (won ? 1 : 0),
      [lossField]:       p[lossField]  + (won ? 0 : 1),
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
export async function disputeResult(matchId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    status: "disputed",
    disputedBy: uid,
  });
}

/**
 * The disputer withdraws their dispute, returning the match to pending_verification.
 */
export async function acceptDispute(matchId: string): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    status: "pending_verification",
    disputedBy: null,
  });
}

/**
 * The match creator deletes a disputed match entirely.
 */
export async function deleteMatch(matchId: string): Promise<void> {
  await deleteDoc(doc(db, "matches", matchId));
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getMatch(matchId: string): Promise<Match | null> {
  const snap = await getDoc(doc(db, "matches", matchId));
  return snap.exists() ? (snap.data() as Match) : null;
}

// ── Real-time listeners ───────────────────────────────────────────────────────

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

export function onMatchSnapshot(
  matchId: string,
  callback: (match: Match | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, "matches", matchId), (snap) => {
    callback(snap.exists() ? (snap.data() as Match) : null);
  });
}
