<script lang="ts">
  import PlayerChip from "./PlayerChip.svelte";
  import EloChange from "./EloChange.svelte";

  interface Player {
    id: string;
    displayName: string;
    photoUrl?: string | null;
    elo: number;
  }

  interface Match {
    id: string;
    status: string;
    creatorId: string;
    reportedWinner: string | null;
    createdAt: { toDate(): Date } | null;
    team1Player1: Player;
    team1Player2: Player;
    team2Player1: Player;
    team2Player2: Player;
    team1Player1EloDelta?: number | null;
    team1Player2EloDelta?: number | null;
    team2Player1EloDelta?: number | null;
    team2Player2EloDelta?: number | null;
  }

  interface Props {
    match: Match;
    currentUserId: string;
    onclick?: () => void;
  }
  let { match, currentUserId, onclick }: Props = $props();

  const statusConfig: Record<string, { label: string; class: string; icon: string }> = {
    pending_result:       { label: "Awaiting result",   class: "md-badge-warning", icon: "hourglass_empty" },
    pending_verification: { label: "Needs verification", class: "md-badge-info",    icon: "pending" },
    completed:            { label: "Completed",          class: "md-badge-success", icon: "check_circle" },
    disputed:             { label: "Disputed",           class: "md-badge-error",   icon: "gavel" },
  };

  const status = $derived(statusConfig[match.status] ?? statusConfig.pending_result);

  function getDeltaForPlayer(playerId: string): number | null | undefined {
    if (playerId === match.team1Player1.id) return match.team1Player1EloDelta;
    if (playerId === match.team1Player2.id) return match.team1Player2EloDelta;
    if (playerId === match.team2Player1.id) return match.team2Player1EloDelta;
    if (playerId === match.team2Player2.id) return match.team2Player2EloDelta;
    return null;
  }

  const myDelta = $derived(getDeltaForPlayer(currentUserId));
</script>

<button class="match-card md-card" {onclick} type="button">
  <div class="card-header">
    <span class="md-badge {status.class}">
      <span class="material-icons" style="font-size:14px">{status.icon}</span>
      {status.label}
    </span>
    <div class="flex items-center gap-sm">
      {#if match.status === "completed" && myDelta !== null}
        <EloChange delta={myDelta} />
      {/if}
      <span class="date body-small" style="color:var(--md-on-surface-variant)">
        {match.createdAt?.toDate().toLocaleDateString() ?? "—"}
      </span>
    </div>
  </div>

  <div class="teams">
    <div class="team">
      <PlayerChip
        displayName={match.team1Player1.displayName}
        photoUrl={match.team1Player1.photoUrl}
        elo={match.team1Player1.elo}
        size="sm"
        highlight={match.team1Player1.id === currentUserId}
      />
      <PlayerChip
        displayName={match.team1Player2.displayName}
        photoUrl={match.team1Player2.photoUrl}
        elo={match.team1Player2.elo}
        size="sm"
        highlight={match.team1Player2.id === currentUserId}
      />
    </div>

    <div class="vs-badge">VS</div>

    <div class="team">
      <PlayerChip
        displayName={match.team2Player1.displayName}
        photoUrl={match.team2Player1.photoUrl}
        elo={match.team2Player1.elo}
        size="sm"
        highlight={match.team2Player1.id === currentUserId}
      />
      <PlayerChip
        displayName={match.team2Player2.displayName}
        photoUrl={match.team2Player2.photoUrl}
        elo={match.team2Player2.elo}
        size="sm"
        highlight={match.team2Player2.id === currentUserId}
      />
    </div>
  </div>

  {#if match.status === "completed" && match.reportedWinner}
    <div class="result-label body-small" style="color:var(--md-on-surface-variant);margin-top:8px">
      {match.reportedWinner === "team1" ? "Team 1 won" : "Team 2 won"}
    </div>
  {/if}
</button>

<style>
  .match-card {
    width: 100%;
    text-align: left;
    background: var(--md-surface);
    border: none;
    border-radius: var(--md-radius-md);
    padding: var(--md-spacing-md);
    cursor: pointer;
    box-shadow: var(--md-elevation-1);
    transition: box-shadow 0.2s, transform 0.15s;
    font-family: var(--md-font);
  }
  .match-card:hover { box-shadow: var(--md-elevation-2); transform: translateY(-1px); }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--md-spacing-md);
  }

  .teams {
    display: flex;
    align-items: center;
    gap: var(--md-spacing-md);
    flex-wrap: wrap;
  }

  .team {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 140px;
  }

  .vs-badge {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--md-on-surface-variant);
    background: var(--md-surface-variant);
    border-radius: var(--md-radius-full);
    padding: 2px 10px;
    flex-shrink: 0;
  }

  .result-label { text-align: center; }
</style>
