<!-- Setup Wizard Page for Control Set Creation -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { ExistingControlSets, SpreadsheetImport } from '$components/setup';
	import { appState, wsClient } from '$lib/websocket';
	import { onMount } from 'svelte';

	let activeTab: 'import' | 'existing' = 'import'; // Default to import
	let currentControlSetPath = '';
	let hasAnyControlSets = false;
	let isSwitching = false;
	let controlSets: { path: string; name: string; description?: string }[] = [];

	onMount(async () => {
		// Connect WebSocket if not already connected
		wsClient.connect();

		// Use appState to check current control set
		const unsubscribe = appState.subscribe((state) => {
			if (
				state.name &&
				state.name !== 'Unknown Control Set' &&
				state.id !== 'unknown' &&
				state.id !== 'default'
			) {
				// Store the current path if a control set is loaded
				currentControlSetPath = state.currentPath || '';
			}
		});

		// Listen for control sets list
		const handleControlSetsList = async (event: CustomEvent) => {
			const data = event.detail;
			if (data && data.controlSets) {
				controlSets = data.controlSets || [];
				hasAnyControlSets = controlSets.length > 0;

				// Check if we should auto-load
				if (controlSets.length === 1) {
					const singleControlSet = controlSets[0];
					const isAlreadyLoaded =
						currentControlSetPath && currentControlSetPath.includes(singleControlSet.path);

					// Only auto-load if it's not already the current control set
					if (!isAlreadyLoaded && !currentControlSetPath) {
						console.log(
							'Only one control set found and none loaded, auto-loading:',
							singleControlSet.path
						);
						await switchControlSet(singleControlSet.path);
						return;
					}
				}

				// Only switch to existing tab if there are control sets
				if (hasAnyControlSets) {
					activeTab = 'existing';
				}
			}
		};

		window.addEventListener('control-sets-list', handleControlSetsList as unknown as EventListener);

		// Request control sets scan via WebSocket
		try {
			await wsClient.scanControlSets();
		} catch (err) {
			console.error('Error scanning control sets:', err);
		}

		return () => {
			unsubscribe();
			window.removeEventListener(
				'control-sets-list',
				handleControlSetsList as unknown as EventListener
			);
		};
	});

	async function switchControlSet(path: string) {
		console.log('Starting control set switch to:', path);
		isSwitching = true;

		// Store the current state to detect changes
		let initialPath = '';
		const unsubscribeInitial = appState.subscribe((state: any) => {
			initialPath = state.currentPath || '';
		});
		// Immediately unsubscribe after getting the initial value
		unsubscribeInitial();

		try {
			// Use WebSocket to switch control set (now async)
			await wsClient.switchControlSet(path);
			console.log('WebSocket command sent, waiting for state update...');

			// Wait for the state to update via WebSocket
			let hasUpdated = false;
			const unsubscribe = appState.subscribe((state: any) => {
				console.log('State check - currentPath:', state.currentPath, 'looking for:', path);
				// Check if the state has been updated with new control set
				if (
					state.currentPath &&
					state.currentPath !== initialPath &&
					state.currentPath.includes(path)
				) {
					if (!hasUpdated) {
						hasUpdated = true;
						console.log('Control set switch successful, navigating home...');
						unsubscribe();
						isSwitching = false;
						// Use SvelteKit navigation instead of hard reload
						goto('/');
					}
				}
			});

			// Add a timeout to prevent hanging forever
			setTimeout(() => {
				unsubscribe();
				if (isSwitching) {
					console.error('Control set switch timed out');
					isSwitching = false;
					alert('Control set switch timed out. Please try again.');
				}
			}, 5000);
		} catch (error) {
			console.error('Error switching control set:', error);
			alert('Failed to switch control set: ' + (error as Error).message);
			isSwitching = false;
		}
	}

	async function handleControlSetCreated(event: CustomEvent) {
		const { path } = event.detail;
		await switchControlSet(path);
	}

	async function handleControlSetSelected(event: CustomEvent) {
		const { path } = event.detail;
		await switchControlSet(path);
	}

	function handleTabChange(event: CustomEvent) {
		const { tab } = event.detail;
		if (tab) {
			activeTab = tab;
		}
	}
</script>

<div class=" p-4">
	<div class="max-w-6xl mx-auto">
		<!-- Header -->
		<div class="text-center py-8">
			<h1
				class="text-4xl font-extrabold text-gray-900 dark:text-white mb-4 flex items-center justify-center gap-3"
			>
				<img src="/lula.png" class="h-12 w-12" alt="Lula" />
				<span>Lula</span>
			</h1>
			<p class="text-lg text-gray-600 dark:text-gray-400">
				{#if currentControlSetPath}
					You have an existing control set. You can continue using it or create a new one.
				{:else if hasAnyControlSets}
					Select an existing control set or import a new one from a spreadsheet.
				{:else}
					Let's get started by importing a control set from a spreadsheet.
				{/if}
			</p>
		</div>

		<!-- Tab Navigation (only show if there are existing control sets) -->
		{#if hasAnyControlSets}
			<div class="flex justify-center mb-8">
				<div
					class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 inline-flex"
				>
					<button
						on:click={() => (activeTab = 'existing')}
						class="px-6 py-3 rounded-l-lg font-medium transition-colors {activeTab === 'existing'
							? 'bg-blue-600 text-white'
							: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
					>
						Select Existing Control Set
					</button>
					<button
						on:click={() => (activeTab = 'import')}
						class="px-6 py-3 rounded-r-lg font-medium transition-colors {activeTab === 'import'
							? 'bg-blue-600 text-white'
							: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
					>
						Import New from Spreadsheet
					</button>
				</div>
			</div>
		{/if}

		<!-- Content Area -->
		<div
			class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-xl p-6 relative border border-gray-200 dark:border-gray-700"
		>
			{#if activeTab === 'import'}
				<SpreadsheetImport on:created={handleControlSetCreated} />
			{:else}
				<ExistingControlSets
					{controlSets}
					on:selected={handleControlSetSelected}
					on:tab-change={handleTabChange}
				/>
			{/if}

			{#if isSwitching}
				<div
					class="absolute inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center rounded-lg"
				>
					<div class="bg-white dark:bg-gray-700 rounded-lg p-6 text-center">
						<svg
							class="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						<p class="text-gray-900 dark:text-white">Switching control set...</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
