<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import type { Control, Mapping } from '$lib/types';
	import { wsClient } from '$lib/websocket';
	import { Add, Document } from 'carbon-icons-svelte';
	import MappingCard from '../MappingCard.svelte';
	import MappingForm from '../MappingForm.svelte';

	interface Props {
		control: Control;
		mappings: Mapping[];
	}

	let { control, mappings }: Props = $props();

	// Component state
	let showNewMappingForm = $state(false);
	let editingMapping = $state<Mapping | null>(null);

	// Form state
	let newMappingData = $state({
		uuid: '',
		justification: '',
		status: 'planned' as 'planned' | 'implemented' | 'verified',
		source_entries: [] as { location: string; shasum?: string }[]
	});

	// Event handlers
	async function handleCreateMapping(data: typeof newMappingData) {
		try {
			const mappingData = {
				control_id: control.id,
				justification: data.justification,
				status: data.status,
				source_entries: data.source_entries,
				uuid: data.uuid || '', // Use the UUID from form or empty for auto-generation,
			    hash: ''
			};
			const hash = await fetch('/hash', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(mappingData)
			});
			mappingData.hash = (await hash.json()).hash;

			await wsClient.createMapping(mappingData);
			resetMappingForm();
		} catch (error) {
			console.error('Failed to create mapping:', error);
		}
	}

	function cancelNewMapping() {
		resetMappingForm();
	}

	function resetMappingForm() {
		newMappingData = {
			uuid: '',
			justification: '',
			status: 'planned',
			source_entries: []
		};
		showNewMappingForm = false;
		editingMapping = null;
	}

	function startEditMapping(mapping: Mapping) {
		editingMapping = { ...mapping };
		showNewMappingForm = true;
		newMappingData = {
			uuid: mapping.uuid,
			justification: mapping.justification,
			status: mapping.status,
			source_entries: mapping.source_entries || []
		};
	}

	async function handleUpdateMapping(data: typeof newMappingData) {
		if (!editingMapping) return;

		try {
			const updatedMapping = {
				...editingMapping,
				uuid: data.uuid || editingMapping.uuid, // Use form UUID or fallback to original
				justification: data.justification,
				status: data.status,
				source_entries: data.source_entries,
			};

			// hashes change every time so we just delete an create
			await wsClient.deleteMapping(editingMapping.hash!);
			delete updatedMapping.hash;
			await wsClient.createMapping(updatedMapping);

			resetMappingForm();
		} catch (error) {
			console.error('Failed to update mapping:', error);
		}
	}

	async function handleDeleteMapping(hash: string) {
		// Find the mapping by hash to get the UUID for backend deletion
		const mappingToDelete = mappings.find(m => (m.hash === hash));
		if (!mappingToDelete) {
			console.error('Mapping not found for deletion');
			return;
		}

		try {
			// Backend expects UUID for file operations
			await wsClient.deleteMapping(mappingToDelete.hash!);
		} catch (error) {
			console.error('Failed to delete mapping:', error);
		}
	}
</script>

<div class="space-y-6">
	<!-- Existing Mappings -->
	{#if mappings.length > 0}
		<div class="space-y-4">
			{#each mappings as mapping (mapping.hash)}
				{#if editingMapping && editingMapping.hash === mapping.hash}
					<!-- Edit Form in place of the mapping being edited -->
					<div
						class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
					>
						<MappingForm
							initialData={newMappingData}
							onSubmit={handleUpdateMapping}
							onCancel={cancelNewMapping}
							submitLabel="Update Mapping"
						/>
					</div>
				{:else}
					<MappingCard
						{mapping}
						showActions={true}
						onEdit={startEditMapping}
						onDelete={handleDeleteMapping}
					/>
				{/if}
			{/each}
		</div>
		
		<!-- Add New Mapping Button or Form -->
		{#if showNewMappingForm && !editingMapping}
			<!-- New Mapping Form appears after the button -->
			<div
				class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
			>
				<MappingForm
					initialData={newMappingData}
					onSubmit={handleCreateMapping}
					onCancel={cancelNewMapping}
					submitLabel="Create Mapping"
				/>
			</div>
		{:else if !editingMapping}
			<button
				onclick={() => (showNewMappingForm = true)}
				class="w-full p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
			>
				<div class="flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
					<Add class="w-5 h-5 mr-2" />
					<span class="text-sm font-medium">Add New Mapping</span>
				</div>
			</button>
		{/if}
	{:else}
		{#if showNewMappingForm}
			<!-- New Mapping Form for empty state -->
			<div
				class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
			>
				<MappingForm
					initialData={newMappingData}
					onSubmit={handleCreateMapping}
					onCancel={cancelNewMapping}
					submitLabel="Create Mapping"
				/>
			</div>
		{:else}
			<!-- Empty State with integrated Add Button -->
			<div class="text-center py-12">
				<div class="mx-auto w-16 h-16 mb-4 text-gray-400 dark:text-gray-500">
					<Document class="w-full h-full" />
				</div>
				<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No mappings yet</h3>
				<p class="text-gray-500 dark:text-gray-400 mb-6">Create your first mapping for this control.</p>
				
				<button
					onclick={() => (showNewMappingForm = true)}
					class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				>
					<Add class="w-4 h-4 mr-2" />
					Add New Mapping
				</button>
			</div>
		{/if}
	{/if}
</div>
