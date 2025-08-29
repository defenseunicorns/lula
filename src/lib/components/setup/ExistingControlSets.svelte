<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  interface ControlSet {
    path: string;
    name: string;
    description: string;
    controlCount: number;
    file: string;
  }
  
  let controlSets: ControlSet[] = [];
  let isLoading = true;
  let errorMessage = '';
  let selectedSet: ControlSet | null = null;
  
  onMount(async () => {
    await scanForControlSets();
  });
  
  async function scanForControlSets() {
    isLoading = true;
    errorMessage = '';
    
    try {
      const response = await fetch('/api/scan-control-sets');
      
      if (!response.ok) {
        throw new Error('Failed to scan for control sets');
      }
      
      const data = await response.json();
      controlSets = data.controlSets;
      
      if (controlSets.length === 0) {
        errorMessage = 'No existing control sets found. Try importing from a spreadsheet instead.';
      } else if (controlSets.length === 1) {
        // Auto-select if only one control set found
        selectedSet = controlSets[0];
      }
    } catch (error) {
      errorMessage = 'Error scanning for control sets: ' + (error as Error).message;
    } finally {
      isLoading = false;
    }
  }
  
  function selectControlSet(controlSet: ControlSet) {
    selectedSet = controlSet;
  }
  
  function useSelectedControlSet() {
    if (selectedSet) {
      dispatch('selected', { path: selectedSet.path });
    }
  }
</script>

<div class="space-y-6">
  <div class="text-center">
    <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
      Select an Existing Control Set
    </h2>
    <p class="text-gray-600 dark:text-gray-400">
      Choose from control sets found in your project directory
    </p>
  </div>
  
  {#if isLoading}
    <div class="flex justify-center py-12">
      <div class="text-center">
        <svg class="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-500 dark:text-gray-400">Scanning for control sets...</p>
      </div>
    </div>
  {:else if errorMessage}
    <div class="p-4 text-sm text-yellow-800 rounded-lg bg-yellow-50 dark:bg-gray-800 dark:text-yellow-300">
      <div class="flex items-center">
        <svg class="flex-shrink-0 inline w-4 h-4 mr-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/>
        </svg>
        <span>{errorMessage}</span>
      </div>
    </div>
  {:else if controlSets.length > 0}
    <div class="space-y-3">
      {#each controlSets as controlSet}
        <div 
          on:click={() => selectControlSet(controlSet)}
          on:keydown={(e) => e.key === 'Enter' && selectControlSet(controlSet)}
          role="button"
          tabindex="0"
          class="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border-2 cursor-pointer transition-all duration-200 {selectedSet === controlSet 
            ? 'border-blue-500 !bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 shadow-lg' 
            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'}"
        >
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-3">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {controlSet.name}
                </h3>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {controlSet.controlCount || 0} controls
                </span>
              </div>
              
              {#if controlSet.description}
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {controlSet.description}
                </p>
              {/if}
              
              <div class="flex items-center gap-4 mt-2">
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  <svg class="inline w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm2-1a1 1 0 00-1 1v8a1 1 0 001 1h12a1 1 0 001-1V6a1 1 0 00-1-1H4z" clip-rule="evenodd"/>
                  </svg>
                  {controlSet.path || 'root'}
                </span>
                {#if controlSet.file}
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    <svg class="inline w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
                    </svg>
                    {controlSet.file}
                  </span>
                {/if}
              </div>
            </div>
            
            <div class="flex items-center ml-4">
              {#if selectedSet === controlSet}
                <svg class="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                </svg>
              {:else}
                <svg class="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/>
                </svg>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
    
    {#if selectedSet}
      <div class="mt-6 flex justify-center">
        <button 
          on:click={useSelectedControlSet}
          class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-lg"
        >
          Use Selected Control Set
        </button>
      </div>
    {/if}
  {/if}
  
  <div class="flex justify-center">
    <button 
      on:click={scanForControlSets}
      class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
    >
      Rescan Directory
    </button>
  </div>
</div>