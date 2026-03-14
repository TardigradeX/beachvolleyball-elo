import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../../firebase";
import type { Gender, MatchType, Player } from "./types";

// ── Player provisioning ──────────────────────────────────────────────────────

/**
 * Creates the player document on first login, or corrects the display name if
 * the document was already created with the email prefix before updateProfile()
 * completed (race condition on email sign-up).
 *
 * Pass `gender` only during email sign-up (Google sign-up goes through GenderSetup).
 */
export async function provisionPlayer(
  user: {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  },
  gender?: Gender
): Promise<void> {
  const ref = doc(db, "players", user.uid);
  const snap = await getDoc(ref);

  const displayName =
    user.displayName?.trim() ||
    user.email?.split("@")[0] ||
    `Player_${user.uid.slice(0, 6)}`;

  if (snap.exists()) {
    const data = snap.data();
    const stored = data.displayName as string;
    const emailPrefix = user.email?.split("@")[0] ?? "";
    const nameIsEmailFallback = stored === emailPrefix && user.displayName?.trim();

    const updates: Record<string, unknown> = {};
    if (nameIsEmailFallback) {
      updates.displayName = displayName;
      updates.displayNameLower = displayName.toLowerCase();
    }
    // onAuthStateChanged creates the doc before Login.svelte can pass the gender,
    // so patch it in on the second provisionPlayer call.
    if (gender && data.gender === null) {
      updates.gender = gender;
    }
    if (Object.keys(updates).length > 0) {
      await updateDoc(ref, updates);
    }
    return;
  }

  await setDoc(ref, {
    uid:              user.uid,
    displayName,
    displayNameLower: displayName.toLowerCase(),
    email:            user.email ?? "",
    photoUrl:         user.photoURL ?? null,
    gender:           gender ?? null,
    eloGender:        1000,
    eloMixed:         1000,
    gamesPlayed:      0,
    wins:             0,
    losses:           0,
    winsGender:       0,
    lossesGender:     0,
    winsMixed:        0,
    lossesMixed:      0,
    createdAt:        serverTimestamp(),
  });
}

/** Sets the player's gender (used in GenderSetup after Google sign-in). */
export async function setPlayerGender(uid: string, gender: Gender): Promise<void> {
  await updateDoc(doc(db, "players", uid), { gender });
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getPlayer(uid: string): Promise<Player | null> {
  const snap = await getDoc(doc(db, "players", uid));
  return snap.exists() ? (snap.data() as Player) : null;
}

export async function getPlayers(uids: string[]): Promise<Player[]> {
  const results = await Promise.all(uids.map(getPlayer));
  return results.filter((p): p is Player => p !== null);
}

/**
 * Prefix search on displayNameLower.
 * Pass `genderFilter` to restrict results to a specific gender
 * (required for gender-specific and mixed match slot validation).
 */
export async function searchPlayers(
  nameQuery: string,
  excludeIds: string[] = [],
  genderFilter?: Gender
): Promise<Player[]> {
  const term = nameQuery.trim().toLowerCase();
  if (term.length < 2) return [];

  // Build constraint list — gender equality must come before range filters
  const constraints = [
    ...(genderFilter ? [where("gender", "==", genderFilter)] : []),
    where("displayNameLower", ">=", term),
    where("displayNameLower", "<", term + "\uf8ff"),
    orderBy("displayNameLower", "asc"),
    limit(25),
  ] as Parameters<typeof query>[1][];

  const snap = await getDocs(query(collection(db, "players"), ...constraints));
  return snap.docs
    .map((d) => d.data() as Player)
    .filter((p) => !excludeIds.includes(p.uid));
}

/**
 * Returns the leaderboard for the given category:
 *  - "male"   → male players ordered by eloGender
 *  - "female" → female players ordered by eloGender
 *  - "mixed"  → all players ordered by eloMixed
 */
export async function getLeaderboard(
  category: MatchType,
  maxResults = 100
): Promise<Player[]> {
  const constraints =
    category === "mixed"
      ? [orderBy("eloMixed", "desc"), limit(maxResults)]
      : [
          where("gender", "==", category),
          orderBy("eloGender", "desc"),
          limit(maxResults),
        ];

  const q = query(collection(db, "players"), ...(constraints as Parameters<typeof query>[1][]));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Player);
}

// ── Real-time listeners ───────────────────────────────────────────────────────

/** Subscribe to real-time updates for a single player's profile. */
export function onPlayerSnapshot(
  uid: string,
  callback: (player: Player | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, "players", uid), (snap) => {
    callback(snap.exists() ? (snap.data() as Player) : null);
  });
}

// ── Profile updates ───────────────────────────────────────────────────────────

export async function updateDisplayName(
  uid: string,
  displayName: string
): Promise<void> {
  await updateDoc(doc(db, "players", uid), {
    displayName,
    displayNameLower: displayName.toLowerCase(),
  });
}
