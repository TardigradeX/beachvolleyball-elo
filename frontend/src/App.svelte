<script lang="ts">
  import { authLoading, currentUser, currentPlayer, needsGenderSetup } from "./stores/auth";
  import LoadingSpinner from "./lib/components/LoadingSpinner.svelte";
  import SnackBar from "./lib/components/SnackBar.svelte";
  import Navbar from "./lib/components/Navbar.svelte";
  import Login from "./routes/Login.svelte";
  import GenderSetup from "./routes/GenderSetup.svelte";
  import Dashboard from "./routes/Dashboard.svelte";
  import CreateMatch from "./routes/CreateMatch.svelte";
  import MatchDetail from "./routes/MatchDetail.svelte";
  import Leaderboard from "./routes/Leaderboard.svelte";

  // Simple hash-based router — no external dependency needed
  let hash = $state(window.location.hash || "#/");

  window.addEventListener("hashchange", () => {
    hash = window.location.hash || "#/";
  });

  // Parse route from hash
  const route = $derived((() => {
    const h = hash.replace(/^#\/?/, "");
    if (!h || h === "" || h === "dashboard") return { name: "dashboard" };
    if (h === "create")                      return { name: "create" };
    if (h === "leaderboard")                 return { name: "leaderboard" };
    const matchRoute = h.match(/^match\/(.+)$/);
    if (matchRoute) return { name: "match", id: matchRoute[1] };
    return { name: "dashboard" };
  })());
</script>

<SnackBar />

{#if $authLoading}
  <LoadingSpinner fullscreen />
{:else if !$currentUser}
  <Login />
{:else if $currentPlayer === null}
  <!-- Player doc not yet loaded from Firestore — avoid flashing wrong screen -->
  <LoadingSpinner fullscreen />
{:else if $needsGenderSetup}
  <GenderSetup />
{:else}
  <Navbar />
  <main class="content">
    {#if route.name === "dashboard"}
      <Dashboard />
    {:else if route.name === "create"}
      <CreateMatch />
    {:else if route.name === "match"}
      <MatchDetail matchId={(route as { name: string; id: string }).id} />
    {:else if route.name === "leaderboard"}
      <Leaderboard />
    {/if}
  </main>
{/if}
