<script lang="ts">
	import type { Control } from '$lib/types.js';
	import type { ControlSchema, ValidationResult } from '$lib/adapters/types.js';
	import { mappings } from '../../stores/compliance';
	import DynamicControlForm from '../forms/DynamicControlForm.svelte';

	interface Props {
		control: Control;
		schema: ControlSchema;
		onClose: () => void;
		onSave: (control: Control) => void;
	}

	let { control, schema, onClose, onSave }: Props = $props();

	let editedControl = $state({ ...control });
	let activeTab = $state('details');
	let validationResult = $state<ValidationResult | null>(null);

	function handleSave() {
		// Validate before saving if we have validation results
		if (!validationResult?.valid) {
			// Show validation errors
			return;
		}
		onSave(editedControl);
	}

	function handleValidation(result: ValidationResult) {
		validationResult = result;
	}

	function parseCCIsFromNarrative(narrative: string): string[] {
		const cciPattern = /CCI-(\d{6})/g;
		const matches = narrative.match(cciPattern);
		return matches ? [...new Set(matches)] : [];
	}

	let ccisInNarrative = $derived(
		parseCCIsFromNarrative(editedControl['control-implementation-narrative'] || '')
	);
	let associatedMappings = $derived($mappings.filter((m) => m.control_id === control.id));

	// Group fields by section for tabbed interface
	const detailsFields = $derived(
		schema.fields.filter((f) => f.group === 'identification' || f.group === 'description')
	);

	const implementationFields = $derived(schema.fields.filter((f) => f.group === 'implementation'));

	const complianceFields = $derived(schema.fields.filter((f) => f.group === 'compliance'));

	// Count validation errors per tab
	const detailsErrors = $derived(
		validationResult?.errors.filter((e) => detailsFields.some((f) => f.id === e.field)).length || 0
	);

	const implementationErrors = $derived(
		validationResult?.errors.filter((e) => implementationFields.some((f) => f.id === e.field))
			.length || 0
	);

	const complianceErrors = $derived(
		validationResult?.errors.filter((e) => complianceFields.some((f) => f.id === e.field)).length ||
			0
	);
</script>

<!-- Modal Backdrop -->
<div
	class="fixed inset-0 bg-gray-700 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-75 overflow-y-auto h-full w-full z-50"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<!-- Modal -->
	<div
		class="relative min-h-screen w-full p-6 bg-white dark:bg-gray-900"
		role="document"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		<!-- Header  -->
		<div
			class="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700"
		>
			<div>
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
					Edit Control: {control['control-acronym']}
				</h3>
				{#if !validationResult?.valid && validationResult?.errors.length}
					<p class="text-sm text-red-600 dark:text-red-400 mt-1">
						{validationResult.errors.length} validation error{validationResult.errors.length === 1
							? ''
							: 's'} found
					</p>
				{/if}
			</div>
			<button
				onclick={onClose}
				class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
				aria-label="Close modal"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					></path>
				</svg>
			</button>
		</div>

		<!-- Tabs -->
		<div class="mt-4">
			<nav class="flex space-x-8">
				<button
					onclick={() => (activeTab = 'details')}
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'details'
						? 'border-blue-500 text-blue-600 dark:text-blue-400'
						: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
				>
					Details
					{#if detailsErrors > 0}
						<span class="ml-1 bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
							{detailsErrors}
						</span>
					{/if}
				</button>
				<button
					onclick={() => (activeTab = 'implementation')}
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'implementation'
						? 'border-blue-500 text-blue-600 dark:text-blue-400'
						: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
				>
					Implementation
					{#if implementationErrors > 0}
						<span class="ml-1 bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
							{implementationErrors}
						</span>
					{/if}
				</button>
				<button
					onclick={() => (activeTab = 'compliance')}
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'compliance'
						? 'border-blue-500 text-blue-600 dark:text-blue-400'
						: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
				>
					Compliance
					{#if complianceErrors > 0}
						<span class="ml-1 bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
							{complianceErrors}
						</span>
					{/if}
				</button>
				<button
					onclick={() => (activeTab = 'mappings')}
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'mappings'
						? 'border-blue-500 text-blue-600 dark:text-blue-400'
						: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
				>
					Mappings ({associatedMappings.length})
				</button>
			</nav>
		</div>

		<!-- Tab Content -->
		<div class="mt-6 max-h-screen-3/4 overflow-y-auto">
			{#if activeTab === 'details'}
				<DynamicControlForm
					bind:control={editedControl}
					schema={{
						...schema,
						fields: detailsFields
					}}
					onValidation={handleValidation}
				/>
			{:else if activeTab === 'implementation'}
				<DynamicControlForm
					bind:control={editedControl}
					schema={{
						...schema,
						fields: implementationFields
					}}
					onValidation={handleValidation}
				/>

				{#if ccisInNarrative.length > 0}
					<div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
						<div class="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
							CCIs Found in Narrative
						</div>
						<div class="flex flex-wrap gap-2">
							{#each ccisInNarrative as cci}
								<span
									class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200"
								>
									{cci}
								</span>
							{/each}
						</div>
					</div>
				{/if}
			{:else if activeTab === 'compliance'}
				<DynamicControlForm
					bind:control={editedControl}
					schema={{
						...schema,
						fields: complianceFields
					}}
					onValidation={handleValidation}
				/>
			{:else if activeTab === 'mappings'}
				<div class="space-y-4">
					{#if associatedMappings.length > 0}
						{#each associatedMappings as mapping}
							<div
								class="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
							>
								<div class="flex justify-between items-start mb-2">
									<span class="text-sm font-medium text-gray-900 dark:text-white"
										>@mapControl {mapping.uuid}</span
									>
									<button
										onclick={() => navigator.clipboard.writeText(`@mapControl ${mapping.uuid}`)}
										class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
									>
										Copy UUID
									</button>
								</div>
								<p class="text-sm text-gray-700 dark:text-gray-300 mb-2">{mapping.justification}</p>
								<div
									class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
								>
									<span>Status: {mapping.status}</span>
									<span>By: {mapping.created_by}</span>
								</div>
							</div>
						{/each}
					{:else}
						<div class="text-center py-8">
							<svg
								class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No mappings</h3>
							<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
								This control has no associated mappings yet.
							</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div
			class="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700 mt-6"
		>
			<!-- Schema Info -->
			<div class="text-xs text-gray-500 dark:text-gray-400">
				Schema: {schema.name} v{schema.version}
				<span class="ml-2 text-green-600 dark:text-green-400">Dynamic Forms</span>
			</div>

			<!-- Action Buttons -->
			<div class="flex space-x-3">
				<button
					onclick={onClose}
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
				>
					Cancel
				</button>
				<button
					onclick={handleSave}
					disabled={!validationResult?.valid}
					class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
				>
					Save Changes
					{#if !validationResult?.valid && validationResult?.errors.length}
						<span class="ml-1">({validationResult.errors.length} errors)</span>
					{/if}
				</button>
			</div>
		</div>
	</div>
</div>
