<script lang="ts">
  import { currentUser, currentPlayer } from "../stores/auth";
  import { showSnackbar } from "../stores/snackbar";
  import { searchPlayers } from "../lib/firestore/players";
  import { createMatch } from "../lib/firestore/matches";
  import { previewEloChange } from "../lib/utils/elo";
  import PlayerChip from "../lib/components/PlayerChip.svelte";
  import LoadingSpinner from "../lib/components/LoadingSpinner.svelte";
  import type { Gender, MatchType, Player } from "../lib/firestore/types";

  // step 0 = pick match type, steps 1–4 = partner / opp1 / opp2 / confirm
  let step          = $state(0);
  let matchType     = $state<MatchType | null>(null);
  let searchQuery   = $state("");
  let searchResults = $state<Player[]>([]);
  let searching     = $state(false);
  let submitting    = $state(false);

  let team1Partner = $state<Player | null>(null);
  let team2Player1 = $state<Player | null>(null);
  let team2Player2 = $state<Player | null>(null);

  // Use the currentPlayer store so we don't need a separate fetch
  const myProfile = $derived($currentPlayer);

  const selectedIds = $derived(
    new Set([
      $currentUser?.uid,
      team1Partner?.uid,
      team2Player1?.uid,
      team2Player2?.uid,
    ].filter(Boolean) as string[])
  );

  /** Returns the relevant ELO for a player given the current match type */
  function relevantElo(p: Player): number {
    return matchType === "mixed" ? p.eloMixed : p.eloGender;
  }

  const eloPreview = $derived((() => {
    if (!myProfile || !team1Partner || !team2Player1 || !team2Player2 || !matchType) return null;
    const myTeamAvg  = (relevantElo(myProfile) + relevantElo(team1Partner)) / 2;
    const oppTeamAvg = (relevantElo(team2Player1) + relevantElo(team2Player2)) / 2;
    return previewEloChange(myTeamAvg, oppTeamAvg);
  })());

  /**
   * Returns the gender filter to apply for the current search step.
   *  - gender match: all slots must match the match gender
   *  - mixed:
   *      step 1 (partner): opposite gender to creator
   *      step 2 (opp1):    any gender
   *      step 3 (opp2):    opposite gender to opp1
   */
  const genderFilter = $derived((): Gender | undefined => {
    if (!matchType || !myProfile?.gender) return undefined;
    if (matchType === "male")   return "male";
    if (matchType === "female") return "female";
    // mixed
    if (step === 1) return myProfile.gender === "male" ? "female" : "male";
    if (step === 3 && team2Player1?.gender) {
      return team2Player1.gender === "male" ? "female" : "male";
    }
    return undefined;
  });

  let searchTimeout: ReturnType<typeof setTimeout>;

  function onSearchInput() {
    clearTimeout(searchTimeout);
    if (searchQuery.trim().length < 2) { searchResults = []; return; }
    searchTimeout = setTimeout(doSearch, 300);
  }

  async function doSearch() {
    searching = true;
    try {
      searchResults = await searchPlayers(searchQuery, [...selectedIds], genderFilter());
    } catch {
      showSnackbar("Search failed", "error");
      searchResults = [];
    } finally {
      searching = false;
    }
  }

  function selectMatchType(type: MatchType) {
    matchType    = type;
    team1Partner = null;
    team2Player1 = null;
    team2Player2 = null;
    step         = 1;
  }

  function selectPlayer(player: Player) {
    if (step === 1) { team1Partner = player; step = 2; }
    else if (step === 2) { team2Player1 = player; step = 3; }
    else if (step === 3) { team2Player2 = player; step = 4; }
    searchQuery   = "";
    searchResults = [];
  }

  function removePlayer(slot: "partner" | "opp1" | "opp2") {
    if (slot === "partner") { team1Partner = null; step = Math.min(step, 1); }
    if (slot === "opp1")    { team2Player1 = null; step = Math.min(step, 2); }
    if (slot === "opp2")    { team2Player2 = null; step = Math.min(step, 3); }
  }

  async function submitMatch() {
    const uid = $currentUser?.uid;
    if (!uid || !myProfile || !team1Partner || !team2Player1 || !team2Player2 || !matchType) return;

    submitting = true;
    try {
      const matchId = await createMatch({
        creatorUid:    uid,
        creatorPlayer: myProfile,
        team1Partner,
        team2Player1,
        team2Player2,
        matchType,
      });
      showSnackbar("Match created!", "success");
      window.location.hash = `/match/${matchId}`;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create match";
      showSnackbar(msg, "error");
    } finally {
      submitting = false;
    }
  }

  const matchTypeLabels: Record<MatchType, string> = {
    male:   "Men's",
    female: "Women's",
    mixed:  "Mixed",
  };

  const matchTypeIcons: Record<MatchType, string> = {
    male:   "male",
    female: "female",
    mixed:  "people",
  };

  const stepLabels = ["Your partner", "Opponent 1", "Opponent 2"];

  const searchHint = $derived((() => {
    if (!matchType) return "";
    if (matchType === "male")   return "Showing male players only";
    if (matchType === "female") return "Showing female players only";
    if (step === 1) return `Showing ${myProfile?.gender === "male" ? "female" : "male"} players (mixed partner)`;
    if (step === 3 && team2Player1?.gender) {
      return `Showing ${team2Player1.gender === "male" ? "female" : "male"} players (mixed partner)`;
    }
    return "All genders";
  })());
