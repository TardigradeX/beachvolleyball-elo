<script lang="ts">
  import { currentUser } from "../stores/auth";
  import { setPlayerGender } from "../lib/firestore/players";
  import { showSnackbar } from "../stores/snackbar";
  import LoadingSpinner from "../lib/components/LoadingSpinner.svelte";
  import type { Gender } from "../lib/firestore/types";

  let selected = $state<Gender | null>(null);
  let saving   = $state(false);

  async function save() {
    const uid = $currentUser?.uid;
    if (!uid || !selected) return;
    saving = true;
    try {
      await setPlayerGender(uid, selected);
      // currentPlayer store updates via onPlayerSnapshot → needsGenderSetup clears → App re-renders
    } catch {
      showSnackbar("Failed to save. Please try again.", "error");
    } finally {
      saving = false;
    }
  }
</script>

<div class="gender-setup">
  <div class="setup-card md-card">
    <span class="material-icons brand-icon">sports_volleyball</span>
    <h1 class="headline-small">One more thing</h1>
    <p class="body-medium" style="color:var(--md-on-surface-variant)">
      Select your gender to be ranked in the correct category.
    </p>

    <div class="gender-options">
      <button
        class="gender-option"
        class:selected={selected === "male"}
        onclick={() => (selected = "male")}
        type="button"
      >
        <span class="material-icons gender-icon">male</span>
        <span class="title-medium">Male</span>
      </button>
      <button
        class="gender-option"
        class:selected={selected === "female"}
        onclick={() => (selected = "female")}
        type="button"
      >
        <span class="material-icons gender-icon">female</span>
        <span class="title-medium">Female</span>
      </button>
    </div>

    <button
      class="md-btn-filled w-full"
      onclick={save}
      disabled={!selected || saving}
      style="justify-content:center"
    >
      {#if saving}
        <LoadingSpinner size="sm" />
        Saving…
      {:else}
        Continue
      {/if}
    </button>
  </div>
</div>

<style>
  .gender-setup {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--md-spacing-md);
    background: linear-gradient(135deg, #f5f5f5 0%, #ececec 100%);
  }

  .setup-card {
    width: 100%;
    max-width: 400px;
    padding: var(--md-spacing-xl);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--md-spacing-md);
    text-align: center;
  }

  .brand-icon { font-size: 56px; color: var(--md-primary); }

  .gender-options {
    display: flex;
    gap: var(--md-spacing-md);
    width: 100%;
    margin: var(--md-spacing-sm) 0;
  }

  .gender-option {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--md-spacing-sm);
    padding: var(--md-spacing-lg);
    cursor: pointer;
    border: 2px solid var(--md-outline-variant);
    border-radius: var(--md-radius-md);
    background: var(--md-surface);
    transition: border-color 0.2s, background 0.2s;
  }

  .gender-option:hover { border-color: var(--md-primary); background: var(--md-surface-variant); }

  .gender-option.selected {
    border-color: var(--md-primary);
    background: var(--md-primary-container);
  }

  .gender-icon { font-size: 40px; color: var(--md-primary); }
</style>
