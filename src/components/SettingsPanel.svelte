<script lang="ts">
  import { getAvailableAdapters, getAdapter } from '$lib/adapters/index.js';
  import type { FormatAdapter } from '$lib/adapters/types.js';
  import FeatureToggle from './ui/FeatureToggle.svelte';

  interface Props {
    isOpen: boolean;
    useDynamicForms: boolean;
    onClose: () => void;
    onDynamicFormsToggle: (enabled: boolean) => void;
  }

  let { 
    isOpen,
    useDynamicForms,
    onClose,
    onDynamicFormsToggle
  }: Props = $props();

  // Get adapter statistics (for import functionality)
  const adapters = getAvailableAdapters();
</script>

{#if isOpen}
  <!-- Settings Sidebar -->
  <div class="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
    <div class="absolute inset-0 overflow-hidden">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()} role="button" tabindex="0"></div>
      
      <!-- Panel -->
      <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div class="pointer-events-auto relative w-screen max-w-md">
          <!-- Close Button -->
          <div class="absolute left-0 top-0 -ml-8 flex pr-2 pt-4 sm:-ml-10 sm:pr-4">
            <button
              onclick={onClose}
              class="relative rounded-md text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
            >
              <span class="absolute -inset-2.5"></span>
              <span class="sr-only">Close panel</span>
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Panel Content -->
          <div class="flex h-full flex-col overflow-y-scroll bg-white dark:bg-gray-800 py-6 shadow-xl">
            <div class="px-4 sm:px-6">
              <h2 class="text-base font-semibold leading-6 text-gray-900 dark:text-white" id="slide-over-title">
                Settings
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Configure how controls are displayed and edited
              </p>
            </div>

            <div class="relative mt-6 flex-1 px-4 sm:px-6 space-y-6">
              
              <!-- UI Features Section -->
              <div class="border-b border-gray-200 dark:border-gray-700 pb-6">
                <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-4">
                  User Interface
                </h3>
                
                <FeatureToggle
                  bind:enabled={useDynamicForms}
                  label="Dynamic Forms"
                  description="Use schema-driven forms that adapt to different control formats"
                  onToggle={onDynamicFormsToggle}
                />
                
                <div class="mt-4 p-3 {useDynamicForms ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'} border rounded-md">
                  <div class="text-xs {useDynamicForms ? 'text-green-800 dark:text-green-200' : 'text-gray-600 dark:text-gray-400'}">
                    {#if useDynamicForms}
                      ✓ Dynamic forms enabled - forms will adapt to different control schemas
                    {:else}
                      Static forms mode - using legacy form layout
                    {/if}
                  </div>
                </div>
              </div>


              <!-- System Information -->
              <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-4">
                  System Information
                </h3>
                
                <dl class="space-y-3 text-sm">
                  <div class="flex justify-between">
                    <dt class="text-gray-500 dark:text-gray-400">Import Adapters Available</dt>
                    <dd class="text-gray-900 dark:text-white font-medium">{adapters.length}</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-gray-500 dark:text-gray-400">Storage Format</dt>
                    <dd class="text-gray-900 dark:text-white font-medium">Native YAML</dd>
                  </div>
                </dl>

                <!-- Current Schema Details -->
                <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <div class="text-xs text-blue-800 dark:text-blue-200 font-medium mb-2">
                    Active Schema: {currentAdapter.schema.name}
                  </div>
                  <div class="text-xs text-blue-700 dark:text-blue-300">
                    {currentAdapter.schema.fields.length} fields across {currentAdapter.schema.groups?.length || 1} sections
                  </div>
                  {#if currentAdapter.schema.groups}
                    <div class="mt-2 space-y-1">
                      {#each currentAdapter.schema.groups as group}
                        <div class="text-xs text-blue-600 dark:text-blue-300">
                          • {group.label}: {currentAdapter.schema.fields.filter(f => f.group === group.id).length} fields
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}