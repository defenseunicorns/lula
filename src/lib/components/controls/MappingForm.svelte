<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import FormField from '../forms/FormField.svelte';

	interface MappingFormData {
		justification: string;
		status: 'planned' | 'implemented' | 'verified';
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
		status: initialData.status || 'planned'
	});

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
			status: initialData.status || 'planned'
		};
		onCancel();
	}
</script>

<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
	<h4 class="text-lg font-medium text-gray-900 dark:text-white">
		{initialData.justification ? 'Edit Mapping' : 'Create New Mapping'}
	</h4>

	<div class="space-y-4">
		<FormField
			id="mapping-status"
			label="Status"
			type="select"
			bind:value={formData.status}
			options={statusOptions}
		/>

		<FormField
			id="mapping-justification"
			label="Justification"
			type="textarea"
			bind:value={formData.justification}
			rows={4}
			placeholder="Explain why this mapping is necessary..."
			required
		/>
	</div>

	<div class="flex justify-end space-x-3">
		<button
			onclick={handleCancel}
			disabled={loading}
			class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
		>
			Cancel
		</button>
		<button
			onclick={handleSubmit}
			disabled={!isValid || loading}
			class="px-4 py-2 text-sm font-medium transition-colors rounded-md {isValid && !loading
				? 'text-white bg-blue-600 hover:bg-blue-700'
				: 'text-gray-400 bg-gray-200 dark:bg-gray-700 cursor-not-allowed'}"
		>
			{loading ? 'Saving...' : submitLabel}
		</button>
	</div>
</div>
