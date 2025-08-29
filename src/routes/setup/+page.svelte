<!-- Setup Wizard Page for Control Set Creation -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { SpreadsheetImport, ExistingControlSets } from '$components/setup';

	let activeTab: 'import' | 'existing' = 'import'; // Default to import
	let hasExistingControlSet = false;
	let hasAnyControlSets = false;
	let isLoading = true;
	let isSwitching = false;

	onMount(async () => {
		// Check both control set status in parallel
		const [currentResponse, scanResponse] = await Promise.all([
			fetch('/api/control-set').catch(() => null),
			fetch('/api/scan-control-sets').catch(() => null)
		]);

		// Check if we have a current control set
		if (currentResponse && currentResponse.ok) {
			try {
				const data = await currentResponse.json();
				// Check that it's not the default "Unknown Control Set"
				if (data && data.name && data.name !== 'Unknown Control Set') {
					hasExistingControlSet = true;
				}
			} catch (err) {
				console.error('Error checking control set:', err);
			}
		}

		// Check if there are any control sets available
		if (scanResponse && scanResponse.ok) {
			try {
				const data = await scanResponse.json();
				hasAnyControlSets = data.controlSets && data.controlSets.length > 0;
				
				// Only switch to existing tab if there are control sets
				if (hasAnyControlSets) {
					activeTab = 'existing';
				}
			} catch (err) {
				console.error('Error scanning control sets:', err);
			}
		}

		isLoading = false;
	});

	async function switchControlSet(path: string) {
		isSwitching = true;
		try {
			const response = await fetch('/api/switch-control-set', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path })
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to switch control set');
			}

			// Redirect to main app after switching
			await goto('/');
		} catch (error) {
			console.error('Error switching control set:', error);
			alert('Failed to switch control set: ' + (error as Error).message);
		} finally {
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
</script>

<div class=" p-4">
	<div class="max-w-6xl mx-auto">
		<!-- Header -->
		<div class="text-center py-8">
			<h1 class="text-4xl font-extrabold text-gray-900 dark:text-white mb-4 flex items-center justify-center gap-3">
				<img src="/lula.png" class="h-12 w-12" alt="Lula" />
				<span>Lula</span>
			</h1>
			<p class="text-lg text-gray-600 dark:text-gray-400">
				{#if hasExistingControlSet}
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
		<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-xl p-6 relative border border-gray-200 dark:border-gray-700">
			{#if activeTab === 'import'}
				<SpreadsheetImport on:created={handleControlSetCreated} />
			{:else}
				<ExistingControlSets on:selected={handleControlSetSelected} />
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

		{#if hasExistingControlSet}
			<div class="mt-4 text-center">
				<a href="/" class="text-sm text-blue-600 dark:text-blue-400 hover:underline">
					Continue with current control set →
				</a>
			</div>
		{/if}
	</div>
</div>
