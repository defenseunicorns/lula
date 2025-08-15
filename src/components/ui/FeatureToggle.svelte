<script lang="ts">
  interface Props {
    enabled: boolean;
    label: string;
    description?: string;
    onToggle: (enabled: boolean) => void;
  }

  let { enabled = $bindable(), label, description, onToggle }: Props = $props();

  function handleToggle() {
    enabled = !enabled;
    onToggle(enabled);
  }
</script>

<div class="flex items-center justify-between py-3">
  <div class="flex-1">
    <div class="flex items-center">
      <h3 class="text-sm font-medium text-gray-900 dark:text-white">
        {label}
      </h3>
    </div>
    {#if description}
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {description}
      </p>
    {/if}
  </div>
  
  <button
    type="button"
    onclick={handleToggle}
    class="{enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
    role="switch"
    aria-checked={enabled}
  >
    <span class="sr-only">{label}</span>
    <span
      class="{enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
    ></span>
  </button>
</div>