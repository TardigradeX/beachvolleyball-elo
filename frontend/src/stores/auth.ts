import { writable, derived } from "svelte/store";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import { provisionPlayer, onPlayerSnapshot } from "../lib/firestore/players";
import type { Gender, Player } from "../lib/firestore/types";

/**
 * Set this BEFORE calling createUserWithEmailAndPassword so that the
 * onAuthStateChanged handler can pass the gender to provisionPlayer in
 * one atomic write — avoiding a race condition where two concurrent
 * setDoc calls both see a missing doc and collide.
 */
let _signupGender: Gender | undefined;
export function setSignupGender(g: Gender) { _signupGender = g; }

export const authLoading   = writable(true);
export const currentUser   = writable<User | null>(null);
export const currentPlayer = writable<Player | null>(null);

let unsubPlayer: (() => void) | null = null;

onAuthStateChanged(auth, async (user) => {
  currentUser.set(user);

  // Clean up previous player listener
  unsubPlayer?.();
  unsubPlayer = null;

  if (user) {
    const gender = _signupGender;
    _signupGender = undefined; // consume so it's only used once
    try {
      await provisionPlayer(user, gender);
    } catch (err) {
      console.error("Failed to provision player document:", err);
    }

    // Keep currentPlayer in sync via real-time listener
    unsubPlayer = onPlayerSnapshot(user.uid, (player) => {
      currentPlayer.set(player);
    });
  } else {
    currentPlayer.set(null);
  }

  authLoading.set(false);
});

export const isLoggedIn = derived(currentUser, ($u) => $u !== null);

/**
 * True when the player is authenticated but has not yet set their gender.
 * Triggers the GenderSetup screen.
 */
export const needsGenderSetup = derived(
  [currentUser, currentPlayer],
  ([$user, $player]) => !!$user && $player !== null && $player.gender === null
);
