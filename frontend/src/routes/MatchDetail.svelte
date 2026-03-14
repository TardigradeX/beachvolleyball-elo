<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { currentUser } from "../stores/auth";
  import { showSnackbar } from "../stores/snackbar";
  import { onMatchSnapshot, reportResult, verifyResult, disputeResult } from "../lib/firestore/matches";
  import PlayerChip from "../lib/components/PlayerChip.svelte";
  import EloChange from "../lib/components/EloChange.svelte";
  import LoadingSpinner from "../lib/components/LoadingSpinner.svelte";
  import type { Match } from "../lib/firestore/types";

  interface Props {
    matchId: string | undefined;
  }
  let { matchId }: Props = $props();

  let match         = $state<Match | null>(null);
  let loading       = $state(true);
  let actionLoading = $state(false);

  const uid = $derived($currentUser?.uid ?? "");

  let unsubMatch: (() => void) | undefined;

  onMount(() => {
    if (!matchId) { loading = false; return; }

    // Use onSnapshot for real-time updates — the creator sees live status
    // changes when the opponent verifies without needing to refresh.
    unsubMatch = onMatchSnapshot(matchId, (m) => {
      match   = m;
      loading = false;
    });
  });

  onDestroy(() => unsubMatch?.());

  // Role detection
  const isCreator = $derived(match?.creatorId === uid);
  const isTeam2   = $derived(
    match?.team2Player1Id === uid || match?.team2Player2Id === uid
  );

  const canReport = $derived(isCreator && match?.status === "pending_result");
  const canVerify = $derived(isTeam2   && match?.status === "pending_verification");

  async function handleReport(winner: "team1" | "team2") {
    if (!matchId) return;
    actionLoading = true;
    try {
      await reportResult(matchId, winner);
      showSnackbar("Result reported — waiting for opponent to verify", "success");
    } catch (err: unknown) {
      showSnackbar(err instanceof Error ? err.message : "Failed to report result", "error");
    } finally {
      actionLoading = false;
    }
  }

  async function handleVerify() {
    if (!match) return;
    actionLoading = true;
    try {
      const results = await verifyResult(match, uid);
      const myResult = results.find((r) => r.uid === uid);
      const deltaStr = myResult
        ? ` Your ELO changed by ${myResult.delta > 0 ? "+" : ""}${myResult.delta}.`
        : "";
      showSnackbar(`Match verified — ELO updated!${deltaStr}`, "success");
    } catch (err: unknown) {
      showSnackbar(err instanceof Error ? err.message : "Failed to verify result", "error");
    } finally {
      actionLoading = false;
    }
  }

  async function handleDispute() {
    if (!matchId) return;
    actionLoading = true;
    try {
      await disputeResult(matchId);
      showSnackbar("Result disputed", "info");
    } catch (err: unknown) {
      showSnackbar(err instanceof Error ? err.message : "Failed to dispute result", "error");
    } finally {
      actionLoading = false;
    }
  }

  function formatDate(ts: { toDate?: () => Date } | null | undefined): string {
    if (!ts) return "—";
    const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts as unknown as number);
    return d.toLocaleString();
  }

  function getMyDelta(): number | null {
    if (!match) return null;
    if (match.team1Player1Id === uid) return match.team1Player1EloDelta;
    if (match.team1Player2Id === uid) return match.team1Player2EloDelta;
    if (match.team2Player1Id === uid) return match.team2Player1EloDelta;
    if (match.team2Player2Id === uid) return match.team2Player2EloDelta;
    return null;
  }
</script>

