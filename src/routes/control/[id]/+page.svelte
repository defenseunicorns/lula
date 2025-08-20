<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { complianceStore, loading, controls, selectedControl } from '../../../stores/compliance';
	import ControlsList from '../../../components/controls/ControlsList.svelte';
	import ControlDetailsPanel from '../../../components/controls/ControlDetailsPanel.svelte';
	import ControlSetInfo from '../../../components/control-sets/ControlSetInfo.svelte';
	import { Document } from 'carbon-icons-svelte';


	onMount(async () => {
		await complianceStore.init();
	});

	// React to URL parameter changes
	$effect(() => {
		const controlId = $page.params.id;
		if (!controlId) return;
		
		const decodedControlId = decodeURIComponent(controlId);
		
		if (decodedControlId && $controls.length > 0) {
			const control = $controls.find(c => c.id === decodedControlId);
			if (control) {
				selectedControl.set(control);
			} else {
				// Control not found, redirect to home
				goto('/');
			}
		}
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
					<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Lula</h1>
				</div>
				<div class="flex items-center space-x-4">
					<ControlSetInfo />
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
</div>