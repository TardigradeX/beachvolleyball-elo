<script lang="ts">
  import { snackbarMessages } from "../../stores/snackbar";

  const icons = {
    success: "check_circle",
    error: "error",
    info: "info",
  };
</script>

<div class="snackbar-container">
  {#each $snackbarMessages as msg (msg.id)}
    <div class="snackbar snackbar-{msg.type}" role="status">
      <span class="material-icons icon">{icons[msg.type]}</span>
      <span>{msg.text}</span>
    </div>
  {/each}
</div>

<style>
  .snackbar-container {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 1000;
    pointer-events: none;
  }

  .snackbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    border-radius: var(--md-radius-sm);
    font-size: 0.875rem;
    font-weight: 500;
    box-shadow: var(--md-elevation-3);
    min-width: 280px;
    max-width: 480px;
    animation: slide-up 0.25s ease;
  }

  .snackbar-success { background: #1b5e20; color: #fff; }
  .snackbar-error   { background: #b71c1c; color: #fff; }
  .snackbar-info    { background: #212121; color: #fff; }

  .icon { font-size: 20px; }

  @keyframes slide-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