<div class="match-detail">
  <div class="page-header">
    <button class="md-btn-text" onclick={() => window.history.back()} style="color:var(--md-on-surface-variant)">
      <span class="material-icons">arrow_back</span>
      Back
    </button>
    <h1 class="headline-small">Match Detail</h1>
  </div>

  {#if loading}
    <div style="display:flex;justify-content:center;padding:var(--md-spacing-2xl)">
      <LoadingSpinner size="lg" />
    </div>
  {:else if !match}
    <div class="empty-state md-card">
      <span class="material-icons" style="font-size:48px;color:var(--md-outline)">search_off</span>
      <p class="title-medium">Match not found</p>
    </div>
  {:else}
    <!-- Status banner -->
    <div class="status-banner status-{match.status}">
      {#if match.status === "pending_result"}
        <span class="material-icons">hourglass_empty</span>
        <span>Waiting for the creator to report the result</span>
      {:else if match.status === "pending_verification"}
        <span class="material-icons">pending</span>
        <span>Waiting for an opponent to verify the result</span>
      {:else if match.status === "completed"}
        <span class="material-icons">check_circle</span>
        <span>Match completed — ELO updated</span>
        {#if getMyDelta() !== null}
          <EloChange delta={getMyDelta()} />
        {/if}
      {:else if match.status === "disputed"}
        <span class="material-icons">gavel</span>
        <span>Result disputed — contact an admin to resolve</span>
      {/if}
    </div>

    <!-- Teams layout -->
    <div class="teams-card md-card">
      <div class="teams-layout">

        <!-- Team 1 -->
        <div class="team">
          <div class="label-medium team-label">Team 1</div>
          {#if match.status === "completed" && match.reportedWinner === "team1"}
            <div class="winner-badge">
              <span class="material-icons">emoji_events</span> Winners
            </div>
          {/if}
          <div class="team-players">
            {#each [
              { id: match.team1Player1Id, player: match.team1Player1, delta: match.team1Player1EloDelta },
              { id: match.team1Player2Id, player: match.team1Player2, delta: match.team1Player2EloDelta },
            ] as row (row.id)}
              <div class="player-row">
                <PlayerChip
                  displayName={row.player.displayName}
                  photoUrl={row.player.photoUrl}
                  elo={row.player.elo}
                  highlight={row.id === uid}
                />
                {#if match.status === "completed"}
                  <EloChange delta={row.delta} />
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <div class="vs-center">
          <span class="vs-label">VS</span>
          {#if match.status === "completed"}
            <div class="score-display">
              <span class="score" class:winning={match.reportedWinner === "team1"}>
                {match.reportedWinner === "team1" ? "W" : "L"}
              </span>
              <span class="score-sep">–</span>
              <span class="score" class:winning={match.reportedWinner === "team2"}>
                {match.reportedWinner === "team2" ? "W" : "L"}
              </span>
            </div>
          {/if}
        </div>

        <!-- Team 2 -->
        <div class="team">
          <div class="label-medium team-label">Team 2</div>
          {#if match.status === "completed" && match.reportedWinner === "team2"}
            <div class="winner-badge">
              <span class="material-icons">emoji_events</span> Winners
            </div>
          {/if}
          <div class="team-players">
            {#each [
              { id: match.team2Player1Id, player: match.team2Player1, delta: match.team2Player1EloDelta },
              { id: match.team2Player2Id, player: match.team2Player2, delta: match.team2Player2EloDelta },
            ] as row (row.id)}
              <div class="player-row">
                <PlayerChip
                  displayName={row.player.displayName}
                  photoUrl={row.player.photoUrl}
                  elo={row.player.elo}
                  highlight={row.id === uid}
                />
                {#if match.status === "completed"}
                  <EloChange delta={row.delta} />
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- Action: creator reports result -->
    {#if canReport}
      <div class="action-card md-card">
        <div class="title-medium" style="margin-bottom:var(--md-spacing-md)">
          Who won the match?
        </div>
        <div class="action-buttons">
          <button
            class="md-btn-filled result-btn"
            onclick={() => handleReport("team1")}
            disabled={actionLoading}
          >
            {#if actionLoading}<LoadingSpinner size="sm" />{:else}<span class="material-icons">emoji_events</span>{/if}
            Your team won
          </button>
          <button
            class="md-btn-outlined result-btn"
            onclick={() => handleReport("team2")}
            disabled={actionLoading}
            style="border-color:var(--md-error);color:var(--md-error)"
          >
            {#if actionLoading}<LoadingSpinner size="sm" />{:else}<span class="material-icons">sentiment_dissatisfied</span>{/if}
            Your team lost
          </button>
        </div>
      </div>
    {/if}

    <!-- Action: team2 verifies or disputes -->
    {#if canVerify}
      <div class="action-card md-card">
        <div class="title-medium" style="margin-bottom:4px">Verify the result</div>
        <p class="body-medium" style="color:var(--md-on-surface-variant);margin-bottom:var(--md-spacing-md)">
          {match.team1Player1.displayName} reported that
          <strong>{match.reportedWinner === "team1" ? "Team 1" : "Team 2"} won</strong>.
          Do you agree?
        </p>
        <div class="action-buttons">
          <button
            class="md-btn-filled result-btn"
            onclick={handleVerify}
            disabled={actionLoading}
          >
            {#if actionLoading}<LoadingSpinner size="sm" />{:else}<span class="material-icons">check</span>{/if}
            Yes, confirm result
          </button>
          <button
            class="md-btn-outlined result-btn"
            onclick={handleDispute}
            disabled={actionLoading}
            style="border-color:var(--md-error);color:var(--md-error)"
          >
            {#if actionLoading}<LoadingSpinner size="sm" />{:else}<span class="material-icons">flag</span>{/if}
            Dispute result
          </button>
        </div>
      </div>
    {/if}

    <!-- Match metadata -->
    <div class="meta-card md-card">
      {#each [
        { label: "Created",  value: formatDate(match.createdAt) },
        { label: "Reported", value: match.reportedAt ? formatDate(match.reportedAt) : null },
        { label: "Verified", value: match.verifiedAt ? formatDate(match.verifiedAt) : null },
      ] as row}
        {#if row.value}
          <div class="meta-row">
            <span class="label-medium" style="color:var(--md-on-surface-variant)">{row.label}</span>
            <span class="body-medium">{row.value}</span>
          </div>
        {/if}
      {/each}
      <div class="meta-row">
        <span class="label-medium" style="color:var(--md-on-surface-variant)">Match ID</span>
        <span class="body-small" style="font-family:var(--md-font-mono);color:var(--md-on-surface-variant);word-break:break-all">
          {match.matchId}
        </span>
      </div>
    </div>
  {/if}
</div>

<style>
  .match-detail { display: flex; flex-direction: column; gap: var(--md-spacing-lg); }

  .page-header { display: flex; align-items: center; gap: var(--md-spacing-sm); }

  .status-banner {
    display: flex;
    align-items: center;
    gap: var(--md-spacing-sm);
    padding: var(--md-spacing-md) var(--md-spacing-lg);
    border-radius: var(--md-radius-sm);
    font-weight: 500;
    font-size: 0.875rem;
    flex-wrap: wrap;
  }

  .status-pending_result       { background: var(--md-warning-container); color: #5d4037; }
  .status-pending_verification { background: var(--md-secondary-container); color: var(--md-on-secondary-container); }
  .status-completed            { background: var(--md-success-container); color: var(--md-success); }
  .status-disputed             { background: var(--md-error-container); color: var(--md-error); }

  .teams-card { padding: var(--md-spacing-lg); }

  .teams-layout {
    display: flex;
    gap: var(--md-spacing-lg);
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .team { flex: 1; min-width: 180px; }

  .team-label {
    color: var(--md-on-surface-variant);
    text-transform: uppercase;
    letter-spacing: .08em;
    margin-bottom: var(--md-spacing-sm);
  }

  .winner-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #fff9c4;
    color: #f57f17;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: var(--md-radius-full);
    margin-bottom: var(--md-spacing-sm);
  }
  .winner-badge .material-icons { font-size: 14px; }

  .team-players { display: flex; flex-direction: column; gap: var(--md-spacing-sm); }

  .player-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--md-spacing-sm);
  }

  .vs-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--md-spacing-sm);
    padding-top: 32px;
    flex-shrink: 0;
  }

  .vs-label { font-size: 1.25rem; font-weight: 700; color: var(--md-on-surface-variant); }

  .score-display { display: flex; align-items: center; gap: 8px; }
  .score { font-size: 1.5rem; font-weight: 700; color: var(--md-on-surface-variant); }
  .score.winning { color: var(--md-success); }
  .score-sep { color: var(--md-outline); }

  .action-card { padding: var(--md-spacing-lg); }

  .action-buttons { display: flex; gap: var(--md-spacing-md); flex-wrap: wrap; }

  .result-btn {
    flex: 1;
    min-width: 160px;
    justify-content: center;
    padding: 14px 20px;
  }

  .meta-card {
    padding: var(--md-spacing-md) var(--md-spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--md-spacing-sm);
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--md-spacing-md);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--md-spacing-2xl);
    gap: var(--md-spacing-sm);
  }
</style>