</script>

<div class="create-match">
  <div class="page-header">
    <button class="md-btn-text" onclick={() => window.history.back()} style="color:var(--md-on-surface-variant)">
      <span class="material-icons">arrow_back</span>
      Back
    </button>
    <h1 class="headline-small">New Match</h1>
  </div>

  <!-- Step 0: Match type selection -->
  {#if step === 0}
    <div class="md-card" style="padding:var(--md-spacing-lg)">
      <div class="title-small" style="margin-bottom:var(--md-spacing-md)">Select match type</div>
      <div class="match-type-grid">
        {#each (["male", "female", "mixed"] as MatchType[]).filter(t => t === "mixed" || t === myProfile?.gender) as type}
          <button class="match-type-card" onclick={() => selectMatchType(type)} type="button">
            <span class="material-icons type-icon">{matchTypeIcons[type]}</span>
            <span class="title-medium">{matchTypeLabels[type]}</span>
            <span class="body-small type-desc">
              {#if type === "male"}All 4 players male{/if}
              {#if type === "female"}All 4 players female{/if}
              {#if type === "mixed"}One male + one female per team{/if}
            </span>
          </button>
        {/each}
      </div>
    </div>

  {:else}
    <!-- Match type badge -->
    <div class="type-badge label-medium">
      <span class="material-icons" style="font-size:16px">{matchTypeIcons[matchType!]}</span>
      {matchTypeLabels[matchType!]} match
      <button class="md-btn-text" style="padding:0 4px;font-size:0.75rem" onclick={() => { step = 0; matchType = null; }}>
        Change
      </button>
    </div>

    <!-- Team builder preview -->
    <div class="teams-preview md-card">
      <div class="team-section">
        <div class="label-medium team-label">Your Team</div>
        <div class="team-slots">
          <!-- Creator (always me) -->
          <div class="player-slot filled">
            {#if myProfile}
              <PlayerChip
                displayName={myProfile.displayName}
                photoUrl={myProfile.photoUrl}
                elo={relevantElo(myProfile)}
                highlight
              />
            {:else}
              <LoadingSpinner size="sm" />
            {/if}
            <span class="slot-tag label-small">You</span>
          </div>

          <!-- Partner slot -->
          <div class="player-slot" class:filled={!!team1Partner} class:empty={!team1Partner}>
            {#if team1Partner}
              <PlayerChip
                displayName={team1Partner.displayName}
                photoUrl={team1Partner.photoUrl}
                elo={relevantElo(team1Partner)}
              />
              <button class="remove-btn" onclick={() => removePlayer("partner")} aria-label="Remove partner">
                <span class="material-icons">close</span>
              </button>
            {:else}
              <span class="material-icons slot-icon">person_add</span>
              <span class="body-small" style="color:var(--md-on-surface-variant)">Partner</span>
            {/if}
          </div>
        </div>
      </div>

      <div class="vs-divider"><span class="vs-label">VS</span></div>

      <div class="team-section">
        <div class="label-medium team-label">Opponents</div>
        <div class="team-slots">
          {#each [{ player: team2Player1, slot: "opp1" as const, label: "Opponent 1" },
                  { player: team2Player2, slot: "opp2" as const, label: "Opponent 2" }] as { player, slot, label }}
            <div class="player-slot" class:filled={!!player} class:empty={!player}>
              {#if player}
                <PlayerChip
                  displayName={player.displayName}
                  photoUrl={player.photoUrl}
                  elo={relevantElo(player)}
                />
                <button class="remove-btn" onclick={() => removePlayer(slot)} aria-label="Remove">
                  <span class="material-icons">close</span>
                </button>
              {:else}
                <span class="material-icons slot-icon">person_add</span>
                <span class="body-small" style="color:var(--md-on-surface-variant)">{label}</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- ELO preview -->
    {#if eloPreview}
      <div class="elo-preview md-card">
        <div class="label-medium" style="margin-bottom:8px">Predicted ELO change for you</div>
        <div class="preview-values">
          <div class="preview-item">
            <span class="elo-positive">+{eloPreview.ifWin}</span>
            <span class="label-small" style="color:var(--md-on-surface-variant)">if you win</span>
          </div>
          <div style="color:var(--md-outline);font-size:1.5rem">|</div>
          <div class="preview-item">
            <span class="elo-negative">{eloPreview.ifLoss}</span>
            <span class="label-small" style="color:var(--md-on-surface-variant)">if you lose</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- Player search (steps 1–3) -->
    {#if step < 4}
      <div class="search-section md-card">
        <div class="title-small" style="margin-bottom:var(--md-spacing-sm)">
          Select: <span style="color:var(--md-primary)">{stepLabels[step - 1]}</span>
        </div>
        {#if searchHint}
          <div class="search-hint label-small">{searchHint}</div>
        {/if}

        <div class="md-field" style="margin-top:var(--md-spacing-md)">
          <label for="player-search">Search by name</label>
          <input
            id="player-search"
            type="text"
            bind:value={searchQuery}
            oninput={onSearchInput}
            placeholder="Type at least 2 characters…"
            autofocus
          />
        </div>

        {#if searching}
          <div class="search-state">
            <LoadingSpinner size="sm" />
            <span class="body-medium">Searching…</span>
          </div>
        {:else if searchResults.length > 0}
          <div class="search-results">
            {#each searchResults as player (player.uid)}
              <button class="result-item" onclick={() => selectPlayer(player)} type="button">
                <PlayerChip
                  displayName={player.displayName}
                  photoUrl={player.photoUrl}
                  elo={relevantElo(player)}
                />
              </button>
            {/each}
          </div>
        {:else if searchQuery.trim().length >= 2 && !searching}
          <p class="body-medium" style="color:var(--md-on-surface-variant);padding:var(--md-spacing-md) 0">
            No players found for "<em>{searchQuery}</em>"
          </p>
        {/if}
      </div>
    {/if}

    <!-- Confirm step -->
    {#if step === 4}
      <button
        class="md-btn-filled w-full"
        onclick={submitMatch}
        disabled={submitting}
        style="justify-content:center;padding:16px;font-size:1rem"
      >
        {#if submitting}
          <LoadingSpinner size="sm" />
          Creating match…
        {:else}
          <span class="material-icons">sports_volleyball</span>
          Start match
        {/if}
      </button>
    {/if}
  {/if}
</div>

<style>
  .create-match { display: flex; flex-direction: column; gap: var(--md-spacing-lg); }

  .page-header { display: flex; align-items: center; gap: var(--md-spacing-sm); }

  /* Match type selection */
  .match-type-grid {
    display: flex;
    gap: var(--md-spacing-md);
    flex-wrap: wrap;
  }

  .match-type-card {
    flex: 1;
    min-width: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--md-spacing-sm);
    padding: var(--md-spacing-lg) var(--md-spacing-md);
    border: 2px solid var(--md-outline-variant);
    border-radius: var(--md-radius-md);
    background: var(--md-surface);
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    text-align: center;
  }

  .match-type-card:hover {
    border-color: var(--md-primary);
    background: var(--md-primary-container);
  }

  .type-icon   { font-size: 36px; color: var(--md-primary); }
  .type-desc   { color: var(--md-on-surface-variant); }

  /* Type badge shown after selection */
  .type-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--md-primary-container);
    color: var(--md-on-primary-container);
    border-radius: var(--md-radius-full);
    padding: 4px 12px;
    align-self: flex-start;
  }

  .teams-preview {
    padding: var(--md-spacing-lg);
    display: flex;
    gap: var(--md-spacing-lg);
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .team-section { flex: 1; min-width: 200px; }

  .team-label {
    color: var(--md-on-surface-variant);
    text-transform: uppercase;
    letter-spacing: .08em;
    margin-bottom: var(--md-spacing-sm);
  }

  .team-slots { display: flex; flex-direction: column; gap: var(--md-spacing-sm); }

  .player-slot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px;
    border-radius: var(--md-radius-sm);
    border: 2px dashed var(--md-outline-variant);
    min-height: 52px;
    transition: border-color 0.2s, background 0.2s;
  }

  .player-slot.filled {
    border-style: solid;
    border-color: var(--md-outline-variant);
    background: var(--md-surface-variant);
  }

  .player-slot.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--md-spacing-sm);
  }

  .slot-icon  { color: var(--md-outline); font-size: 20px; }

  .slot-tag {
    background: var(--md-primary-container);
    color: var(--md-on-primary-container);
    padding: 2px 8px;
    border-radius: var(--md-radius-full);
    flex-shrink: 0;
  }

  .remove-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--md-on-surface-variant);
    display: flex;
    padding: 2px;
    border-radius: 50%;
    transition: background 0.15s;
  }
  .remove-btn:hover { background: var(--md-outline-variant); }
  .remove-btn .material-icons { font-size: 16px; }

  .vs-divider { display: flex; align-items: center; padding-top: 32px; flex-shrink: 0; }
  .vs-label {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--md-on-surface-variant);
    background: var(--md-surface-variant);
    border-radius: var(--md-radius-full);
    padding: 6px 16px;
  }

  .elo-preview {
    padding: var(--md-spacing-md) var(--md-spacing-lg);
    border-left: 4px solid var(--md-primary);
    background: var(--md-surface-variant);
  }

  .preview-values {
    display: flex;
    align-items: center;
    gap: var(--md-spacing-lg);
  }

  .preview-item { display: flex; align-items: baseline; gap: var(--md-spacing-sm); }
  .preview-item span:first-child { font-size: 1.5rem; font-weight: 700; }

  .search-section { padding: var(--md-spacing-lg); }

  .search-hint {
    color: var(--md-primary);
    background: var(--md-primary-container);
    padding: 4px 10px;
    border-radius: var(--md-radius-full);
    display: inline-block;
  }

  .search-state { display: flex; align-items: center; gap: var(--md-spacing-sm); padding: var(--md-spacing-md) 0; }

  .search-results {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: var(--md-spacing-md);
    max-height: 280px;
    overflow-y: auto;
  }

  .result-item {
    display: flex;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: var(--md-radius-sm);
    transition: background 0.15s;
  }
  .result-item:hover { background: var(--md-surface-variant); }
</style>
