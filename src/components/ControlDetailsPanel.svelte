<script lang="ts">
  import type { Control } from '$lib/types.js';
  import { mappings, complianceStore } from '../stores/compliance';
  
  export let control: Control;
  
  let editedControl = { ...control };
  let originalControl = { ...control };
  let activeTab = 'details';
  let showNewMappingForm = false;
  let newMapping = {
    justification: '',
    status: 'Pending',
    created_by: 'Current User'
  };
  
  // Check if there are any changes
  $: hasChanges = JSON.stringify(editedControl) !== JSON.stringify(originalControl);
  
  function handleSave() {
    complianceStore.updateControl(editedControl);
    // Update original control after save
    originalControl = { ...editedControl };
  }
  
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  async function handleCreateMapping() {
    try {
      const mappingData = {
        control_id: control.id,
        justification: newMapping.justification,
        status: newMapping.status,
        created_by: newMapping.created_by
      };
      
      await complianceStore.createMapping(mappingData);
      
      // Reset form
      newMapping = {
        justification: '',
        status: 'Pending',
        created_by: 'Current User'
      };
      showNewMappingForm = false;
    } catch (error) {
      console.error('Failed to create mapping:', error);
    }
  }
  
  function cancelNewMapping() {
    newMapping = {
      justification: '',
      status: 'Pending', 
      created_by: 'Current User'
    };
    showNewMappingForm = false;
  }
  
  function parseCCIsFromNarrative(narrative: string): string[] {
    const cciPattern = /CCI-(\d{6})/g;
    const matches = narrative.match(cciPattern);
    return matches ? [...new Set(matches)] : [];
  }
  
  $: ccisInNarrative = parseCCIsFromNarrative(editedControl['control-implementation-narrative']);
  $: associatedMappings = $mappings.filter(m => m.control_id === control.id);
  
  // Update editedControl when control prop changes
  $: {
    editedControl = { ...control };
    originalControl = { ...control };
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
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  }
  
  function getComplianceBadgeClass(status: string) {
    switch (status) {
      case 'Compliant':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300';
      case 'Non-Compliant':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      case 'Not Assessed':
        return 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  }
</script>

<div class="h-full flex flex-col">
  <!-- Card Header -->
  <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
    <div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
        {control['control-acronym']}
      </h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {control['control-implementation-status']} • {control['compliance-status']}
      </p>
    </div>
    <button
      onclick={handleSave}
      disabled={!hasChanges}
      class="px-4 py-2 text-sm font-medium transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 {hasChanges ? 'text-white bg-blue-600 border-transparent hover:bg-blue-700 focus:ring-blue-500' : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 cursor-not-allowed'}"
    >
      {hasChanges ? 'Save Changes' : 'No Changes'}
    </button>
  </div>

  <!-- Tabs -->
  <div class="border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
    <nav class="flex space-x-8 px-6">
      <button
        onclick={() => activeTab = 'details'}
        class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'details' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
      >
        Details
      </button>
      <button
        onclick={() => activeTab = 'narrative'}
        class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'narrative' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
      >
        Implementation
      </button>
      <button
        onclick={() => activeTab = 'mappings'}
        class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'mappings' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
      >
        Mappings ({associatedMappings.length})
      </button>
    </nav>
  </div>

  <!-- Tab Content -->
  <div class="flex-1 overflow-auto">
    <div class="p-8">
    {#if activeTab === 'details'}
      <div class="space-y-6">
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
        
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <label for="implementation-status" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Implementation Status</label>
            <select
              id="implementation-status"
              bind:value={editedControl['control-implementation-status']}
              class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
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
        </div>
        
        <div>
          <label for="control-information" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Control Information</label>
          <textarea
            id="control-information"
            bind:value={editedControl['control-information']}
            rows="8"
            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
          ></textarea>
        </div>
      </div>
    {:else if activeTab === 'narrative'}
      <div class="space-y-6">
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
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      <div class="space-y-6">
        <!-- Add New Mapping Section -->
        <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
          {#if !showNewMappingForm}
            <button
              onclick={() => showNewMappingForm = true}
              class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add New Mapping
            </button>
          {:else}
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4">
              <h4 class="text-lg font-medium text-gray-900 dark:text-white">Create New Mapping</h4>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="mapping-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    id="mapping-status"
                    bind:value={newMapping.status}
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option>Pending</option>
                    <option>Approved</option>
                    <option>Rejected</option>
                  </select>
                </div>
                <div>
                  <label for="mapping-created-by" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Created By</label>
                  <input
                    id="mapping-created-by"
                    bind:value={newMapping.created_by}
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label for="mapping-justification" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Justification</label>
                <textarea
                  id="mapping-justification"
                  bind:value={newMapping.justification}
                  rows="4"
                  placeholder="Explain why this mapping is necessary..."
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                ></textarea>
              </div>
              
              <div class="flex justify-end space-x-3">
                <button
                  onclick={cancelNewMapping}
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  onclick={handleCreateMapping}
                  disabled={!newMapping.justification.trim()}
                  class="px-4 py-2 text-sm font-medium transition-colors rounded-md {newMapping.justification.trim() ? 'text-white bg-blue-600 hover:bg-blue-700' : 'text-gray-400 bg-gray-200 dark:bg-gray-600 cursor-not-allowed'}"
                >
                  Create Mapping
                </button>
              </div>
            </div>
          {/if}
        </div>
        
        <!-- Existing Mappings -->
        <div>
          {#if associatedMappings.length > 0}
            <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Existing Mappings ({associatedMappings.length})</h4>
            <div class="space-y-4">
              {#each associatedMappings as mapping}
                <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                  <div class="flex justify-between items-start mb-2">
                    <span class="text-sm font-medium text-gray-900 dark:text-white font-mono">@mapControl {mapping.uuid}</span>
                    <button
                      onclick={() => navigator.clipboard.writeText(`@mapControl ${mapping.uuid}`)}
                      class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 px-2 py-1 rounded border border-blue-200 dark:border-blue-600"
                    >
                      Copy UUID
                    </button>
                  </div>
                  <p class="text-sm text-gray-700 dark:text-gray-300 mb-3">{mapping.justification}</p>
                  <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium {mapping.status === 'Approved' ? 'bg-green-100 text-green-800' : mapping.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">Status: {mapping.status}</span>
                    <span>By: {mapping.created_by}</span>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center py-8">
              <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No mappings yet</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Create your first mapping for this control.</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}
    </div>
  </div>
</div>