<script lang="ts">
  import { signOut, updateProfile } from "firebase/auth";
  import { auth } from "../../firebase";
  import { currentUser, refreshCurrentUser } from "../../stores/auth";
  import { showSnackbar } from "../../stores/snackbar";
  import { updateDisplayName } from "../../lib/firestore/players";
  import LoadingSpinner from "./LoadingSpinner.svelte";
  import logoUrl from "../../assets/VC_Weil_Logo_neu.bmp";

  let menuOpen = $state(false);
  let editing  = $state(false);
  let nameDraft = $state("");
  let saving   = $state(false);

  const navLinks = [
    { href: "#/", label: "MyBeach" },
    { href: "#/leaderboard", label: "Rankings" },
  ];

  function navigate(href: string) {
    window.location.hash = href.replace("#", "");
    closeMenu();
  }

  function closeMenu() {
    menuOpen = false;
    editing = false;
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
    } catch {
      showSnackbar("Sign out failed", "error");
    }
  }

  function startEdit() {
    nameDraft = $currentUser?.displayName ?? "";
    editing = true;
  }

  async function handleChangeName() {
    if (saving) return;
    const user = $currentUser;
    if (!user) return;

    const name = nameDraft.trim();
    if (!name) {
      showSnackbar("Name cannot be empty", "error");
      return;
    }
    if (name.length < 2 || name.length > 30) {
      showSnackbar("Name must be 2–30 characters", "error");
      return;
    }
    if (name === user.displayName) {
      editing = false;
      return;
    }

    saving = true;
    try {
      await Promise.all([
        updateDisplayName(user.uid, name),
        auth.currentUser ? updateProfile(auth.currentUser, { displayName: name }) : Promise.resolve(),
      ]);
      refreshCurrentUser();
      showSnackbar("Name updated");
      closeMenu();
    } catch {
      showSnackbar("Could not update name", "error");
    } finally {
      saving = false;
    }
  }

  function onEditKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      editing = false;
    }
  }

  function getInitial(name: string | null | undefined): string {
    return (name?.[0] ?? "?").toUpperCase();
  }
</script>

