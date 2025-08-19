<script lang="ts">
	import { onMount } from 'svelte';
	import { complianceStore, loading, controls, selectedControl } from '../stores/compliance';
	import ControlsList from '../components/ControlsList.svelte';
	import ControlDetailsPanel from '../components/ControlDetailsPanel.svelte';
	import ControlSetInfo from '../components/ControlSetInfo.svelte';
	import SettingsPanel from '../components/SettingsPanel.svelte';
	import { Document, Settings } from 'carbon-icons-svelte';

	// UI state
	let showSettings = $state(false);

	onMount(() => {
		complianceStore.init();
	});
</script>

<div class="h-screen flex flex-col">
	<!-- Fixed Header -->
	<header
		class="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
	>
		<div class="w-full px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between items-center py-4">
				<div>
					<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Not Lula</h1>
				</div>
				<div class="flex items-center space-x-4">
					<ControlSetInfo />
					<button
						onclick={() => (showSettings = true)}
						class="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
						title="Settings"
					>
            <Settings class="w-4 h-4 mr-2" />
						Settings
					</button>
				</div>
			</div>
		</div>
	</header>

	<!-- Split Pane Layout with Cards -->
	<div class="flex-1 flex gap-6 p-6 overflow-hidden">
		{#if $loading}
			<div class="flex-1 flex justify-center items-center">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			</div>
		{:else}
			<!-- Left Pane: Controls List Card -->
			<div class="w-1/2 flex flex-col">
				<div
					class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm h-full flex flex-col"
				>
					<ControlsList />
				</div>
			</div>

			<!-- Right Pane: Control Details -->
			<div class="w-1/2 flex flex-col">
				{#if $selectedControl}
					<ControlDetailsPanel control={$selectedControl} />
				{:else}
					<div class=" h-full flex flex-col">
						<div class="flex-1 flex items-center justify-center p-8">
							<div class="text-center text-gray-500 dark:text-gray-400">
								<Document class="mx-auto h-16 w-16 mb-4" />
								<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
									No Control Selected
								</h3>
								<p class="text-gray-600 dark:text-gray-400">
									Select a control from the list to view and edit its details
								</p>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Settings Panel -->
	<SettingsPanel isOpen={showSettings} onClose={() => (showSettings = false)} />
</div>
