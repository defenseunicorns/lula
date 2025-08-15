<script lang="ts">
	interface Tab {
		id: string;
		label: string;
		icon?: any;
		count?: number;
		disabled?: boolean;
	}

	interface Props {
		tabs: Tab[];
		active: string;
		onSelect: (tabId: string) => void;
	}

	let { tabs, active, onSelect }: Props = $props();
</script>

<nav class="border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
	<div class="flex space-x-8 px-6">
		{#each tabs as tab}
			<button
				onclick={() => !tab.disabled && onSelect(tab.id)}
				disabled={tab.disabled}
				class="inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors {active === tab.id
					? 'border-blue-500 text-blue-600 dark:text-blue-400'
					: tab.disabled 
						? 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'
						: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
			>
				{#if tab.icon}
					{@const IconComponent = tab.icon}
					<IconComponent class="w-4 h-4 mr-2" />
				{/if}
				{tab.label}
				{#if tab.count !== undefined}
					<span class="ml-1 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
						{tab.count}
					</span>
				{/if}
			</button>
		{/each}
	</div>
</nav>