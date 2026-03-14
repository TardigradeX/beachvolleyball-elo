<script lang="ts">
  interface Props {
    displayName: string;
    photoUrl?: string | null;
    elo?: number | null;
    size?: "sm" | "md";
    highlight?: boolean;
  }
  let {
    displayName,
    photoUrl = null,
    elo = null,
    size = "md",
    highlight = false,
  }: Props = $props();

  function getInitial(name: string): string {
    return name[0]?.toUpperCase() ?? "?";
  }
</script>

<div class="player-chip" class:sm={size === "sm"} class:highlight>
  <div class="md-avatar" class:sm={size === "sm"}>
    {#if photoUrl}
      <img src={photoUrl} alt={displayName} />
    {:else}
      {getInitial(displayName)}
    {/if}
  </div>
  <div class="info">
    <span class="name">{displayName}</span>
    {#if elo !== null}
      <span class="elo-badge">{elo}</span>
    {/if}
  </div>
</div>

<style>
  .player-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--md-surface-variant);
    border: 1px solid var(--md-outline-variant);
    border-radius: var(--md-radius-full);
    padding: 4px 12px 4px 4px;
  }

  .player-chip.highlight {
    background: var(--md-primary-container);
    border-color: var(--md-primary);
  }

  .player-chip.sm {
    padding: 2px 10px 2px 2px;
    gap: 6px;
  }

  .info {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--md-on-surface);
  }

  .sm .name { font-size: 0.8125rem; }

  .elo-badge {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--md-on-surface-variant);
    background: var(--md-surface);
    padding: 1px 6px;
    border-radius: var(--md-radius-full);
    border: 1px solid var(--md-outline-variant);
  }
</style>