<header class="navbar">
  <div class="navbar-inner">
    <a class="navbar-brand" href="#/" onclick={(e) => { e.preventDefault(); navigate("#/"); }}>
      <img class="brand-logo" src={logoUrl} alt="VC Weil" />
    </a>

    <nav class="nav-links">
      {#each navLinks as link}
        <a
          class="nav-link"
          href={link.href}
          onclick={(e) => { e.preventDefault(); navigate(link.href); }}
        >
          {link.label}
        </a>
      {/each}
    </nav>

    <div class="navbar-actions">
      <button
        class="avatar-btn"
        onclick={() => (menuOpen = !menuOpen)}
        aria-label="User menu"
      >
        <div class="md-avatar sm">
          {#if $currentUser?.photoURL}
            <img src={$currentUser.photoURL} alt="avatar" />
          {:else}
            {getInitial($currentUser?.displayName ?? $currentUser?.email)}
          {/if}
        </div>
      </button>

      {#if menuOpen}
        <div class="user-menu md-card">
          <div class="user-info">
            <div class="md-avatar">
              {#if $currentUser?.photoURL}
                <img src={$currentUser.photoURL} alt="avatar" />
              {:else}
                {getInitial($currentUser?.displayName ?? $currentUser?.email)}
              {/if}
            </div>
            {#if editing}
              <form
                class="edit-name-form"
                onsubmit={(e) => { e.preventDefault(); handleChangeName(); }}
              >
                <div class="md-field edit-name-field">
                  <input
                    type="text"
                    bind:value={nameDraft}
                    onkeydown={onEditKeydown}
                    placeholder="Display name"
                    autocomplete="name"
                    maxlength="30"
                    aria-label="Display name"
                    disabled={saving}
                  />
                </div>
                <div class="edit-name-actions">
                  <button
                    type="submit"
                    class="icon-btn"
                    disabled={saving}
                    aria-label="Save name"
                    title="Save"
                  >
                    {#if saving}
                      <LoadingSpinner size="sm" />
                    {:else}
                      <span class="material-icons">check</span>
                    {/if}
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    disabled={saving}
                    onclick={() => (editing = false)}
                    aria-label="Cancel"
                    title="Cancel"
                  >
                    <span class="material-icons">close</span>
                  </button>
                </div>
              </form>
            {:else}
              <div>
                <div class="title-small">{$currentUser?.displayName ?? "Player"}</div>
                <div class="body-small" style="color:var(--md-on-surface-variant)">{$currentUser?.email}</div>
              </div>
            {/if}
          </div>
          <div class="md-divider"></div>
          {#if !editing}
            <button class="menu-item" onclick={startEdit}>
              <span class="material-icons">edit</span>
              Change name
            </button>
          {/if}
          <button class="menu-item" onclick={handleSignOut}>
            <span class="material-icons">logout</span>
            Sign out
          </button>
        </div>
        <div class="menu-backdrop" onclick={closeMenu} role="presentation"></div>
      {/if}
    </div>
  </div>
</header>

<style>
  .navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: var(--navbar-height);
    background: var(--md-surface);
    color: var(--md-on-surface);
    z-index: 200;
    box-shadow: var(--md-elevation-2);
  }

  .navbar-inner {
    max-width: 900px;
    margin: 0 auto;
    height: 100%;
    display: flex;
    align-items: center;
    padding: 0 var(--md-spacing-md);
    gap: var(--md-spacing-lg);
  }

  .navbar-brand {
    display: flex;
    align-items: center;
    gap: var(--md-spacing-sm);
    color: inherit;
    text-decoration: none;
    flex-shrink: 0;
  }

  .brand-logo {
    height: calc(var(--navbar-height) - 8px);
    width: auto;
    display: block;
  }

  .nav-links {
    display: flex;
    gap: var(--md-spacing-xs);
    flex: 1;
  }

  .nav-link {
    display: flex;
    align-items: center;
    color: var(--md-on-surface-variant);
    text-decoration: none;
    padding: 8px 12px;
    border-radius: var(--md-radius-full);
    font-size: 0.8125rem;
    font-weight: 500;
    transition: background 0.15s, color 0.15s;
  }
  .nav-link:hover { background: var(--md-surface-variant); color: var(--md-on-surface); }

  .navbar-actions {
    margin-left: auto;
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--md-spacing-md);
  }

  .avatar-btn {
    background: none;
    border: 2px solid var(--md-outline);
    border-radius: 50%;
    cursor: pointer;
    padding: 0;
    display: flex;
  }

  .user-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 240px;
    z-index: 300;
    padding: var(--md-spacing-md);
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: var(--md-spacing-sm);
    padding-bottom: var(--md-spacing-md);
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--md-spacing-sm);
    width: 100%;
    padding: 10px var(--md-spacing-sm);
    border: none;
    background: none;
    font-family: var(--md-font);
    font-size: 0.875rem;
    color: var(--md-on-surface);
    cursor: pointer;
    border-radius: var(--md-radius-xs);
    transition: background 0.15s;
  }
  .menu-item:hover { background: var(--md-surface-variant); }

  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 299;
  }

  .edit-name-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .edit-name-field {
    margin: 0;
  }
  .edit-name-field :global(input) {
    width: 100%;
    box-sizing: border-box;
  }

  .edit-name-actions {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    border-radius: var(--md-radius-full);
    color: var(--md-on-surface);
    cursor: pointer;
    transition: background 0.15s;
  }
  .icon-btn:hover:not(:disabled) { background: var(--md-surface-variant); }
  .icon-btn:disabled { cursor: default; opacity: 0.6; }
  .icon-btn .material-icons { font-size: 20px; }
</style>
