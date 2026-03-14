<script lang="ts">
  import {
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
  } from "firebase/auth";
  import { auth, googleProvider } from "../firebase";
  import { showSnackbar } from "../stores/snackbar";
  import { provisionPlayer } from "../lib/firestore/players";
  import LoadingSpinner from "../lib/components/LoadingSpinner.svelte";

  let email = $state("");
  let password = $state("");
  let displayName = $state("");
  let isSignUp = $state(false);
  let loading = $state(false);

  async function handleGoogleSignIn() {
    loading = true;
    try {
      await signInWithPopup(auth, googleProvider);
      // Auth state change in stores/auth.ts will redirect automatically
    } catch (err: unknown) {
      showSnackbar(getErrorMessage(err), "error");
    } finally {
      loading = false;
    }
  }

  async function handleEmailAuth() {
    if (!email || !password) {
      showSnackbar("Email and password are required", "error");
      return;
    }
    if (isSignUp && !displayName.trim()) {
      showSnackbar("Display name is required", "error");
      return;
    }

    loading = true;
    try {
      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: displayName.trim() });
        // onAuthStateChanged fires before updateProfile() completes, so
        // provisionPlayer() may have stored the email prefix as the name.
        // Call it again now — with displayName set — so it corrects the doc.
        await provisionPlayer(cred.user);
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
        "auth/user-not-found":      "No account found with this email",
        "auth/wrong-password":      "Incorrect password",
        "auth/email-already-in-use": "Email already in use",
        "auth/weak-password":       "Password must be at least 6 characters",
        "auth/invalid-email":       "Invalid email address",
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

    <button
      class="md-btn-outlined google-btn"
      onclick={handleGoogleSignIn}
      disabled={loading}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Continue with Google
    </button>

    <div class="divider">
      <div class="md-divider" style="flex:1"></div>
      <span class="body-small" style="color:var(--md-on-surface-variant);padding:0 12px">or</span>
      <div class="md-divider" style="flex:1"></div>
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
      <button class="md-btn-text" type="button" onclick={() => (isSignUp = !isSignUp)}>
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

  .google-btn {
    width: 100%;
    justify-content: center;
    margin-bottom: var(--md-spacing-md);
    border-color: var(--md-outline);
    color: var(--md-on-surface);
  }

  .divider {
    display: flex;
    align-items: center;
    margin-bottom: var(--md-spacing-md);
  }

  .email-form {
    display: flex;
    flex-direction: column;
    gap: var(--md-spacing-md);
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
