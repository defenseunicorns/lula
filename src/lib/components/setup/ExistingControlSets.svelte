<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { appState } from '$lib/websocket';

	const dispatch = createEventDispatcher();

	interface ControlSet {
		path: string;
		name: string;
		description: string;
		controlCount: number;
		file: string;
	}

	export let controlSets: ControlSet[] = [];

	let isLoading = false;
	let errorMessage = '';
	let selectedSet: ControlSet | null = null;

	// Get current control set path from appState
	$: currentPath = $appState.currentPath || '';

	// React to control sets prop changes
	$: if (controlSets) {
		if (controlSets.length === 0) {
			errorMessage = 'No existing control sets found. Try importing from a spreadsheet instead.';
		} else {
			// Find available control sets (not current)
			const availableSets = controlSets.filter((cs) => !isCurrentControlSet(cs));
			if (availableSets.length === 1) {
				// Auto-select if only one non-current control set found
				selectedSet = availableSets[0];
			} else if (availableSets.length === 0 && controlSets.length > 0) {
				// All control sets are current
				errorMessage = 'already-using-only-set';
			}
		}
	}

	function selectControlSet(controlSet: ControlSet) {
		// Don't select if it's the current control set
		if (isCurrentControlSet(controlSet)) {
			return;
		}
		selectedSet = controlSet;
	}

	function useSelectedControlSet() {
		if (selectedSet && !isCurrentControlSet(selectedSet)) {
			dispatch('selected', { path: selectedSet.path });
		}
	}

	function isCurrentControlSet(controlSet: ControlSet): boolean {
		// Check if this is the currently active control set
		// Normalize paths for comparison (remove trailing slashes)
		const normalizedCurrentPath = currentPath?.replace(/\/$/, '');
		const normalizedControlSetPath = controlSet.path?.replace(/\/$/, '');

		return !!(
			normalizedCurrentPath &&
			normalizedControlSetPath &&
			normalizedCurrentPath === normalizedControlSetPath
		);
	}
</script>

<div class="space-y-6">
	<div class="text-center">
		<h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
			Select an Existing Control Set
		</h2>
		<p class="text-gray-600 dark:text-gray-400">
			Choose from control sets found in your project directory
		</p>
	</div>

	{#if isLoading}
		<div class="flex justify-center py-12">
			<div class="text-center">
				<svg
					class="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4"
					xmlns="http://www.w3.org/2000/svg"
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
				<p class="text-gray-500 dark:text-gray-400">Scanning for control sets...</p>
			</div>
		</div>
	{:else if errorMessage === 'already-using-only-set'}
		<div class="text-center space-y-6">
			<div
				class="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border-2 border-green-500"
			>
				<svg
					class="w-12 h-12 text-green-600 mx-auto mb-4"
					fill="currentColor"
					viewBox="0 0 20 20"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
						clip-rule="evenodd"
					></path>
				</svg>
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
					Already Using Control Set
				</h3>
				<p class="text-gray-600 dark:text-gray-400 mb-4">
					You are already using the only available control set in this project.
				</p>
				{#if controlSets.length > 0}
					<div class="text-sm text-gray-500 dark:text-gray-400">
						<span class="font-medium">{controlSets[0].name}</span>
						{#if controlSets[0].controlCount}
							<span class="ml-2">({controlSets[0].controlCount} controls)</span>
						{/if}
					</div>
				{/if}
			</div>

			<div class="flex justify-center gap-4">
				<a
					href="/"
					class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-lg"
				>
					Continue to Controls
				</a>
				<button
					on:click={() => dispatch('tab-change', { tab: 'import' })}
					class="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
				>
					Import New Control Set
				</button>
			</div>
		</div>
	{:else if errorMessage}
		<div
			class="p-4 text-sm text-yellow-800 rounded-lg bg-yellow-50 dark:bg-gray-800 dark:text-yellow-300"
		>
			<div class="flex items-center">
				<svg
					class="flex-shrink-0 inline w-4 h-4 mr-3"
					aria-hidden="true"
					xmlns="http://www.w3.org/2000/svg"
					fill="currentColor"
					viewBox="0 0 20 20"
				>
					<path
						d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"
					/>
				</svg>
				<span>{errorMessage}</span>
			</div>
		</div>
	{:else if controlSets.length > 0}
		<div class="space-y-3">
			{#each controlSets as controlSet}
				{@const isCurrent = isCurrentControlSet(controlSet)}
				<div
					on:click={() => !isCurrent && selectControlSet(controlSet)}
					on:keydown={(e) => e.key === 'Enter' && !isCurrent && selectControlSet(controlSet)}
					role="button"
					tabindex="0"
					class="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border-2 transition-all duration-200 {isCurrent
						? 'border-green-500 !bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 cursor-not-allowed opacity-75'
						: selectedSet === controlSet
							? 'border-blue-500 !bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 shadow-lg cursor-pointer'
							: 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md cursor-pointer'}"
				>
					<div class="flex items-center justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-3">
								<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
									{controlSet.name}
								</h3>
								<span
									class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
								>
									{controlSet.controlCount || 0} controls
								</span>
							</div>

							{#if controlSet.description}
								<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
									{controlSet.description}
								</p>
							{/if}

							<div class="flex items-center gap-4 mt-2">
								<span class="text-xs text-gray-500 dark:text-gray-400">
									<svg class="inline w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm2-1a1 1 0 00-1 1v8a1 1 0 001 1h12a1 1 0 001-1V6a1 1 0 00-1-1H4z"
											clip-rule="evenodd"
										/>
									</svg>
									{controlSet.path || 'root'}
								</span>
								{#if controlSet.file}
									<span class="text-xs text-gray-500 dark:text-gray-400">
										<svg class="inline w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
												clip-rule="evenodd"
											/>
										</svg>
										{controlSet.file}
									</span>
								{/if}
							</div>
						</div>

						<div class="flex items-center ml-4">
							{#if isCurrent}
								<div class="flex flex-col items-center">
									<svg
										class="w-8 h-8 text-green-600"
										fill="currentColor"
										viewBox="0 0 20 20"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											fill-rule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
											clip-rule="evenodd"
										></path>
									</svg>
									<span class="text-xs text-green-600 font-medium mt-1">Current</span>
								</div>
							{:else if selectedSet === controlSet}
								<svg
									class="w-8 h-8 text-blue-600"
									fill="currentColor"
									viewBox="0 0 20 20"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
										clip-rule="evenodd"
									></path>
								</svg>
							{:else}
								<svg
									class="w-8 h-8 text-gray-300 dark:text-gray-600"
									fill="none"
									viewBox="0 0 20 20"
									xmlns="http://www.w3.org/2000/svg"
								>
									<circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2" />
								</svg>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>

		{#if selectedSet}
			<div class="mt-6 flex justify-center">
				<button
					on:click={useSelectedControlSet}
					class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-lg"
				>
					Use Selected Control Set
				</button>
			</div>
		{/if}
	{/if}
</div>
