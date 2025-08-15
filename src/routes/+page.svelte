<script lang="ts">
  import { onMount } from 'svelte';
  import { complianceStore, loading, controls, selectedControl } from '../stores/compliance';
  import ControlsList from '../components/ControlsList.svelte';
  import ControlDetailsPanel from '../components/ControlDetailsPanel.svelte';
  import ControlSetInfo from '../components/ControlSetInfo.svelte';
  import SettingsPanel from '../components/SettingsPanel.svelte';
  
  // UI state
  let showSettings = $state(false);
  let useDynamicForms = $state(true);

  function handleDynamicFormsToggle(enabled: boolean) {
    useDynamicForms = enabled;
  }
  
  onMount(() => {
    complianceStore.init();
  });
</script>

<div class="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
  <!-- Fixed Header -->
  <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
    <div class="w-full px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Not Lula</h1>
        </div>
        <div class="flex items-center space-x-4">
          <ControlSetInfo />
          <button
            onclick={() => showSettings = true}
            class="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Settings"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            Settings
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- Split Pane Layout with Cards -->
  <div class="flex-1 flex gap-6 p-6 overflow-hidden">
    {#if $loading}
      <div class="flex-1 flex justify-center items-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    {:else}
      <!-- Left Pane: Controls List Card -->
      <div class="w-1/2 flex flex-col">
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm h-full flex flex-col">
          <ControlsList />
        </div>
      </div>
      
      <!-- Right Pane: Control Details Card -->
      <div class="w-1/2 flex flex-col">
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm h-full flex flex-col">
          {#if $selectedControl}
            <ControlDetailsPanel 
              control={$selectedControl} 
              {useDynamicForms}
            />
          {:else}
            <div class="flex-1 flex items-center justify-center p-8">
              <div class="text-center text-gray-500 dark:text-gray-400">
                <svg class="mx-auto h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Control Selected</h3>
                <p class="text-gray-600 dark:text-gray-400">Select a control from the list to view and edit its details</p>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Settings Panel -->
  <SettingsPanel
    isOpen={showSettings}
    {useDynamicForms}
    onClose={() => showSettings = false}
    onDynamicFormsToggle={handleDynamicFormsToggle}
  />
</div>
