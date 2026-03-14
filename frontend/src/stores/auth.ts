import { writable, derived } from "svelte/store";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import { provisionPlayer } from "../lib/firestore/players";

export const authLoading = writable(true);
export const currentUser = writable<User | null>(null);

onAuthStateChanged(auth, async (user) => {
  currentUser.set(user);

  if (user) {
    // Provision the Firestore player document on first login.
    // provisionPlayer() is idempotent — it does nothing if the doc exists.
    try {
      await provisionPlayer(user);
    } catch (err) {
      console.error("Failed to provision player document:", err);
    }
  }

  authLoading.set(false);
});

export const isLoggedIn = derived(currentUser, ($u) => $u !== null);
