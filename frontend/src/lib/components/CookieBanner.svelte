<script lang="ts">
  let visible = $state(!localStorage.getItem("cookieConsent"));

  function accept() {
    localStorage.setItem("cookieConsent", "accepted");
    visible = false;
  }
</script>

{#if visible}
  <div class="cookie-banner">
    <div class="cookie-inner">
      <p class="body-medium">
        This site uses cookies for authentication and security (reCAPTCHA).
      </p>
      <button class="md-btn-filled cookie-btn" onclick={accept}>Got it</button>
    </div>
  </div>
{/if}

<style>
  .cookie-banner {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 300;
    background: var(--md-surface-variant);
    box-shadow: var(--md-elevation-2);
    border-radius: var(--md-radius-md) var(--md-radius-md) 0 0;
    animation: slide-up 0.3s ease;
  }

  .cookie-inner {
    max-width: 720px;
    margin: 0 auto;
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .cookie-inner p {
    margin: 0;
    color: var(--md-on-surface);
  }

  .cookie-btn {
    flex-shrink: 0;
  }

  @keyframes slide-up {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }

  @media (max-width: 480px) {
    .cookie-inner {
      flex-direction: column;
      text-align: center;
    }
  }
</style>
