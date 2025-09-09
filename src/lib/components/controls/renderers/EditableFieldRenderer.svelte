<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import type { FieldSchema } from '$lib/types';

	interface Props {
		fieldName: string;
		field: FieldSchema;
		value: any;
		onChange: () => void;
	}

	let { fieldName, field, value = $bindable(), onChange }: Props = $props();

	const displayName = $derived(
		field.original_name || fieldName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
	);

	// Generate unique ID for form control
	const fieldId = $derived(`field-${fieldName}-${Math.random().toString(36).substr(2, 9)}`);
</script>

<div class="space-y-2">
	<label for={fieldId} class="text-sm font-medium text-gray-700 dark:text-gray-300">
		{displayName}
		{#if field.required}
			<span class="text-red-500">*</span>
		{/if}
	</label>

	{#if field.ui_type === 'select' && field.options}
		<select
			id={fieldId}
			bind:value
			disabled={!field.editable}
			onchange={onChange}
			class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400"
		>
			<option value="">-- Select --</option>
			{#each field.options as option}
				<option value={option}>{option}</option>
			{/each}
		</select>
	{:else if field.ui_type === 'textarea' || field.ui_type === 'long_text'}
		<textarea
			id={fieldId}
			bind:value
			disabled={!field.editable}
			oninput={onChange}
			rows="8"
			class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed resize-y min-h-[120px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400"
			placeholder={field.examples?.[0] || ''}
		></textarea>
	{:else if field.ui_type === 'boolean'}
		<div class="flex items-center">
			<input
				id={fieldId}
				type="checkbox"
				bind:checked={value}
				disabled={!field.editable}
				onchange={onChange}
				class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
			/>
			<label class="ml-2 text-sm text-gray-900 dark:text-gray-300" for={fieldId}>
				{value ? 'Yes' : 'No'}
			</label>
		</div>
	{:else if field.ui_type === 'date'}
		<input
			id={fieldId}
			type="date"
			bind:value
			disabled={!field.editable}
			onchange={onChange}
			class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400"
		/>
	{:else if field.ui_type === 'number'}
		<input
			id={fieldId}
			type="number"
			bind:value
			disabled={!field.editable}
			oninput={onChange}
			class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400"
		/>
	{:else}
		<!-- Default to text input -->
		<input
			id={fieldId}
			type="text"
			bind:value
			disabled={!field.editable}
			oninput={onChange}
			class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400"
			placeholder={field.examples?.[0] || ''}
		/>
	{/if}

	{#if field.is_array}
		<p class="text-xs text-gray-500 dark:text-gray-400">This field supports multiple values</p>
	{/if}
</div>
