<script lang="ts">
  import { onMount } from 'svelte';
  import { complianceStore, loading, controls } from '../stores/compliance';
  import ControlsList from '../components/ControlsList.svelte';
  import SearchBar from '../components/SearchBar.svelte';
  import SaveStatus from '../components/SaveStatus.svelte';
  
  onMount(() => {
    complianceStore.init();
  });
  
  $: {
    console.log('Page loading state:', $loading);
    console.log('Page controls count:', $controls.length);
  }
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
  <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Compliance Manager</h1>
        <div class="flex items-center space-x-4">
          <SearchBar />
          <SaveStatus />
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {#if $loading}
      <div class="flex justify-center items-center h-64">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    {:else}
      <ControlsList />
    {/if}
  </main>
</div>
