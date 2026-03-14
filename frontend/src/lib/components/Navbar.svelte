<script lang="ts">
  import { signOut } from "firebase/auth";
  import { auth } from "../../firebase";
  import { currentUser } from "../../stores/auth";
  import { showSnackbar } from "../../stores/snackbar";

  let menuOpen = $state(false);

  const navLinks = [
    { href: "#/", label: "MyBeach", icon: "dashboard" },
    { href: "#/leaderboard", label: "Rankings", icon: "leaderboard" },
  ];

  function navigate(href: string) {
    window.location.hash = href.replace("#", "");
    menuOpen = false;
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
    } catch {
      showSnackbar("Sign out failed", "error");
    }
  }

  function getInitial(name: string | null | undefined): string {
    return (name?.[0] ?? "?").toUpperCase();
  }
</script>

<header class="navbar">
  <div class="navbar-inner">
    <a class="navbar-brand" href="#/" onclick={(e) => { e.preventDefault(); navigate("#/"); }}>
      <span class="material-icons brand-icon">sports_volleyball</span>
      <span class="brand-text">Beach ELO</span>
    </a>

    <nav class="nav-links">
      {#each navLinks as link}
        <a
          class="nav-link"
          href={link.href}
          onclick={(e) => { e.preventDefault(); navigate(link.href); }}
        >
          <span class="material-icons">{link.icon}</span>
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
            <div>
              <div class="title-small">{$currentUser?.displayName ?? "Player"}</div>
              <div class="body-small" style="color:var(--md-on-surface-variant)">{$currentUser?.email}</div>
            </div>
          </div>
          <div class="md-divider"></div>
          <button class="menu-item" onclick={handleSignOut}>
            <span class="material-icons">logout</span>
            Sign out
          </button>
        </div>
        <div class="menu-backdrop" onclick={() => (menuOpen = false)} role="presentation"></div>
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
    background: var(--md-primary);
    color: var(--md-on-primary);
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

  .brand-icon { font-size: 28px; }
  .brand-text { font-size: 1.25rem; font-weight: 700; letter-spacing: .01em; }

  .nav-links {
    display: flex;
    gap: var(--md-spacing-xs);
    flex: 1;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 6px;
    color: rgba(255,255,255,.85);
    text-decoration: none;
    padding: 8px 12px;
    border-radius: var(--md-radius-full);
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.15s, color 0.15s;
  }
  .nav-link:hover { background: rgba(255,255,255,.15); color: #fff; }
  .nav-link .material-icons { font-size: 18px; }

  .navbar-actions { margin-left: auto; position: relative; }

  .avatar-btn {
    background: none;
    border: 2px solid rgba(255,255,255,.6);
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
</style>
