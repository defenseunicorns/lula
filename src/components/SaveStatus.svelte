<script lang="ts">
  import { saveStatus } from '../stores/compliance';
</script>

{#if $saveStatus === 'saving'}
  <div class="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
    <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span class="text-sm">Saving...</span>
  </div>
{:else if $saveStatus === 'error'}
  <div class="flex items-center space-x-2 text-red-600 dark:text-red-400">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
    <span class="text-sm">Error saving</span>
  </div>
{:else if $saveStatus === 'saved'}
  <div class="flex items-center space-x-2 text-green-600 dark:text-green-400">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
    </svg>
    <span class="text-sm">Saved</span>
  </div>
{/if}
