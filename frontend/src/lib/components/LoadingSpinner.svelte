<script lang="ts">
  interface Props {
    fullscreen?: boolean;
    size?: "sm" | "md" | "lg";
  }
  let { fullscreen = false, size = "md" }: Props = $props();

  const sizes = { sm: "16px", md: "24px", lg: "48px" };
</script>

{#if fullscreen}
  <div class="fullscreen-wrapper">
    <div class="md-spinner" style="width:{sizes[size]};height:{sizes[size]}"></div>
  </div>
{:else}
  <div class="md-spinner" style="width:{sizes[size]};height:{sizes[size]}"></div>
{/if}

<style>
  .fullscreen-wrapper {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--md-background);
    z-index: 9999;
  }
</style>
