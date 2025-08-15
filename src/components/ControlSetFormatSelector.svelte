<script lang="ts">
  import { getAvailableAdapters } from '$lib/adapters/index.js';
  import type { FormatAdapter } from '$lib/adapters/types.js';

  interface Props {
    currentAdapter: FormatAdapter;
    onAdapterChange: (adapter: FormatAdapter) => void;
  }

  let { currentAdapter, onAdapterChange }: Props = $props();

  // Get all available adapters
  const availableAdapters = getAvailableAdapters();
  let selectedAdapterId = $state(currentAdapter.id);

  function handleAdapterChange(adapterId: string) {
    const adapter = availableAdapters.find(a => a.id === adapterId);
    if (adapter) {
      selectedAdapterId = adapterId;
      onAdapterChange(adapter);
    }
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-medium text-gray-900 dark:text-white">
      Control Set Format
    </h3>
    <div class="text-sm text-gray-500 dark:text-gray-400">
      {availableAdapters.length} format{availableAdapters.length === 1 ? '' : 's'} available
    </div>
  </div>

  <div class="space-y-3">
    {#each availableAdapters as adapter}
      <label class="relative flex items-start">
        <input
          type="radio"
          name="adapter"
          value={adapter.id}
          checked={selectedAdapterId === adapter.id}
          onchange={() => handleAdapterChange(adapter.id)}
          class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 mt-1"
        />
        <div class="ml-3 flex-1">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {adapter.name}
            </span>
            <span class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              v{adapter.version}
            </span>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {adapter.schema.description}
          </p>
          
          <!-- Schema Details -->
          <div class="mt-2 text-xs text-gray-400 dark:text-gray-500">
            <div class="flex items-center space-x-4">
              <span>
                {adapter.schema.fields.length} field{adapter.schema.fields.length === 1 ? '' : 's'}
              </span>
              {#if adapter.schema.groups}
                <span>
                  {adapter.schema.groups.length} section{adapter.schema.groups.length === 1 ? '' : 's'}
                </span>
              {/if}
              <span class="text-blue-600 dark:text-blue-400">
                ID: {adapter.id}
              </span>
            </div>
          </div>
          
          {#if selectedAdapterId === adapter.id}
            <div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <div class="text-xs text-blue-800 dark:text-blue-200 font-medium mb-2">
                Current Format Features:
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                {#if adapter.schema.groups}
                  {#each adapter.schema.groups as group}
                    <div class="text-blue-700 dark:text-blue-300">
                      • {group.label}
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </label>
    {/each}
  </div>

  <div class="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
    <div class="flex">
      <svg class="flex-shrink-0 h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      <div class="ml-3">
        <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
          Note about format switching
        </h3>
        <p class="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
          Changing the format will affect how controls are displayed and edited. Some fields may not be available in all formats.
        </p>
      </div>
    </div>
  </div>
</div>