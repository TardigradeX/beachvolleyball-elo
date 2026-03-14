<script lang="ts">
  import { formatDelta } from "../utils/elo";

  interface Props {
    delta: number | null | undefined;
  }
  let { delta }: Props = $props();
</script>

{#if delta !== null && delta !== undefined}
  <span
    class="elo-change"
    class:elo-positive={delta > 0}
    class:elo-negative={delta < 0}
    class:elo-neutral={delta === 0}
  >
    <span class="material-icons arrow">
      {delta > 0 ? "arrow_upward" : delta < 0 ? "arrow_downward" : "remove"}
    </span>
    {formatDelta(delta)}
  </span>
{/if}

<style>
  .elo-change {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 0.875rem;
    font-weight: 600;
  }
  .arrow { font-size: 14px; }
</style>
