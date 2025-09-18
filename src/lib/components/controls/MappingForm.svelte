<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import type { SourceEntry } from '$lib/types';
	import { Add, TrashCan } from 'carbon-icons-svelte';
	import FormField from '../forms/FormField.svelte';

	interface MappingFormData {
		justification: string;
		status: 'planned' | 'implemented' | 'verified';
		source_entries: SourceEntry[];
	}

	interface Props {
		initialData?: Partial<MappingFormData>;
		onSubmit: (data: MappingFormData) => void;
		onCancel: () => void;
		loading?: boolean;
		submitLabel?: string;
	}

	let {
		initialData = {},
		onSubmit,
		onCancel,
		loading = false,
		submitLabel = 'Create Mapping'
	}: Props = $props();

	let formData = $state<MappingFormData>({
		justification: initialData.justification || '',
		status: initialData.status || 'planned',
		source_entries: initialData.source_entries || []
	});
	
	let newLocation = $state('');
	let newShasum = $state('');

	const statusOptions = ['planned', 'implemented', 'verified'];

	const isValid = $derived(formData.justification.trim().length > 0);

	function handleSubmit() {
		if (!isValid || loading) return;
		onSubmit(formData);
	}

	function handleCancel() {
		// Reset form
		formData = {
			justification: initialData.justification || '',
			status: initialData.status || 'planned',
			source_entries: initialData.source_entries || []
		};
		newLocation = '';
		newShasum = '';
		onCancel();
	}
	
	function addSourceEntry() {
		if (newLocation.trim()) {
			const entry: SourceEntry = {
				location: newLocation.trim()
			};
			if (newShasum.trim()) {
				entry.shasum = newShasum.trim();
			}
			formData.source_entries = [...formData.source_entries, entry];
			newLocation = '';
			newShasum = '';
		}
	}
	
	function removeSourceEntry(index: number) {
		formData.source_entries = formData.source_entries.filter((_, i) => i !== index);
	}
</script>

<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6">
	<div class="space-y-8">
		<!-- Main form fields -->
		<div class="grid grid-cols-1 gap-8">
			<FormField
				id="mapping-justification"
				label="Justification"
				type="textarea"
				bind:value={formData.justification}
				rows={4}
				placeholder="Explain how this compliance artifact satisfies the control requirements..."
				required
			/>

			<FormField
				id="mapping-status"
				label="Implementation Status"
				type="select"
				bind:value={formData.status}
				options={statusOptions}
			/>
		</div>

		<!-- Source References -->
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<div class="text-sm font-medium text-gray-900 dark:text-white">Source References</div>
				<span class="text-xs text-gray-500 dark:text-gray-400">Optional</span>
			</div>
			
			<!-- Existing entries -->
			{#if formData.source_entries.length > 0}
				<div class="space-y-3">
					{#each formData.source_entries as entry, index (index)}
						<div class="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
							<div class="flex-1 min-w-0">
								<div class="text-sm font-mono text-gray-900 dark:text-white break-all">
									{entry.location}
								</div>
								{#if entry.shasum}
									<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
										SHA: {entry.shasum.substring(0, 8)}...
									</div>
								{/if}
							</div>
							<button
								type="button"
								onclick={() => removeSourceEntry(index)}
								class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
								title="Remove reference"
							>
								<TrashCan size={16} />
							</button>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Add new entry -->
			<div class="grid grid-cols-1 gap-4">
				<input
					type="text"
					bind:value={newLocation}
					placeholder="File path or URI (e.g., src/auth/handler.ts:42)"
					class="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
				/>
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
					<input
						type="text"
						bind:value={newShasum}
						placeholder="SHA checksum (optional)"
						class="px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
					/>
					<button
						type="button"
						onclick={addSourceEntry}
						disabled={!newLocation.trim()}
						class="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
					>
						<Add size={16} />
						Add Reference
					</button>
				</div>
			</div>
		</div>

		<!-- Action buttons -->
		<div class="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
			<button
				type="button"
				onclick={handleCancel}
				disabled={loading}
				class="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 transition-all duration-200"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={handleSubmit}
				disabled={!isValid || loading}
				class="px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 {isValid && !loading
					? 'text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
					: 'text-gray-400 bg-gray-200 dark:bg-gray-700 cursor-not-allowed'}"
			>
				{loading ? 'Saving...' : submitLabel}
			</button>
		</div>
	</div>
</div>
