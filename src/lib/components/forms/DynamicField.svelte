<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import type { FieldDefinition } from '$lib/form-types.js';

	interface Props {
		field: FieldDefinition;
		value: any;
		readonly?: boolean;
		error?: string;
		onChange?: () => void;
	}

	let { field, value = $bindable(), readonly = false, error, onChange }: Props = $props();

	const baseInputClass =
		'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500';
	const readonlyClass = readonly ? 'bg-gray-50 dark:bg-gray-900 cursor-not-allowed' : '';
	const errorClass = error ? 'border-red-500 focus:ring-red-500' : '';

	function handleChange() {
		onChange?.();
	}

	// Convert value to appropriate type for boolean fields
	let booleanValue = $derived.by(() => {
		if (field.type === 'boolean') {
			if (typeof value === 'boolean') return value;
			if (typeof value === 'string') {
				return value.toLowerCase() === 'true' || value === '1' || value === 'yes';
			}
			return Boolean(value);
		}
		return value;
	});

	function handleBooleanChange(newValue: boolean) {
		value = newValue;
		handleChange();
	}
</script>

<div class="space-y-1">
	<label for={field.id} class="block text-sm font-medium text-gray-700 dark:text-gray-300">
		{field.label}
		{#if field.required}
			<span class="text-red-500 ml-1">*</span>
		{/if}
	</label>

	{#if field.description}
		<p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
			{field.description}
		</p>
	{/if}

	{#if field.type === 'textarea'}
		<textarea
			id={field.id}
			bind:value
			rows={field.rows || 4}
			placeholder={field.placeholder}
			class="{baseInputClass} {readonlyClass} {errorClass} resize-vertical"
			{readonly}
			onchange={handleChange}
		></textarea>
	{:else if field.type === 'select' && field.options?.length}
		<select
			id={field.id}
			bind:value
			class="{baseInputClass} {readonlyClass} {errorClass}"
			disabled={readonly}
			onchange={handleChange}
		>
			{#if !field.required}
				<option value="">-- Select an option --</option>
			{/if}
			{#each field.options as option}
				<option value={option}>{option}</option>
			{/each}
		</select>
	{:else if field.type === 'boolean'}
		<div class="flex items-center space-x-3">
			<label class="flex items-center">
				<input
					id="{field.id}-true"
					type="radio"
					name={field.id}
					checked={booleanValue === true}
					disabled={readonly}
					onchange={() => handleBooleanChange(true)}
					class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
				/>
				<span class="ml-2 text-sm text-gray-900 dark:text-white">Yes</span>
			</label>
			<label class="flex items-center">
				<input
					id="{field.id}-false"
					type="radio"
					name={field.id}
					checked={booleanValue === false}
					disabled={readonly}
					onchange={() => handleBooleanChange(false)}
					class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
				/>
				<span class="ml-2 text-sm text-gray-900 dark:text-white">No</span>
			</label>
		</div>
	{:else if field.type === 'date'}
		<input
			id={field.id}
			bind:value
			type="date"
			placeholder={field.placeholder}
			class="{baseInputClass} {readonlyClass} {errorClass}"
			{readonly}
			onchange={handleChange}
		/>
	{:else}
		<input
			id={field.id}
			bind:value
			type="text"
			placeholder={field.placeholder}
			class="{baseInputClass} {readonlyClass} {errorClass}"
			{readonly}
			onchange={handleChange}
		/>
	{/if}

	{#if error}
		<p class="text-sm text-red-600 dark:text-red-400">
			{error}
		</p>
	{/if}
</div>
