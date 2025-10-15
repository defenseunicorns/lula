<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ControlSetInfo } from '$components/control-sets';
	import { ExportColumnDialog } from '$components/dialogs';
	import { GitStatusDropdown } from '$components/git-status';
	import { Dropdown } from '$components/ui';
	import { appState, wsClient } from '$lib/websocket';
	import { Code, DocumentExport, Download, LogoGithub } from 'carbon-icons-svelte';
	import { onDestroy, onMount } from 'svelte';
	import '../app.css';

	let { children } = $props();

	let hasCheckedInitialRedirect = false;

	let exportDialogOpen = $state(false);
	let exportFormat = $state<'csv' | 'excel'>('csv');
	let columnHeaders = $state<Array<{ value: string; label: string }>>([]);
	let defaultColumn = $state('Mappings');

	async function loadColumnHeaders() {
		try {
			const currentPath = $appState.currentPath;
			if (!currentPath) {
				console.error('No current control set path available');
				columnHeaders = [{ value: 'Mappings', label: 'Mappings (Default)' }];
				defaultColumn = 'Mappings';
				return;
			}

			const response = await fetch('/api/export-column-headers');
			if (response.ok) {
				const data = await response.json();
				columnHeaders = data.columnHeaders || [];
				defaultColumn = data.defaultColumn || 'Mappings';
			} else {
				console.error('Failed to load column headers');
				columnHeaders = [{ value: 'Mappings', label: 'Mappings (Default)' }];
				defaultColumn = 'Mappings';
			}
		} catch (error) {
			console.error('Error loading column headers:', error);
			columnHeaders = [{ value: 'Mappings', label: 'Mappings (Default)' }];
			defaultColumn = 'Mappings';
		}
	}

	async function exportControls(format: string) {
		if (format === 'json') {
			try {
				const exportUrl = `/api/export-controls?format=${format}`;
				const link = document.createElement('a');
				link.href = exportUrl;
				link.download = '';
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			} catch (error) {
				console.error('Export failed:', error);
			}
		} else {
			exportFormat = format as 'csv' | 'excel';
			await loadColumnHeaders();
			exportDialogOpen = true;
		}
	}

	async function handleExportWithColumn(
		event: CustomEvent<{ format: string; mappingsColumn: string }>
	) {
		try {
			const { format, mappingsColumn } = event.detail;
			const exportUrl = `/api/export-controls?format=${format}&mappingsColumn=${encodeURIComponent(mappingsColumn)}`;

			const link = document.createElement('a');
			link.href = exportUrl;
			link.download = '';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		} catch (error) {
			console.error('Export failed:', error);
		}
	}

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
			<div class="w-full px-6 lg:px-8">
				<div class="flex justify-between items-center h-16">
					<!-- Left: Logo and Brand -->
					<div class="flex items-center">
						<a href="/" class="flex items-center space-x-3 hover:opacity-80 transition-opacity">
							<img src="/lula.png" class="h-8 w-8" alt="Lula Logo" />
							<div class="flex flex-col">
								<span class="text-xl font-bold text-gray-900 dark:text-white"> Lula </span>
								<span class="text-xs text-gray-500 dark:text-gray-400 -mt-1">
									Gitops for Compliance
								</span>
							</div>
						</a>
					</div>

					<!-- Right: Control Set Info and Actions -->
					<div class="flex items-center space-x-4">
						<!-- Control Set Info Badge -->
						<ControlSetInfo />

						{#if $appState.isConnected && $appState.controls && $appState.controls.length > 0}
							<!-- Export Dropdown -->
							<Dropdown
								buttonLabel="Export"
								buttonIcon={Download}
								buttonClass="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
								dropdownClass="w-48"
							>
								{#snippet children()}
									<div class="space-y-1 p-1">
										<button
											onclick={() => exportControls('csv')}
											class="w-full text-left px-3 py-2 text-sm rounded-md transition-colors duration-200 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
										>
											<div class="flex items-center gap-2">
												<DocumentExport class="w-4 h-4" />
												<span>Export as CSV</span>
											</div>
										</button>
										<button
											onclick={() => exportControls('excel')}
											class="w-full text-left px-3 py-2 text-sm rounded-md transition-colors duration-200 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
										>
											<div class="flex items-center gap-2">
												<Download class="w-4 h-4" />
												<span>Export as Excel</span>
											</div>
										</button>
										<button
											onclick={() => exportControls('json')}
											class="w-full text-left px-3 py-2 text-sm rounded-md transition-colors duration-200 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
										>
											<div class="flex items-center gap-2">
												<Code class="w-4 h-4" />
												<span>Export as JSON</span>
											</div>
										</button>
									</div>
								{/snippet}
							</Dropdown>
						{/if}

						<!-- Github -->
						<a
							class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
							title="Github"
							href="https://github.com/defenseunicorns/lula"
							target="_blank"
						>
							<LogoGithub class="w-5 h-5" />
						</a>

						<!-- Git Status Dropdown -->
						<GitStatusDropdown />
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
							{!$appState.isConnected
								? 'Connecting...'
								: !$appState.fieldSchema
									? 'Loading schema...'
									: 'Loading controls...'}
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

<ExportColumnDialog
	bind:isOpen={exportDialogOpen}
	format={exportFormat}
	{columnHeaders}
	{defaultColumn}
	on:export={handleExportWithColumn}
	on:cancel={() => {}}
/>
