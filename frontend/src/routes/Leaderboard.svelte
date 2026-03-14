<script lang="ts">
  import { currentUser } from "../stores/auth";
  import { showSnackbar } from "../stores/snackbar";
  import { getLeaderboard } from "../lib/firestore/players";
  import LoadingSpinner from "../lib/components/LoadingSpinner.svelte";
  import type { MatchType, Player } from "../lib/firestore/types";

  type Tab = MatchType;

  let activeTab  = $state<Tab>("male");
  let players    = $state<Player[]>([]);
  let loading    = $state(false);

  const uid = $derived($currentUser?.uid ?? "");

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "male",   label: "Men's",   icon: "male"   },
    { key: "female", label: "Women's", icon: "female" },
    { key: "mixed",  label: "Mixed",   icon: "people" },
  ];

  async function loadTab(tab: Tab) {
    activeTab = tab;
    loading   = true;
    players   = [];
    try {
      players = await getLeaderboard(tab);
    } catch {
      showSnackbar("Failed to load leaderboard", "error");
    } finally {
      loading = false;
    }
  }

  // Load on mount
  loadTab("male");

  function rankIcon(rank: number): string {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  }

  function getInitial(name: string): string {
    return name[0]?.toUpperCase() ?? "?";
  }

  function displayElo(p: Player): number {
    return activeTab === "mixed" ? p.eloMixed : p.eloGender;
  }

  function displayWins(p: Player): number {
    return activeTab === "mixed" ? p.winsMixed : p.winsGender;
  }

  function displayLosses(p: Player): number {
    return activeTab === "mixed" ? p.lossesMixed : p.lossesGender;
  }

  function winRate(p: Player): string {
    const w = displayWins(p);
    const l = displayLosses(p);
    const total = w + l;
    if (total === 0) return "—";
    return `${Math.round((w / total) * 100)}%`;
  }
</script>

<div class="leaderboard">
  <h1 class="headline-small" style="margin-bottom:var(--md-spacing-md)">
    <span class="material-icons" style="vertical-align:middle;color:var(--md-primary)">leaderboard</span>
    Rankings
  </h1>

  <!-- Tabs -->
  <div class="tabs">
    {#each tabs as tab}
      <button
        class="tab-btn"
        class:active={activeTab === tab.key}
        onclick={() => loadTab(tab.key)}
        type="button"
      >
        <span class="material-icons tab-icon">{tab.icon}</span>
        {tab.label}
      </button>
    {/each}
  </div>

  {#if loading}
    <div style="display:flex;justify-content:center;padding:var(--md-spacing-2xl)">
      <LoadingSpinner size="lg" />
    </div>
  {:else if players.length === 0}
    <div class="empty-state md-card">
      <span class="material-icons" style="font-size:64px;color:var(--md-outline)">emoji_events</span>
      <p class="title-medium">No rankings yet</p>
      <p class="body-medium" style="color:var(--md-on-surface-variant)">
        Complete some matches to appear on the leaderboard!
      </p>
    </div>
  {:else}
    <div class="table-card md-card">
      <table class="rankings-table">
        <thead>
          <tr>
            <th class="col-rank">Rank</th>
            <th class="col-player">Player</th>
            <th class="col-elo">ELO</th>
            <th class="col-wl">W / L</th>
            <th class="col-rate">Win %</th>
          </tr>
        </thead>
        <tbody>
          {#each players as player, i (player.uid)}
            <tr class="player-row" class:is-me={player.uid === uid}>
              <td class="col-rank">
                <span class="rank-display">{rankIcon(i + 1)}</span>
              </td>
              <td class="col-player">
                <div class="player-cell">
                  <div class="md-avatar sm">
                    {#if player.photoUrl}
                      <img src={player.photoUrl} alt={player.displayName} />
                    {:else}
                      {getInitial(player.displayName)}
                    {/if}
                  </div>
                  <span class="player-name">
                    {player.displayName}
                    {#if player.uid === uid}
                      <span class="you-tag">You</span>
                    {/if}
                  </span>
                </div>
              </td>
              <td class="col-elo">
                <span class="elo-value">{displayElo(player)}</span>
              </td>
              <td class="col-wl">
                <span class="elo-positive">{displayWins(player)}</span>
                <span style="color:var(--md-outline)"> / </span>
                <span class="elo-negative">{displayLosses(player)}</span>
              </td>
              <td class="col-rate">{winRate(player)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="body-small" style="color:var(--md-on-surface-variant);text-align:center">
      Top {players.length} players · Reload to refresh
    </p>
  {/if}
</div>

<style>
  .leaderboard { display: flex; flex-direction: column; gap: var(--md-spacing-md); }

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

  .table-card { overflow-x: auto; }

  .rankings-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--md-font);
  }

  thead th {
    padding: var(--md-spacing-sm) var(--md-spacing-md);
    text-align: left;
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--md-on-surface-variant);
    border-bottom: 1px solid var(--md-outline-variant);
    white-space: nowrap;
  }

  .player-row td {
    padding: var(--md-spacing-sm) var(--md-spacing-md);
    border-bottom: 1px solid var(--md-outline-variant);
    vertical-align: middle;
  }

  .player-row:last-child td { border-bottom: none; }

  .player-row.is-me { background: var(--md-primary-container); }
  .player-row:hover { background: var(--md-surface-variant); }
  .player-row.is-me:hover { background: var(--md-primary-container); filter: brightness(0.97); }

  .col-rank  { width: 56px; text-align: center; }
  .col-elo   { text-align: right; font-family: var(--md-font-mono); }
  .col-wl    { text-align: right; white-space: nowrap; }
  .col-rate  { text-align: right; width: 72px; }

  .rank-display { display: flex; justify-content: center; font-size: 1.25rem; }

  .player-cell { display: flex; align-items: center; gap: var(--md-spacing-sm); }

  .player-name { font-weight: 500; display: flex; align-items: center; gap: 6px; }

  .you-tag {
    background: var(--md-primary);
    color: var(--md-on-primary);
    font-size: 0.625rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: var(--md-radius-full);
    letter-spacing: .04em;
  }

  .elo-value { font-size: 1rem; font-weight: 600; }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--md-spacing-2xl);
    text-align: center;
    gap: var(--md-spacing-sm);
  }
</style>
