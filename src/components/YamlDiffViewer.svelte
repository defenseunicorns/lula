<script lang="ts">
  import { formatValue } from '../lib/yamlDiff.js';

  interface Props {
    yamlDiff: any; // YamlDiffResult
    showToggle?: boolean;
  }

  let { yamlDiff, showToggle = true }: Props = $props();
  
  let showDetailedView = $state(false); // Default to summary/compact view
  
  function getChangeIcon(type: string) {
    switch (type) {
      case 'added': return '+';
      case 'removed': return '-';
      case 'modified': return '~';
      default: return '•';
    }
  }
  
  function getChangeColor(type: string) {
    switch (type) {
      case 'added': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'removed': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'modified': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
    }
  }
  
</script>

<div class="yaml-diff-viewer bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-800 dark:to-slate-900 rounded-xl shadow-sm overflow-hidden">
  <div class="bg-slate-100 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Changes</span>
        <span class="text-xs text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded-full">
          {yamlDiff?.summary || 'No changes'}
        </span>
      </div>
      
      {#if showToggle}
        <button
          onclick={() => showDetailedView = !showDetailedView}
          class="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-200 dark:bg-slate-600 rounded hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
        >
          <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {showDetailedView ? 'Summary' : 'Details'}
        </button>
      {/if}
    </div>
  </div>
  
  <div class="max-h-96 overflow-y-auto">
    {#if yamlDiff?.changes && yamlDiff.changes.length > 0}
      {#if showDetailedView}
        <!-- Detailed view with full context -->
        <div class="divide-y divide-slate-200 dark:divide-slate-600">
          {#each yamlDiff.changes as change}
            <div class="p-3 {getChangeColor(change.type)}">
              <div class="flex items-start space-x-3">
                <div class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                  {getChangeIcon(change.type)}
                </div>
                
                <div class="flex-1 min-w-0">
                  <div class="flex items-center space-x-2 mb-1">
                    <span class="text-sm font-medium text-slate-900 dark:text-white">
                      {change.description}
                    </span>
                    <span class="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                      {change.path}
                    </span>
                  </div>
                  
                  {#if change.type === 'modified'}
                    <div class="text-sm space-y-1">
                      <div class="flex items-start space-x-2">
                        <span class="text-red-600 dark:text-red-400 font-mono text-xs">-</span>
                        <code class="text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded text-xs">
                          {formatValue(change.oldValue)}
                        </code>
                      </div>
                      <div class="flex items-start space-x-2">
                        <span class="text-green-600 dark:text-green-400 font-mono text-xs">+</span>
                        <code class="text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded text-xs">
                          {formatValue(change.newValue)}
                        </code>
                      </div>
                    </div>
                  {:else if change.type === 'added'}
                    <div class="text-sm">
                      <code class="text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded text-xs">
                        {formatValue(change.newValue)}
                      </code>
                    </div>
                  {:else if change.type === 'removed'}
                    <div class="text-sm">
                      <code class="text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded text-xs">
                        {formatValue(change.oldValue)}
                      </code>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <!-- Summary view - more compact -->
        <div class="p-4 space-y-2">
          {#each yamlDiff.changes as change}
            <div class="flex items-center space-x-2 text-sm">
              <span class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold {getChangeColor(change.type)}">
                {getChangeIcon(change.type)}
              </span>
              
              <span class="font-medium text-slate-900 dark:text-white">
                {change.description}
              </span>
              
              {#if change.type === 'modified' && change.oldValue !== change.newValue}
                <div class="flex items-center space-x-1 text-xs ml-2">
                  <code class="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded">
                    {typeof change.oldValue === 'string' && change.oldValue.length > 20 
                      ? change.oldValue.substring(0, 20) + '...' 
                      : formatValue(change.oldValue)}
                  </code>
                  <span class="text-gray-400">→</span>
                  <code class="text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded">
                    {typeof change.newValue === 'string' && change.newValue.length > 20 
                      ? change.newValue.substring(0, 20) + '...' 
                      : formatValue(change.newValue)}
                  </code>
                </div>
              {:else if change.type === 'added' && change.newValue !== undefined}
                <div class="flex items-center space-x-1 text-xs ml-2">
                  <code class="text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded">
                    {typeof change.newValue === 'string' && change.newValue.length > 20 
                      ? change.newValue.substring(0, 20) + '...' 
                      : formatValue(change.newValue)}
                  </code>
                </div>
              {:else if change.type === 'removed' && change.oldValue !== undefined}
                <div class="flex items-center space-x-1 text-xs ml-2">
                  <code class="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded">
                    {typeof change.oldValue === 'string' && change.oldValue.length > 20 
                      ? change.oldValue.substring(0, 20) + '...' 
                      : formatValue(change.oldValue)}
                  </code>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <div class="p-6 text-center text-slate-500 dark:text-slate-400">
        <svg class="mx-auto h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm">No changes detected</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .yaml-diff-viewer {
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  }
</style>
