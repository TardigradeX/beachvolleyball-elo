<script lang="ts">
  import { get } from "svelte/store";
  import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
  } from "firebase/auth";
  import { auth } from "../firebase";
  import { showSnackbar } from "../stores/snackbar";
  import { setSignupGender, currentPlayer } from "../stores/auth";
  import { updateDisplayName } from "../lib/firestore/players";
  import LoadingSpinner from "../lib/components/LoadingSpinner.svelte";
  import type { Gender } from "../lib/firestore/types";

  let email       = $state("");
  let password    = $state("");
  let displayName = $state("");
  let gender      = $state<Gender | null>(null);
  let isSignUp    = $state(false);
  let loading     = $state(false);

  async function handleEmailAuth() {
    if (!email || !password) {
      showSnackbar("Email and password are required", "error");
      return;
    }
    if (isSignUp && !displayName.trim()) {
      showSnackbar("Display name is required", "error");
      return;
    }
    if (isSignUp && !gender) {
      showSnackbar("Please select your gender", "error");
      return;
    }

    loading = true;
    try {
      if (isSignUp) {
        // Set gender BEFORE creating the account so onAuthStateChanged picks it up
        // in a single provisionPlayer call — avoids a concurrent-setDoc race.
        setSignupGender(gender!);
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: displayName.trim() });
        // Wait for onAuthStateChanged to finish provisioning the player doc,
        // then fix the display name if it was stored as the email prefix
        // (happens when onAuthStateChanged fires before updateProfile completes).
        await new Promise<void>((resolve) => {
          const unsub = currentPlayer.subscribe((p) => {
            if (p) { unsub(); resolve(); }
          });
        });
        const realName = displayName.trim();
        const emailPrefix = cred.user.email?.split("@")[0] ?? "";
        const stored = get(currentPlayer)?.displayName;
        if (stored === emailPrefix && stored !== realName) {
          await updateDisplayName(cred.user.uid, realName);
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: unknown) {
      showSnackbar(getErrorMessage(err), "error");
    } finally {
      loading = false;
    }
  }

  function getErrorMessage(err: unknown): string {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code: string }).code;
      const messages: Record<string, string> = {
        "auth/user-not-found":       "No account found with this email",
        "auth/wrong-password":       "Incorrect password",
        "auth/email-already-in-use": "Email already in use",
        "auth/weak-password":        "Password must be at least 6 characters",
        "auth/invalid-email":        "Invalid email address",
        "auth/popup-closed-by-user": "Sign-in popup was closed",
      };
      return messages[code] ?? "Authentication failed. Please try again.";
    }
    return "An unexpected error occurred";
  }
</script>

<div class="login-page">
  <div class="login-card md-card">
    <div class="login-header">
      <span class="material-icons brand-icon">sports_volleyball</span>
      <h1 class="headline-small">Beach Volleyball ELO</h1>
      <p class="body-medium" style="color:var(--md-on-surface-variant)">
        Track your 2v2 ranking
      </p>
    </div>

    <form onsubmit={(e) => { e.preventDefault(); handleEmailAuth(); }} class="email-form">
      {#if isSignUp}
        <div class="md-field">
          <label for="display-name">Display name</label>
          <input
            id="display-name"
            type="text"
            bind:value={displayName}
            placeholder="Your in-app name"
            autocomplete="name"
          />
        </div>

        <div class="md-field">
          <label>Gender</label>
          <div class="gender-toggle">
            <button
              type="button"
              class="gender-btn"
              class:active={gender === "male"}
              onclick={() => (gender = "male")}
            >Male</button>
            <button
              type="button"
              class="gender-btn"
              class:active={gender === "female"}
              onclick={() => (gender = "female")}
            >Female</button>
          </div>
        </div>
      {/if}

      <div class="md-field">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="you@example.com"
          autocomplete="email"
        />
      </div>

      <div class="md-field">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          placeholder={isSignUp ? "At least 6 characters" : "Your password"}
          autocomplete={isSignUp ? "new-password" : "current-password"}
        />
      </div>

      <button class="md-btn-filled w-full" type="submit" disabled={loading}>
        {#if loading}
          <LoadingSpinner size="sm" />
        {:else}
          {isSignUp ? "Create account" : "Sign in"}
        {/if}
      </button>
    </form>

    <p class="toggle-mode body-small">
      {isSignUp ? "Already have an account?" : "Don't have an account?"}
      <button class="md-btn-text" type="button" onclick={() => { isSignUp = !isSignUp; gender = null; }}>
        {isSignUp ? "Sign in" : "Create account"}
      </button>
    </p>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--md-spacing-md);
    background: linear-gradient(135deg, #f5f5f5 0%, #ececec 100%);
  }

  .login-card {
    width: 100%;
    max-width: 420px;
    padding: var(--md-spacing-xl);
  }

  .login-header {
    text-align: center;
    margin-bottom: var(--md-spacing-xl);
  }

  .brand-icon {
    font-size: 56px;
    color: var(--md-primary);
    display: block;
    margin-bottom: var(--md-spacing-sm);
  }

  .login-header h1 { margin-bottom: 4px; }

  .email-form {
    display: flex;
    flex-direction: column;
    gap: var(--md-spacing-md);
  }

  .gender-toggle {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .gender-btn {
    flex: 1;
    padding: 8px;
    border: 2px solid var(--md-outline-variant);
    border-radius: var(--md-radius-sm);
    background: var(--md-surface);
    cursor: pointer;
    font-family: var(--md-font);
    font-size: 0.875rem;
    color: var(--md-on-surface);
    transition: border-color 0.15s, background 0.15s;
  }

  .gender-btn:hover { border-color: var(--md-primary); }

  .gender-btn.active {
    border-color: var(--md-primary);
    background: var(--md-primary-container);
    color: var(--md-on-primary-container);
    font-weight: 600;
  }

  .toggle-mode {
    text-align: center;
    margin-top: var(--md-spacing-md);
    color: var(--md-on-surface-variant);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
  }
</style>
