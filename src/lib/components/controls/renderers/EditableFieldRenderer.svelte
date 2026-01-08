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
			{#each field.options as option (option)}
				<option value={option}>{option}</option>
			{/each}
		</select>
	{:else if field.ui_type === 'multiselect' && field.options}
			{@const currentValues = Array.isArray(value) ? (value as string[]) : []}

		<div id={fieldId} class="flex flex-wrap gap-2">
			{#each field.options as option (option)}
				{@const selected = currentValues.includes(option)}

				<label
					class={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors
						focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2
						dark:focus-within:ring-offset-gray-900
						${
							selected
								? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/40 dark:border-blue-400 dark:text-blue-100'
								: 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200'
						}
						${!field.editable ? 'opacity-50 cursor-not-allowed' : ''}
					`}
				>
					<input
						type="checkbox"
						value={option}
						checked={selected}
						disabled={!field.editable}
						onchange={(e: Event) => {
							const input = e.currentTarget as HTMLInputElement;
							const current = Array.isArray(value) ? (value as string[]) : [];
							let updated: string[];

							if (input.checked) {
								updated = current.includes(option) ? current : [...current, option];
							} else {
								updated = current.filter((v) => v !== option);
							}

							value = updated;
							onChange();
						}}
						class="sr-only"
					/>

					<span
						class={`inline-flex items-center justify-center w-4 h-4 rounded border text-[10px] font-bold
							${
								selected
									? 'border-blue-500 bg-blue-500 text-white'
									: 'border-gray-400 bg-transparent text-transparent'
							}
						`}
					>
						✓
					</span>

					<span>{option}</span>
				</label>
			{/each}
		</div>
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
