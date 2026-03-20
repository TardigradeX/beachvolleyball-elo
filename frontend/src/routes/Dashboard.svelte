<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { currentUser } from "../stores/auth";
  import { showSnackbar } from "../stores/snackbar";
  import { onPlayerSnapshot } from "../lib/firestore/players";
  import { onMyMatchesSnapshot, onAllMatchesSnapshot } from "../lib/firestore/matches";
  import MatchCard from "../lib/components/MatchCard.svelte";
  import LoadingSpinner from "../lib/components/LoadingSpinner.svelte";
  import type { Player } from "../lib/firestore/types";
  import type { Match } from "../lib/firestore/types";

  let profile      = $state<Player | null>(null);
  let myMatches    = $state<Match[]>([]);
  let allMatches   = $state<Match[]>([]);
  let loading      = $state(true);

  const uid = $derived($currentUser?.uid ?? "");

  let unsubMyMatches:  (() => void) | undefined;
  let unsubAllMatches: (() => void) | undefined;
  let unsubProfile:    (() => void) | undefined;

  onMount(() => {
    if (!uid) return;

    unsubProfile = onPlayerSnapshot(uid, (p) => {
      profile = p;
      loading = false;
    });

    unsubMyMatches = onMyMatchesSnapshot(uid, (m) => {
      myMatches = m;
    });

    unsubAllMatches = onAllMatchesSnapshot((m) => {
      allMatches = m;
    });
  });

  onDestroy(() => {
    unsubMyMatches?.();
    unsubAllMatches?.();
    unsubProfile?.();
  });

  // Matches where I need to take action (team2, pending verification)
  const pendingVerification = $derived(
    myMatches.filter(
      (m) =>
        m.status === "pending_verification" &&
        (m.team2Player1Id === uid || m.team2Player2Id === uid)
    )
  );

  // Matches where I'm waiting for opponent to verify
  const awaitingOpponent = $derived(
    myMatches.filter(
      (m) => m.status === "pending_verification" && m.creatorId === uid
    )
  );

  // Matches I created that haven't been reported yet
  const pendingResult = $derived(
    myMatches.filter((m) => m.status === "pending_result" && m.creatorId === uid)
  );

  const completedMatches = $derived(
    myMatches.filter((m) => m.status === "completed")
  );

  const disputedMatches = $derived(
    myMatches.filter((m) => m.status === "disputed")
  );

  let activeTab = $state<"my" | "all" | "disputed">("my");

  const PAGE_SIZE = 10;
  let myVisible       = $state(PAGE_SIZE);
  let allVisible      = $state(PAGE_SIZE);
  let disputedVisible = $state(PAGE_SIZE);

  function navigate(path: string) {
    window.location.hash = path;
  }

  function wl(w: number, l: number): string {
    return `${w} W · ${l} L`;
  }
</script>

