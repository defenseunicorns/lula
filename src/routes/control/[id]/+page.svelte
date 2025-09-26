<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ControlDetailsPanel, ControlsList } from '$components/controls';
	import { wsClient } from '$lib/websocket';
	import { selectedControl } from '$stores/compliance';
	import { Document } from 'carbon-icons-svelte';
	import { onMount } from 'svelte';

	// Track the last fetched control ID to avoid refetching
	let lastFetchedControlId = '';
	let isLoadingControl = $state(false);

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
				isLoadingControl = true;

				// Fetch full control details from backend
				wsClient.getControlDetails(decodedControlId);
			}
		}
	});

	// Listen for control details from WebSocket
	onMount(() => {
		const handleControlDetails = (event: CustomEvent) => {
			const control = event.detail;
			isLoadingControl = false;
			if (control) {
				selectedControl.set(control);
			} else {
				// Control not found, redirect to the main page
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
<div class="w-1/2 flex flex-col relative">
	{#if isLoadingControl}
		<!-- Loading spinner in top-right corner -->
		<div class="absolute top-4 right-4 z-10">
			<div
				class="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30"
				title="Loading control..."
			>
				<svg
					class="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
			</div>
		</div>
	{/if}

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
