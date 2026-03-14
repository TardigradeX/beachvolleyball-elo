<script lang="ts">
  import { onMount } from "svelte";
  import { currentUser } from "../stores/auth";
  import { showSnackbar } from "../stores/snackbar";
  import { getLeaderboard } from "../lib/firestore/players";
  import LoadingSpinner from "../lib/components/LoadingSpinner.svelte";
  import type { Player } from "../lib/firestore/types";

  let players = $state<Player[]>([]);
  let loading = $state(true);

  const uid = $derived($currentUser?.uid ?? "");

  onMount(async () => {
    try {
      players = await getLeaderboard();
    } catch {
      showSnackbar("Failed to load leaderboard", "error");
    } finally {
      loading = false;
    }
  });

  function rankIcon(rank: number): string {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  }

  function getInitial(name: string): string {
    return name[0]?.toUpperCase() ?? "?";
  }

  function winRate(p: Player): string {
    if (p.gamesPlayed === 0) return "—";
    return `${Math.round((p.wins / p.gamesPlayed) * 100)}%`;
  }
</script>

<div class="leaderboard">
  <h1 class="headline-small" style="margin-bottom:var(--md-spacing-lg)">
    <span class="material-icons" style="vertical-align:middle;color:var(--md-primary)">leaderboard</span>
    Rankings
  </h1>

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
                <span class="elo-value">{player.elo}</span>
              </td>
              <td class="col-wl">
                <span class="elo-positive">{player.wins}</span>
                <span style="color:var(--md-outline)"> / </span>
                <span class="elo-negative">{player.losses}</span>
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
