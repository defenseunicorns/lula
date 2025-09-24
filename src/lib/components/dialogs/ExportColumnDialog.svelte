<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Close } from 'carbon-icons-svelte';

	interface ColumnHeader {
		value: string;
		label: string;
	}

	interface ExportColumnDialogProps {
		isOpen: boolean;
		format: 'csv' | 'excel';
		columnHeaders: ColumnHeader[];
		defaultColumn: string;
	}

	let {
		isOpen = $bindable(),
		format,
		columnHeaders = [],
		defaultColumn = 'Mappings'
	}: ExportColumnDialogProps = $props();

	const dispatch = createEventDispatcher<{
		export: { format: string; mappingsColumn: string };
		cancel: void;
	}>();

	let selectedColumn = $state(defaultColumn);

	// Reset selected column when dialog opens
	$effect(() => {
		if (isOpen) {
			selectedColumn = defaultColumn;
		}
	});

	function handleExport() {
		dispatch('export', { format, mappingsColumn: selectedColumn });
		isOpen = false;
	}

	function handleCancel() {
		dispatch('cancel');
		isOpen = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleCancel();
		} else if (event.key === 'Enter') {
			handleExport();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleCancel();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Modal Backdrop -->
	<div
		class="fixed inset-0 bg-gray-700 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={handleBackdropClick}
		onkeydown={(e) => e.key === 'Escape' && handleCancel()}
	>
		<!-- Modal Content -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->

		<div
			class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-auto"
			role="document"
			onclick={(e) => e.stopPropagation()}
			tabindex="0"
			autofocus
		>
			<!-- Header -->
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-white">
					Export as {format.toUpperCase()}
				</h2>
				<button
					onclick={handleCancel}
					class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
					aria-label="Close dialog"
				>
					<Close class="w-6 h-6" />
				</button>
			</div>

			<!-- Content -->
			<div class="mb-6">
				<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
					Choose which column should contain the mappings data:
				</p>

				<div class="space-y-2">
					<label
						for="column-select"
						class="block text-sm font-medium text-gray-700 dark:text-gray-300"
					>
						Mappings Column
					</label>
					<select
						id="column-select"
						bind:value={selectedColumn}
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					>
						{#each columnHeaders as header}
							<option value={header.value}>{header.label}</option>
						{/each}
					</select>
				</div>

				<div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
					<p class="text-xs text-blue-600 dark:text-blue-400">
						<strong>Note:</strong> Mappings data will be formatted as "status: description..." in the
						selected column.
					</p>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex justify-end space-x-3">
				<button
					onclick={handleCancel}
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleExport}
					class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg transition-colors"
				>
					Export {format.toUpperCase()}
				</button>
			</div>
		</div>
	</div>
{/if}
