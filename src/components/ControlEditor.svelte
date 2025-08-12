<script lang="ts">
  import type { Control } from '$lib/types.js';
  import { mappings } from '../stores/compliance';
  
  export let control: Control;
  export let onClose: () => void;
  export let onSave: (control: Control) => void;
  
  let editedControl = { ...control };
  let activeTab = 'details';
  
  function handleSave() {
    onSave(editedControl);
  }
  
  function parseCCIsFromNarrative(narrative: string): string[] {
    const cciPattern = /CCI-(\d{6})/g;
    const matches = narrative.match(cciPattern);
    return matches ? [...new Set(matches)] : [];
  }
  
  $: ccisInNarrative = parseCCIsFromNarrative(editedControl['control-implementation-narrative']);
  $: associatedMappings = $mappings.filter(m => m.control_id === control.id);
</script>

<!-- Modal Backdrop -->
<div class="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-75 overflow-y-auto h-full w-full z-50" role="dialog" aria-modal="true" tabindex="-1" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()}>
  <!-- Modal -->
  <div class="relative min-h-screen w-full p-6 bg-white dark:bg-gray-800" role="document" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
    <!-- Header  -->
    <div class="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        Edit Control: {control['control-acronym']}
      </h3>
      <button onclick={onClose} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close modal">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
    
    <!-- Tabs -->
    <div class="mt-4">
      <nav class="flex space-x-8">
        <button
          onclick={() => activeTab = 'details'}
          class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'details' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
        >
          Details
        </button>
        <button
          onclick={() => activeTab = 'narrative'}
          class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'narrative' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
        >
          Implementation
        </button>
        <button
          onclick={() => activeTab = 'mappings'}
          class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'mappings' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
        >
          Mappings ({associatedMappings.length})
        </button>
      </nav>
    </div>
    
    <!-- Tab Content -->
    <div class="mt-6 max-h-screen-3/4 overflow-y-auto">
      {#if activeTab === 'details'}
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label for="control-id" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Control ID</label>
              <input
                id="control-id"
                bind:value={editedControl.id}
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label for="control-acronym" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Control Acronym</label>
              <input
                id="control-acronym"
                bind:value={editedControl['control-acronym']}
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label for="implementation-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Implementation Status</label>
              <select
                id="implementation-status"
                bind:value={editedControl['control-implementation-status']}
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option>Implemented</option>
                <option>Planned</option>
                <option>Not Implemented</option>
              </select>
            </div>
            <div>
              <label for="compliance-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Compliance Status</label>
              <select
                id="compliance-status"
                bind:value={editedControl['compliance-status']}
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option>Compliant</option>
                <option>Non-Compliant</option>
                <option>Not Assessed</option>
              </select>
            </div>
          </div>
          
          <div>
            <label for="security-control-designation" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Security Control Designation</label>
            <select
              id="security-control-designation"
              bind:value={editedControl['security-control-designation']}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option>Common</option>
              <option>Hybrid</option>
              <option>System-Specific</option>
            </select>
          </div>
          
          <div>
            <label for="control-information" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Control Information</label>
            <textarea
              id="control-information"
              bind:value={editedControl['control-information']}
              rows="6"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            ></textarea>
          </div>
        </div>
      {:else if activeTab === 'narrative'}
        <div class="space-y-4">
          <div>
            <label for="implementation-narrative" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Implementation Narrative</label>
            <textarea
              id="implementation-narrative"
              bind:value={editedControl['control-implementation-narrative']}
              rows="8"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            ></textarea>
          </div>
          
          {#if ccisInNarrative.length > 0}
            <div>
              <div class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">CCIs Found in Narrative</div>
              <div class="flex flex-wrap gap-2">
                {#each ccisInNarrative as cci}
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {cci}
                  </span>
                {/each}
              </div>
            </div>
          {/if}
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label for="cci" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CCI</label>
              <input
                id="cci"
                bind:value={editedControl.cci}
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label for="inherited" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Inherited</label>
              <input
                id="inherited"
                bind:value={editedControl.inherited}
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label for="cci-definition" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CCI Definition</label>
            <textarea
              id="cci-definition"
              bind:value={editedControl['cci-definition']}
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            ></textarea>
          </div>
          
          <div>
            <label for="implementation-guidance" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Implementation Guidance</label>
            <textarea
              id="implementation-guidance"
              bind:value={editedControl['implementation-guidance']}
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            ></textarea>
          </div>
          
          <div>
            <label for="assessment-procedures" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assessment Procedures</label>
            <textarea
              id="assessment-procedures"
              bind:value={editedControl['assessment-procedures']}
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            ></textarea>
          </div>
          
          <div>
            <label for="test-results" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Test Results</label>
            <textarea
              id="test-results"
              bind:value={editedControl['test-results']}
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            ></textarea>
          </div>
        </div>
      {:else if activeTab === 'mappings'}
        <div class="space-y-4">
          {#if associatedMappings.length > 0}
            {#each associatedMappings as mapping}
              <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                <div class="flex justify-between items-start mb-2">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">@mapControl {mapping.uuid}</span>
                  <button
                    onclick={() => navigator.clipboard.writeText(`@mapControl ${mapping.uuid}`)}
                    class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    Copy UUID
                  </button>
                </div>
                <p class="text-sm text-gray-700 dark:text-gray-300 mb-2">{mapping.justification}</p>
                <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Status: {mapping.status}</span>
                  <span>By: {mapping.created_by}</span>
                </div>
              </div>
            {/each}
          {:else}
            <div class="text-center py-8">
              <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No mappings</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">This control has no associated mappings yet.</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
    
    <!-- Footer -->
    <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
      <button
        onclick={onClose}
        class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
      >
        Cancel
      </button>
      <button
        onclick={handleSave}
        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
      >
        Save Changes
      </button>
    </div>
  </div>
</div>
