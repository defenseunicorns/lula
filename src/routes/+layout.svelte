<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ControlSetInfo } from '$components/control-sets';
	import { appState, wsClient } from '$lib/websocket';
	import { onDestroy, onMount } from 'svelte';
	import '../app.css';

	let { children } = $props();

	let hasCheckedInitialRedirect = false;

	onMount(() => {
		// Connect WebSocket - this will get the initial state
		wsClient.connect();

		// Only check for redirect once on initial mount
		// We need to wait for the WebSocket to connect and send initial state
		let checkTimeoutId: number | null = null;

		const checkForRedirect = async () => {
			// Skip if we've already checked, we're on the setup page, or switching control sets
			if (
				hasCheckedInitialRedirect ||
				$page.url.pathname === '/setup' ||
				$appState.isSwitchingControlSet
			) {
				return;
			}

			const state = $appState;

			// If connected and we have the initial state
			if (state.isConnected) {
				hasCheckedInitialRedirect = true;

				// Check if we have a valid control set
				if (
					!state.name ||
					state.name === 'Unknown Control Set' ||
					state.id === 'unknown' ||
					state.id === 'default'
				) {
					// Only redirect if we don't have controls (not just switching)
					if (!state.controls || state.controls.length === 0) {
						// Scan for available control sets
						await wsClient.scanControlSets();
						
						// Wait for the control sets list to arrive
						const controlSets = await new Promise((resolve) => {
							const handler = (event: CustomEvent) => {
								window.removeEventListener('control-sets-list', handler as EventListener);
								resolve(event.detail);
							};
							window.addEventListener('control-sets-list', handler as EventListener);
							
							// Timeout after 2 seconds
							setTimeout(() => {
								window.removeEventListener('control-sets-list', handler as EventListener);
								resolve(null);
							}, 2000);
						});
						
						if (controlSets && Array.isArray(controlSets) && controlSets.length === 1) {
							// Only one control set available - auto-load it
							console.log('Auto-loading single control set:', controlSets[0].path);
							await wsClient.switchControlSet(controlSets[0].path);
						} else {
							// Multiple control sets or none - show setup
							goto('/setup');
						}
					}
				}
			} else {
				// Not connected yet, check again in a moment
				checkTimeoutId = window.setTimeout(checkForRedirect, 500);
			}
		};

		// Start checking after a short delay to let WebSocket connect
		checkTimeoutId = window.setTimeout(checkForRedirect, 100);

		return () => {
			if (checkTimeoutId) {
				clearTimeout(checkTimeoutId);
			}
		};
	});

	onDestroy(() => {
		// Disconnect WebSocket when component is destroyed
		wsClient.disconnect();
	});
</script>

<div class="h-screen flex flex-col">
	{#if $page.url.pathname !== '/setup'}
		<!-- Fixed Header -->
		<header
			class="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
		>
			<div class="w-full px-4 sm:px-6 lg:px-8">
				<div class="flex justify-between items-center py-4">
					<a href="/" class="ml-1 flex sm:ml-2 md:mr-4">
						<img src="/lula.png" class="mr-1 block h-8 sm:mr-4" alt="Logo" />
						<span
							class="text-md self-center font-semibold whitespace-nowrap text-gray-100 md:text-2xl"
						>
							Lula
						</span>
					</a>
					<div class="flex items-center space-x-4">
						<ControlSetInfo />
					</div>
				</div>
			</div>
		</header>

		<!-- Split Pane Layout with Cards -->
		<div class="flex-1 flex gap-6 p-6 overflow-hidden">
			{#if $appState.isSwitchingControlSet}
				<!-- Show loading during control set switch -->
				<div class="flex-1 flex justify-center items-center">
					<div class="text-center">
						<div
							class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"
						></div>
						<p class="text-gray-500 dark:text-gray-400">Switching control set...</p>
					</div>
				</div>
			{:else if !$appState.isConnected || !$appState.controls || $appState.controls.length === 0 || !$appState.fieldSchema}
				<div class="flex-1 flex justify-center items-center">
					<div class="text-center">
						<div
							class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"
						></div>
						<p class="text-gray-500 dark:text-gray-400">
							{!$appState.isConnected ? 'Connecting...' : !$appState.fieldSchema ? 'Loading schema...' : 'Loading controls...'}
						</p>
					</div>
				</div>
			{:else}
				{@render children()}
			{/if}
		</div>
	{:else}
		<!-- Setup page gets full screen -->
		{@render children()}
	{/if}
</div>
