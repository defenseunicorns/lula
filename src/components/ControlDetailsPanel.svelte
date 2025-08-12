<script lang="ts">
  import type { Control, GitFileHistory } from '$lib/types.js';
  import { mappings, complianceStore } from '../stores/compliance';
  import { api } from '$lib/api';
  import DiffViewer from './DiffViewer.svelte';
  
  export let control: Control;
  
  let editedControl = { ...control };
  let originalControl = { ...control };
  let activeTab = 'details';
  let showNewMappingForm = false;
  let gitHistory: GitFileHistory | null = null;
  let mappingHistory: GitFileHistory | null = null;
  let loadingHistory = false;
  let loadingMappingHistory = false;
  let expandedCommits = new Set<string>(); // Track which commits have expanded diffs
  let expandedMappingCommits = new Set<string>(); // Track which mapping commits have expanded diffs
  let newMapping = {
    justification: '',
    status: 'planned' as 'planned' | 'implemented' | 'verified'
  };
  
  // Check if there are any changes
  $: hasChanges = JSON.stringify(editedControl) !== JSON.stringify(originalControl);
  
  function handleSave() {
    complianceStore.updateControl(editedControl);
    // Update original control after save
    originalControl = { ...editedControl };
  }
  
  
  async function handleCreateMapping() {
    try {
      const mappingData = {
        control_id: control.id,
        justification: newMapping.justification,
        status: newMapping.status,
        source_entries: []
      };
      
      await complianceStore.createMapping(mappingData);
      
      // Reset form
      newMapping = {
        justification: '',
        status: 'planned'
      };
      showNewMappingForm = false;
    } catch (error) {
      console.error('Failed to create mapping:', error);
    }
  }
  
  function cancelNewMapping() {
    newMapping = {
      justification: '',
      status: 'planned'
    };
    showNewMappingForm = false;
  }

  async function loadGitHistory() {
    if (gitHistory || loadingHistory) return; // Don't load if already loaded or loading
    
    loadingHistory = true;
    try {
      console.log(`Loading git history for control: ${control.id}`);
      gitHistory = await api.getControlHistory(control.id, 20); // Get last 20 commits
      console.log(`Loaded git history:`, gitHistory);
    } catch (error) {
      console.error('Failed to load git history:', error);
      gitHistory = {
        filePath: '',
        commits: [],
        totalCommits: 0,
        firstCommit: null,
        lastCommit: null
      };
    } finally {
      loadingHistory = false;
    }
  }

  async function loadMappingHistory() {
    if (mappingHistory || loadingMappingHistory) return; // Don't load if already loaded or loading
    
    loadingMappingHistory = true;
    try {
      const family = control['control-acronym'].split('-')[0];
      console.log(`Loading mapping git history for family: ${family}`);
      mappingHistory = await api.getMappingHistory(family, 20); // Get last 20 commits
      console.log(`Loaded mapping git history:`, mappingHistory);
    } catch (error) {
      console.error('Failed to load mapping git history:', error);
      mappingHistory = {
        filePath: '',
        commits: [],
        totalCommits: 0,
        firstCommit: null,
        lastCommit: null
      };
    } finally {
      loadingMappingHistory = false;
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function toggleDiffExpansion(commitHash: string) {
    if (expandedCommits.has(commitHash)) {
      expandedCommits.delete(commitHash);
    } else {
      expandedCommits.add(commitHash);
    }
    expandedCommits = new Set(expandedCommits); // Trigger reactivity
  }

  function toggleMappingDiffExpansion(commitHash: string) {
    if (expandedMappingCommits.has(commitHash)) {
      expandedMappingCommits.delete(commitHash);
    } else {
      expandedMappingCommits.add(commitHash);
    }
    expandedMappingCommits = new Set(expandedMappingCommits); // Trigger reactivity
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
    // Reset git history when control changes
    gitHistory = null;
    mappingHistory = null;
    loadingHistory = false;
    loadingMappingHistory = false;
    expandedCommits = new Set();
    expandedMappingCommits = new Set();
    // Switch back to details tab when control changes for better UX
    activeTab = 'details';
  }

  // Load git history when history tab is selected
  $: if (activeTab === 'history') {
    loadGitHistory();
    loadMappingHistory();
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
      <button
        onclick={() => activeTab = 'history'}
        class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'history' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
      >
        History
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
              
              <div class="grid grid-cols-1 gap-4">
                <div>
                  <label for="mapping-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    id="mapping-status"
                    bind:value={newMapping.status}
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option>planned</option>
                    <option>implemented</option>
                    <option>verified</option>
                  </select>
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
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium {mapping.status === 'implemented' ? 'bg-green-100 text-green-800' : mapping.status === 'verified' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}">Status: {mapping.status}</span>
                    <!-- Author info available via git history -->
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
    {:else if activeTab === 'history'}
      <div class="space-y-8">
        <!-- Control File History -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="text-lg font-medium text-gray-900 dark:text-white">Control File History</h4>
            {#if gitHistory}
              <div class="text-sm text-gray-500 dark:text-gray-400">
                {gitHistory.totalCommits} commits
              </div>
            {/if}
          </div>
        
        {#if loadingHistory}
          <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span class="ml-3 text-gray-600 dark:text-gray-400">Loading git history...</span>
          </div>
        {:else if gitHistory && gitHistory.commits.length > 0}
          <div class="space-y-4">
            {#each gitHistory.commits as commit}
              <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-700">
                <div class="flex items-start justify-between mb-2">
                  <div class="flex items-center space-x-3">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-mono">
                      {commit.shortHash}
                    </span>
                    <span class="text-sm font-medium text-gray-900 dark:text-white">
                      {commit.author}
                    </span>
                  </div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(commit.date)}
                  </span>
                </div>
                
                <p class="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  {commit.message}
                </p>
                
                <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <div class="flex items-center space-x-4">
                    {#if commit.changes.insertions > 0}
                      <span class="text-green-600 dark:text-green-400">
                        +{commit.changes.insertions}
                      </span>
                    {/if}
                    {#if commit.changes.deletions > 0}
                      <span class="text-red-600 dark:text-red-400">
                        -{commit.changes.deletions}
                      </span>
                    {/if}
                  </div>
                  {#if commit.diff}
                    <button
                      onclick={() => toggleDiffExpansion(commit.hash)}
                      class="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <svg class="w-3 h-3 mr-1 {expandedCommits.has(commit.hash) ? 'rotate-180' : ''} transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                      {expandedCommits.has(commit.hash) ? 'Hide' : 'Show'} Changes
                    </button>
                  {/if}
                </div>
                
                {#if commit.diff && expandedCommits.has(commit.hash)}
                  <div class="mt-3">
                    <DiffViewer diff={commit.diff} fileName={control.id + '.yaml'} language="yaml" />
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else if gitHistory}
          <div class="text-center py-12">
            <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No git history found</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This control file is new and hasn't been committed to git yet. Once you make your first commit, the history will appear here.
            </p>
            <div class="mt-4">
              <div class="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                File staged but not committed
              </div>
            </div>
          </div>
        {:else}
          <div class="text-center py-12">
            <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">Unable to load git history</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              There was an error loading the git history for this control.
            </p>
          </div>
        {/if}
        </div>
        
        <!-- Mapping History -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="text-lg font-medium text-gray-900 dark:text-white">Mapping History</h4>
            {#if mappingHistory}
              <div class="text-sm text-gray-500 dark:text-gray-400">
                {mappingHistory.totalCommits} commits
              </div>
            {/if}
          </div>
          
          {#if loadingMappingHistory}
            <div class="flex items-center justify-center py-8">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span class="ml-3 text-gray-600 dark:text-gray-400">Loading mapping history...</span>
            </div>
          {:else if mappingHistory && mappingHistory.commits.length > 0}
            <div class="space-y-3">
              {#each mappingHistory.commits as commit}
                <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20">
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center space-x-3">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 font-mono">
                        {commit.shortHash}
                      </span>
                      <span class="text-sm font-medium text-gray-900 dark:text-white">
                        {commit.author}
                      </span>
                    </div>
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(commit.date)}
                    </span>
                  </div>
                  
                  <p class="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    {commit.message}
                  </p>
                  
                  <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <div class="flex items-center space-x-4">
                      {#if commit.changes.insertions > 0}
                        <span class="text-green-600 dark:text-green-400">
                          +{commit.changes.insertions}
                        </span>
                      {/if}
                      {#if commit.changes.deletions > 0}
                        <span class="text-red-600 dark:text-red-400">
                          -{commit.changes.deletions}
                        </span>
                      {/if}
                    </div>
                    {#if commit.diff}
                      <button
                        onclick={() => toggleMappingDiffExpansion(commit.hash)}
                        class="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <svg class="w-3 h-3 mr-1 {expandedMappingCommits.has(commit.hash) ? 'rotate-180' : ''} transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                        {expandedMappingCommits.has(commit.hash) ? 'Hide' : 'Show'} Changes
                      </button>
                    {/if}
                  </div>
                  
                  {#if commit.diff && expandedMappingCommits.has(commit.hash)}
                    <div class="mt-2">
                      <DiffViewer diff={commit.diff} fileName={`${control['control-acronym'].split('-')[0]}-mappings.yaml`} language="yaml" />
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {:else if mappingHistory}
            <div class="text-center py-6">
              <svg class="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No mapping history found</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                This family's mapping file is new or hasn't been committed to git yet.
              </p>
            </div>
          {:else}
            <div class="text-center py-6">
              <svg class="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">Unable to load mapping history</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                There was an error loading the mapping history.
              </p>
            </div>
          {/if}
        </div>
      </div>
    {/if}
    </div>
  </div>
</div>
