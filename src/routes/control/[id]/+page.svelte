<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ControlDetailsPanel, ControlsList } from '$components/controls';
	import { selectedControl } from '$stores/compliance';
	import { wsClient } from '$lib/websocket';
	import { Document } from 'carbon-icons-svelte';
	import { onMount } from 'svelte';

	// Track the last fetched control ID to avoid refetching
	let lastFetchedControlId = '';

	// React to URL parameter changes and fetch control details
	$effect(() => {
		const controlId = $page.params.id;
		if (!controlId) return;

		const decodedControlId = decodeURIComponent(controlId);
		
		// Check if we need to fetch - only when control ID changes
		if (decodedControlId && decodedControlId !== lastFetchedControlId) {
			// Check connection status without subscribing to full appState
			const isConnected = wsClient.isConnected();
			
			if (isConnected) {
				lastFetchedControlId = decodedControlId;
				
				// Fetch full control details from backend
				wsClient.getControlDetails(decodedControlId);
			}
		}
	});

	// Listen for control details from WebSocket
	onMount(() => {
		const handleControlDetails = (event: CustomEvent) => {
			const control = event.detail;
			if (control) {
				selectedControl.set(control);
			} else {
				// Control not found, redirect to home
				goto('/');
			}
		};

		window.addEventListener('control-details', handleControlDetails as EventListener);

		return () => {
			window.removeEventListener('control-details', handleControlDetails as EventListener);
		};
	});
</script>

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
