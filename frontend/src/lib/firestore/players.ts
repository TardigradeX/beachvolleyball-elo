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
import type { Player } from "./types";

// ── Player provisioning ──────────────────────────────────────────────────────

/**
 * Creates the player document on first login, or corrects the display name if
 * the document was already created with the email prefix before updateProfile()
 * completed (race condition on email sign-up).
 */
export async function provisionPlayer(user: {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}): Promise<void> {
  const ref = doc(db, "players", user.uid);
  const snap = await getDoc(ref);

  const displayName =
    user.displayName?.trim() ||
    user.email?.split("@")[0] ||
    `Player_${user.uid.slice(0, 6)}`;

  // Doc already exists — only fix the name if it was written with the email
  // prefix before updateProfile() had a chance to set the real display name.
  if (snap.exists()) {
    const stored = snap.data().displayName as string;
    const emailPrefix = user.email?.split("@")[0] ?? "";
    const nameIsEmailFallback = stored === emailPrefix && user.displayName?.trim();
    if (nameIsEmailFallback) {
      await updateDoc(ref, {
        displayName,
        displayNameLower: displayName.toLowerCase(),
      });
    }
    return;
  }

  await setDoc(ref, {
    uid:              user.uid,
    displayName,
    displayNameLower: displayName.toLowerCase(),
    email:            user.email ?? "",
    photoUrl:         user.photoURL ?? null,
    elo:              1000,
    gamesPlayed:      0,
    wins:             0,
    losses:           0,
    createdAt:        serverTimestamp(),
  });
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
 * Matches names that START with the query (case-insensitive).
 * Excludes the IDs in `excludeIds` (e.g. already-selected players).
 */
export async function searchPlayers(
  nameQuery: string,
  excludeIds: string[] = []
): Promise<Player[]> {
  const term = nameQuery.trim().toLowerCase();
  if (term.length < 2) return [];

  const q = query(
    collection(db, "players"),
    where("displayNameLower", ">=", term),
    where("displayNameLower", "<", term + "\uf8ff"),
    orderBy("displayNameLower", "asc"),
    limit(25)
  );

  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data() as Player)
    .filter((p) => !excludeIds.includes(p.uid));
}

/** Ordered by ELO descending — used for the leaderboard page. */
export async function getLeaderboard(maxResults = 100): Promise<Player[]> {
  const q = query(
    collection(db, "players"),
    orderBy("elo", "desc"),
    limit(maxResults)
  );
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

// ── Profile update ───────────────────────────────────────────────────────────

export async function updateDisplayName(
  uid: string,
  displayName: string
): Promise<void> {
  await updateDoc(doc(db, "players", uid), {
    displayName,
    displayNameLower: displayName.toLowerCase(),
  });
}
