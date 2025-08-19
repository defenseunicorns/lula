<script lang="ts">
  import { complianceStore, controls, families, selectedFamily, searchTerm, selectedControl, controlsWithMappings } from '../stores/compliance';
  import SearchBar from './SearchBar.svelte';
  import type { Control } from '$lib/types';
  import { derived } from 'svelte/store';
  import { tooltip } from '$lib/actions/tooltip';
  
  // Create filtered controls with mappings
  const filteredControlsWithMappings = derived(
    [controlsWithMappings, selectedFamily, searchTerm],
    ([$controlsWithMappings, $selectedFamily, $searchTerm]) => {
      let results = $controlsWithMappings;
      
      if ($selectedFamily) {
        results = results.filter(c => 
          c['control-acronym'].startsWith($selectedFamily)
        );
      }
      
      if ($searchTerm) {
        const term = $searchTerm.toLowerCase();
        results = results.filter(c => 
          JSON.stringify(c).toLowerCase().includes(term)
        );
      }
      
      return results;
    }
  );
  
  function selectControl(control: Control) {
    complianceStore.setSelectedControl(control);
  }
  
  function getStatusBadgeClass(status: string) {
    switch (status) {
      case 'Implemented':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'Planned':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
      case 'Not Implemented':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  }
  
  function getComplianceBadgeClass(status: string) {
    switch (status) {
      case 'Compliant':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300';
      case 'Non-Compliant':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      case 'Not Assessed':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  }
</script>

<div class="h-full flex flex-col">
  <!-- Compact Header with Controls and Search -->
  <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-4">
    <!-- Title and Count -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Controls</h2>
      <span class="text-sm text-gray-600 dark:text-gray-400">
        {$filteredControlsWithMappings.length} of {$controls.length}
      </span>
    </div>
    
    <!-- Search Bar -->
    <SearchBar />
    
    <!-- Family Filter Pills -->
    <div class="space-y-2">
      <div class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
        Filter by Family
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          onclick={() => complianceStore.setSelectedFamily(null)}
          class="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full transition-all duration-200 {$selectedFamily === null ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 ring-2 ring-blue-500 ring-opacity-30' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}"
        >
          All
          <span class="ml-1.5 px-1.5 py-0.5 text-xs bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 rounded-full">
            {$controls.length}
          </span>
        </button>
        
        {#each $families as family}
          {@const familyCount = $controls.filter(c => c['control-acronym'].startsWith(family)).length}
          <button
            onclick={() => complianceStore.setSelectedFamily(family)}
            class="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full transition-all duration-200 {$selectedFamily === family ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 ring-2 ring-blue-500 ring-opacity-30' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}"
          >
            {family}
            <span class="ml-1.5 px-1.5 py-0.5 text-xs bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 rounded-full">
              {familyCount}
            </span>
          </button>
        {/each}
      </div>
    </div>
  </div>
  
  <!-- Controls Table -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Fixed Table Header -->
    <div class="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-600 flex-shrink-0">
      <div class="grid grid-cols-6 gap-4 px-6 py-3">
        <div class="text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Control</div>
        <div class="text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">CCI</div>
        <div class="text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Description</div>
        <div class="text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Implementation</div>
        <div class="text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Compliance</div>
        <div class="text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Mappings</div>
      </div>
    </div>
    
    <!-- Scrollable Table Body -->
    <div class="flex-1 overflow-auto">
      <div class="divide-y divide-gray-200 dark:divide-gray-700">
        {#each $filteredControlsWithMappings as control}
          {@const rawText = control['control-information']}
          {@const descriptionStart = rawText.indexOf('Description:') + 'Description:'.length}
          {@const descriptionEnd = rawText.indexOf('Supplemental Guidance:')}
          {@const description = descriptionEnd > descriptionStart ? rawText.substring(descriptionStart, descriptionEnd).trim() : rawText.split('\n').slice(0, 3).join(' ').trim()}
          {@const cleanDescription = description.replace(/^(a\.|b\.|1\.|2\.|\s|The organization:)+/, '').replace(/\s+/g, ' ').trim()}
          <div 
            class="grid grid-cols-6 gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-all duration-150 {$selectedControl?.id === control.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 shadow-sm' : ''}" 
            onclick={() => selectControl(control)}
            onkeydown={(e) => e.key === 'Enter' || e.key === ' ' ? selectControl(control) : null}
            role="button"
            tabindex="0"
            aria-label="Select control {control.id}"
          >
            <!-- Control Column -->
            <div class="flex flex-col justify-center">
              <div class="text-sm font-semibold text-gray-900 dark:text-white">
                {control.id}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {control['control-acronym']}
              </div>
            </div>
            <!-- CCI Column -->
            <div class="flex flex-col justify-center">
              <div class="relative group text-sm text-gray-500 dark:text-gray-400 font-mono cursor-help" use:tooltip>
                {control.cci}
                <div class="tooltip invisible group-hover:visible absolute z-50 w-72 p-3 text-sm text-white bg-gray-900 dark:bg-gray-900 rounded-lg shadow-lg border border-gray-600">
                  <div class="font-medium text-blue-200 mb-1">CCI Definition:</div>
                  <div class="text-gray-200">{control['cci-definition']}</div>
                </div>
              </div>
            </div>
            <!-- Description Column -->
            <div class="flex flex-col justify-center">
              <div class="text-sm text-gray-900 dark:text-white line-clamp-2">
                {cleanDescription.substring(0, 120)}{cleanDescription.length > 120 ? '...' : ''}
              </div>
            </div>
            <!-- Implementation Column -->
            <div class="flex items-center justify-center">
              <span class="inline-flex px-2.5 py-1 text-xs font-medium rounded-full {getStatusBadgeClass(control['control-implementation-status'])}">
                {control['control-implementation-status']}
              </span>
            </div>
            <!-- Compliance Column -->
            <div class="flex items-center justify-center">
              <span class="inline-flex px-2.5 py-1 text-xs font-medium rounded-full {getComplianceBadgeClass(control['compliance-status'])}">
                {control['compliance-status']}
              </span>
            </div>
            <!-- Mappings Column -->
            <div class="flex items-center justify-center">
              <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                {control.mappings.length}
              </span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
  
      {#if $filteredControlsWithMappings.length === 0}
        <div class="flex items-center justify-center py-16">
          <div class="text-center">
            <svg class="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">No controls found</h3>
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              {#if $searchTerm}
                No controls match your search criteria. Try adjusting your search terms or clearing filters.
              {:else}
                No controls available in this family. Select a different family or check your data.
              {/if}
            </p>
          </div>
        </div>
      {/if}
</div>