<div class="dashboard">
  <!-- Profile header card -->
  <div class="profile-card md-card">
    {#if loading}
      <div class="flex items-center gap-md">
        <LoadingSpinner />
        <span class="body-medium">Loading…</span>
      </div>
    {:else if profile}
      <div class="stat-blocks">
        <!-- Gender ELO -->
        <div class="stat-block">
          <div class="stat-block-label">{profile.gender === "female" ? "Women's ELO" : "Men's ELO"}</div>
          <div class="elo-display">{profile.eloGender}</div>
          <div class="wl-line">{wl(profile.winsGender, profile.lossesGender)}</div>
        </div>

        <div class="block-divider"></div>

        <!-- Mixed ELO -->
        <div class="stat-block">
          <div class="stat-block-label">Mixed ELO</div>
          <div class="elo-display">{profile.eloMixed}</div>
          <div class="wl-line">{wl(profile.winsMixed, profile.lossesMixed)}</div>
        </div>

        <div class="block-divider"></div>

        <!-- Overall W/L -->
        <div class="stat-block">
          <div class="stat-block-label">Overall</div>
          <div class="overall-wl">
            <span class="wins">{profile.wins}</span>
            <span class="overall-sep">–</span>
            <span class="losses">{profile.losses}</span>
          </div>
          <div class="wl-line">W – L</div>
        </div>
      </div>
    {:else}
      <div class="elo-display">1000</div>
      <div class="label-medium" style="opacity:.85">Starting ELO</div>
    {/if}

  </div>

  <!-- Tab switcher -->
  <div class="tabs">
    {#each [
      { key: "my",       label: "My Matches",  icon: "person" },
      { key: "all",      label: "All Matches",  icon: "public" },
      { key: "disputed", label: "Disputed",     icon: "gavel" },
    ] as tab (tab.key)}
      <button
        class="tab-btn"
        class:active={activeTab === tab.key}
        onclick={() => activeTab = tab.key}
        type="button"
      >
        <span class="material-icons tab-icon">{tab.icon}</span>
        {tab.label}
        {#if tab.key === "disputed" && disputedMatches.length > 0}
          <span class="tab-badge">{disputedMatches.length}</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if activeTab === "my"}
  <!-- Action needed: needs your verification -->
  {#if pendingVerification.length > 0}
    <section class="section">
      <h2 class="title-medium section-title">
        <span class="material-icons" style="color:var(--md-warning)">notification_important</span>
        Verify a result ({pendingVerification.length})
      </h2>
      <div class="match-list">
        {#each pendingVerification as match (match.matchId)}
          <MatchCard
            {match}
            currentUserId={uid}
            onclick={() => navigate(`/match/${match.matchId}`)}
          />
        {/each}
      </div>
    </section>
  {/if}

  <!-- Pending result — awaiting you to report -->
  {#if pendingResult.length > 0}
    <section class="section">
      <h2 class="title-medium section-title">
        <span class="material-icons" style="color:var(--md-primary)">sports_score</span>
        Report result ({pendingResult.length})
      </h2>
      <div class="match-list">
        {#each pendingResult as match (match.matchId)}
          <MatchCard
            {match}
            currentUserId={uid}
            onclick={() => navigate(`/match/${match.matchId}`)}
          />
        {/each}
      </div>
    </section>
  {/if}

  <!-- Awaiting opponent verification -->
  {#if awaitingOpponent.length > 0}
    <section class="section">
      <h2 class="title-medium section-title">
        <span class="material-icons" style="color:var(--md-secondary)">pending</span>
        Awaiting verification ({awaitingOpponent.length})
      </h2>
      <div class="match-list">
        {#each awaitingOpponent as match (match.matchId)}
          <MatchCard
            {match}
            currentUserId={uid}
            onclick={() => navigate(`/match/${match.matchId}`)}
          />
        {/each}
      </div>
    </section>
  {/if}

  <!-- Completed matches -->
  <section class="section">
    {#if completedMatches.length === 0 && !loading}
      <div class="empty-state md-card">
        <span class="material-icons empty-icon">sports_volleyball</span>
        <p class="title-medium">No matches yet</p>
        <p class="body-medium" style="color:var(--md-on-surface-variant)">
          Create your first match to start tracking your ELO!
        </p>
        <button class="md-btn-filled mt-md" onclick={() => navigate("/create")}>
          <span class="material-icons">add</span>
          Create match
        </button>
      </div>
    {:else}
      <div class="match-list">
        {#each completedMatches.slice(0, myVisible) as match (match.matchId)}
          <MatchCard
            {match}
            currentUserId={uid}
            onclick={() => navigate(`/match/${match.matchId}`)}
          />
        {/each}
      </div>
      {#if completedMatches.length > myVisible}
        <button class="md-btn-outlined load-more-btn" onclick={() => myVisible += PAGE_SIZE}>
          <span class="material-icons">expand_more</span>
          Older matches
        </button>
      {/if}
    {/if}
  </section>
  {:else if activeTab === "all"}
  <!-- All matches tab content -->
  <section class="section">
    {#if allMatches.length === 0 && !loading}
      <div class="empty-state md-card">
        <span class="material-icons empty-icon" style="font-size:48px">sports_volleyball</span>
        <p class="title-medium">No matches yet</p>
        <p class="body-medium" style="color:var(--md-on-surface-variant)">
          No matches have been played yet.
        </p>
      </div>
    {:else}
      <div class="match-list">
        {#each allMatches.slice(0, allVisible) as match (match.matchId)}
          <MatchCard
            {match}
            currentUserId={uid}
            onclick={() => navigate(`/match/${match.matchId}`)}
          />
        {/each}
      </div>
      {#if allMatches.length > allVisible}
        <button class="md-btn-outlined load-more-btn" onclick={() => allVisible += PAGE_SIZE}>
          <span class="material-icons">expand_more</span>
          Older matches
        </button>
      {/if}
    {/if}
  </section>
  {:else}
  <!-- Disputed tab content -->
  <section class="section">
    {#if disputedMatches.length === 0}
      <div class="empty-state md-card">
        <span class="material-icons empty-icon" style="font-size:48px">check_circle</span>
        <p class="title-medium">No disputed matches</p>
        <p class="body-medium" style="color:var(--md-on-surface-variant)">
          All clear — no disputes to resolve.
        </p>
      </div>
    {:else}
      <div class="match-list">
        {#each disputedMatches.slice(0, disputedVisible) as match (match.matchId)}
          <MatchCard
            {match}
            currentUserId={uid}
            onclick={() => navigate(`/match/${match.matchId}`)}
          />
        {/each}
      </div>
      {#if disputedMatches.length > disputedVisible}
        <button class="md-btn-outlined load-more-btn" onclick={() => disputedVisible += PAGE_SIZE}>
          <span class="material-icons">expand_more</span>
          Older matches
        </button>
      {/if}
    {/if}
  </section>
  {/if}
</div>

<button class="md-fab" onclick={() => navigate("/create")} aria-label="Create match">
  <span class="material-icons">add</span>
  New match
</button>

<style>
  .dashboard { display: flex; flex-direction: column; gap: var(--md-spacing-lg); }

  .profile-card {
    padding: var(--md-spacing-lg);
    background: linear-gradient(135deg, rgb(180, 50, 20) 0%, rgb(120, 25, 8) 100%);
    color: var(--md-on-primary);
  }

  .stat-blocks {
    display: flex;
    align-items: stretch;
    gap: var(--md-spacing-lg);
    flex-wrap: wrap;
  }

  .stat-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 100px;
  }

  .stat-block-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .08em;
    opacity: 0.7;
  }

  .elo-display {
    font-size: 2.75rem;
    font-weight: 700;
    line-height: 1;
    font-family: var(--md-font-mono);
  }

  .wl-line {
    font-size: 0.8rem;
    opacity: 0.8;
  }

  .block-divider {
    width: 1px;
    background: rgba(255,255,255,0.25);
    align-self: stretch;
    min-height: 48px;
  }

  .overall-wl {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 2.75rem;
    font-weight: 700;
    line-height: 1;
    font-family: var(--md-font-mono);
  }

  .overall-sep { opacity: 0.5; font-size: 2rem; }
  .wins    { color: #a5d6a7; }
  .losses  { color: #ef9a9a; }

  .section { display: flex; flex-direction: column; gap: var(--md-spacing-md); }

  .section-title {
    display: flex;
    align-items: center;
    gap: var(--md-spacing-sm);
  }

  .match-list { display: flex; flex-direction: column; gap: var(--md-spacing-sm); }

  .load-more-btn {
    align-self: center;
    gap: 4px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--md-spacing-2xl) var(--md-spacing-lg);
    text-align: center;
    gap: var(--md-spacing-sm);
  }

  .empty-icon { font-size: 64px; color: var(--md-outline); margin-bottom: var(--md-spacing-sm); }

  .tabs {
    display: flex;
    gap: 4px;
    background: var(--md-surface-variant);
    border-radius: var(--md-radius-md);
    padding: 4px;
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px var(--md-spacing-md);
    border: none;
    border-radius: var(--md-radius-sm);
    background: transparent;
    color: var(--md-on-surface-variant);
    font-family: var(--md-font);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .tab-btn:hover { background: var(--md-outline-variant); }

  .tab-btn.active {
    background: var(--md-surface);
    color: var(--md-primary);
    box-shadow: 0 1px 3px rgba(0,0,0,.1);
  }

  .tab-icon { font-size: 18px; }

  .tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: var(--md-radius-full);
    background: var(--md-error);
    color: var(--md-on-error, #fff);
    font-size: 0.75rem;
    font-weight: 600;
  }
</style>
