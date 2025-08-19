<script lang="ts">
  import { run } from 'svelte/legacy';

  import { complianceStore, searchTerm, filteredControls } from '../../stores/compliance';
  
  let searchInput = $state('');
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  
  function debouncedSearch(term: string) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      complianceStore.setSearchTerm(term);
    }, 300);
  }
  
  run(() => {
    debouncedSearch(searchInput);
  });
  
  function clearSearch() {
    searchInput = '';
    complianceStore.setSearchTerm('');
  }
</script>

<div class="relative">
  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
    <svg class="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
    </svg>
  </div>
  
  <input
    bind:value={searchInput}
    type="text"
    placeholder="Search controls and mappings..."
    class="block w-full pl-10 pr-12 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
  />
  
  {#if searchInput}
    <button
      onclick={clearSearch}
      class="absolute inset-y-0 right-0 pr-3 flex items-center"
      aria-label="Clear search"
    >
      <svg class="w-5 h-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>
  {/if}
  
  {#if $searchTerm}
    <div class="absolute top-full mt-1 text-sm text-gray-600 dark:text-gray-300">
      {$filteredControls.length} results found
    </div>
  {/if}
</div>
