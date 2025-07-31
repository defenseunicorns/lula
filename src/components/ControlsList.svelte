<script lang="ts">
  import { complianceStore, controls, families, filteredControls, selectedFamily, searchTerm } from '../stores/compliance';
  import ControlEditor from './ControlEditor.svelte';
  import type { Control } from '$lib/types';
  
  let selectedControl: Control | null = null;
  let showEditor = false;
  
  function openEditor(control: Control) {
    selectedControl = control;
    showEditor = true;
  }
  
  function closeEditor() {
    selectedControl = null;
    showEditor = false;
  }
  
  function getStatusBadgeClass(status: string) {
    switch (status) {
      case 'Implemented':
        return 'bg-green-100 text-green-800';
      case 'Planned':
        return 'bg-yellow-100 text-yellow-800';
      case 'Not Implemented':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
  
  function getComplianceBadgeClass(status: string) {
    switch (status) {
      case 'Compliant':
        return 'bg-green-100 text-green-800';
      case 'Non-Compliant':
        return 'bg-red-100 text-red-800';
      case 'Not Assessed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
  
  $: console.log('Debug - controls:', $controls.length);
  $: console.log('Debug - families:', $families);
  $: console.log('Debug - filteredControls:', $filteredControls.length);
  $: console.log('Debug - selectedFamily:', $selectedFamily);
  $: console.log('Debug - searchTerm:', $searchTerm);
</script>

<div class="bg-white dark:bg-gray-800 shadow-sm rounded-lg">
  <!-- Family Filter Pills -->
  <div class="p-6 border-b border-gray-200 dark:border-gray-700">
    <div class="flex flex-wrap gap-2">
      <button
        onclick={() => complianceStore.setSelectedFamily(null)}
        class="px-3 py-1 text-sm rounded-full transition-colors {$selectedFamily === null ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}"
      >
        All Families ({$controls.length})
      </button>
      
      {#each $families as family}
        {@const familyCount = $controls.filter(c => c['control-acronym'].startsWith(family)).length}
        <button
          onclick={() => complianceStore.setSelectedFamily(family)}
          class="px-3 py-1 text-sm rounded-full transition-colors {$selectedFamily === family ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}"
        >
          {family} ({familyCount})
        </button>
      {/each}
    </div>
  </div>
  
  <!-- Controls Table -->
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead class="bg-gray-50 dark:bg-gray-700">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Control</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Compliance</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">CCI</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        {#each $filteredControls as control}
          <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onclick={() => openEditor(control)}>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
              {control.id}
            </td>
            <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">
              <div class="font-medium">{control['control-acronym']}</div>
              <div class="text-gray-500 dark:text-gray-400 truncate max-w-md">
                {control['control-information'].split('\n')[0]}
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getStatusBadgeClass(control['control-implementation-status'])}">
                {control['control-implementation-status']}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getComplianceBadgeClass(control['compliance-status'])}">
                {control['compliance-status']}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
              {control.cci}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
              <button
                onclick={(e) => { e.stopPropagation(); openEditor(control); }}
                class="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
              >
                Edit
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  
  {#if $filteredControls.length === 0}
    <div class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No controls found</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {#if $searchTerm}
          No controls match your search criteria.
        {:else}
          No controls available in this family.
        {/if}
      </p>
    </div>
  {/if}
</div>

{#if showEditor && selectedControl}
  <ControlEditor
    control={selectedControl}
    onClose={closeEditor}
    onSave={(updatedControl) => {
      complianceStore.updateControl(updatedControl);
      closeEditor();
    }}
  />
{/if}
