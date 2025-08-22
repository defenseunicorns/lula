<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	interface Props {
		id: string;
		label: string;
		type?: 'text' | 'textarea' | 'select';
		value: string;
		options?: string[];
		rows?: number;
		placeholder?: string;
		required?: boolean;
		error?: string;
		onChange?: () => void;
	}

	let {
		id,
		label,
		type = 'text',
		value = $bindable(),
		options = [],
		rows = 4,
		placeholder,
		required = false,
		error,
		onChange
	}: Props = $props();

	const baseInputClass =
		'w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';
	const errorClass = error ? 'border-red-400 focus:ring-red-500 focus:border-red-500' : '';
	const successClass = !error && value ? 'border-green-400 dark:border-green-600' : '';
</script>

<div class="space-y-2">
	<label for={id} class="block text-sm font-medium text-gray-700 dark:text-gray-300">
		{label}{#if required}<span class="text-red-500 ml-1">*</span>{/if}
	</label>

	{#if type === 'textarea'}
		<div class="relative">
			<textarea
				{id}
				bind:value
				{rows}
				{placeholder}
				class="{baseInputClass} {errorClass} {successClass} resize-vertical min-h-[100px]"
				onchange={onChange}
			></textarea>
			{#if value}
				<div class="absolute bottom-3 right-3 text-xs text-gray-400">
					{value.length} characters
				</div>
			{/if}
		</div>
	{:else if type === 'select' && options.length > 0}
		<div class="relative">
			<select
				{id}
				bind:value
				class="{baseInputClass} {errorClass} {successClass} cursor-pointer"
				onchange={onChange}
			>
				{#each options as option}
					<option value={option}>{option}</option>
				{/each}
			</select>
			<div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
				<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8 9l4-4 4 4m0 6l-4 4-4-4"
					></path>
				</svg>
			</div>
		</div>
	{:else}
		<input
			{id}
			bind:value
			type="text"
			{placeholder}
			class="{baseInputClass} {errorClass} {successClass}"
			onchange={onChange}
		/>
	{/if}

	{#if error}
		<div class="flex items-center space-x-1">
			<svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				></path>
			</svg>
			<p class="text-sm text-red-600 dark:text-red-400">
				{error}
			</p>
		</div>
	{/if}
</div>
