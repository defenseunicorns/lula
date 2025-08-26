<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import type { FieldDefinition } from '$lib/form-types';

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

	// Array handling functions
	function ensureArray() {
		if (!Array.isArray(value)) {
			value = [];
		}
		return value;
	}

	function addStringItem() {
		const arr = ensureArray();
		arr.push('');
		value = [...arr];
		handleChange();
	}

	function removeStringItem(index: number) {
		const arr = ensureArray();
		arr.splice(index, 1);
		value = [...arr];
		handleChange();
	}

	function updateStringItem(index: number, newValue: string) {
		const arr = ensureArray();
		arr[index] = newValue;
		value = [...arr];
		handleChange();
	}

	function addObjectItem() {
		const arr = ensureArray();
		const newItem: any = {};

		// Initialize with default values based on schema
		if (field.arraySchema) {
			Object.entries(field.arraySchema).forEach(([key, schema]: [string, any]) => {
				if (schema.type === 'string-array') {
					newItem[key] = [];
				} else {
					newItem[key] = '';
				}
			});
		}

		arr.push(newItem);
		value = [...arr];
		handleChange();
	}

	function removeObjectItem(index: number) {
		const arr = ensureArray();
		arr.splice(index, 1);
		value = [...arr];
		handleChange();
	}

	function updateObjectItem(index: number, key: string, newValue: any) {
		const arr = ensureArray();
		if (!arr[index]) arr[index] = {};
		arr[index][key] = newValue;
		value = [...arr];
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
	{:else if field.type === 'string-array'}
		<div class="space-y-3">
			{#if ensureArray().length === 0 && !readonly}
				<!-- Empty state with Flowbite styling -->
				<div
					class="flex flex-col items-center justify-center py-8 px-4 bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg"
				>
					<svg
						class="w-8 h-8 text-gray-400 dark:text-gray-500 mb-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
						></path>
					</svg>
					<p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
						No {field.label.toLowerCase()} added yet
					</p>
					<button
						type="button"
						onclick={addStringItem}
						class="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:text-blue-700 focus:z-10 focus:ring-2 focus:ring-blue-300 dark:bg-blue-900 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-800 dark:hover:text-blue-300"
					>
						<svg class="w-4 h-4 me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 6v6m0 0v6m0-6h6m-6 0H6"
							/>
						</svg>
						Add {field.label.replace(/s$/, '')}
					</button>
				</div>
			{:else}
				{#each ensureArray() as item, index}
					<div
						class="group relative p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow"
					>
						<!-- Item header with drag handle and remove button -->
						<div class="flex items-center justify-between mb-3">
							<div class="flex items-center space-x-3">
								<!-- Drag handle -->
								<div class="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
										></path>
									</svg>
								</div>
								<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
									{field.label.replace(/s$/, '')}
									{index + 1}
								</span>
							</div>
							{#if !readonly}
								<button
									type="button"
									onclick={() => removeStringItem(index)}
									class="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
									title="Remove item"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										></path>
									</svg>
								</button>
							{/if}
						</div>

						<!-- Input field - use textarea for longer fields like objectives -->
						{#if field.id === 'objectives' || field.id === 'guidance' || field.id === 'references' || (field.placeholder && field.placeholder.length > 50)}
							<textarea
								value={item}
								placeholder={field.placeholder ||
									`Enter ${field.label.replace(/s$/, '').toLowerCase()}`}
								rows="3"
								class="{baseInputClass} {readonlyClass} {errorClass} resize-none"
								{readonly}
								onchange={(e) => updateStringItem(index, e.currentTarget.value)}
							></textarea>
						{:else}
							<input
								type="text"
								value={item}
								placeholder={field.placeholder ||
									`Enter ${field.label.replace(/s$/, '').toLowerCase()}`}
								class="{baseInputClass} {readonlyClass} {errorClass}"
								{readonly}
								onchange={(e) => updateStringItem(index, e.currentTarget.value)}
							/>
						{/if}
					</div>
				{/each}

				{#if !readonly}
					<!-- Add button -->
					<button
						type="button"
						onclick={addStringItem}
						class="w-full flex items-center justify-center px-4 py-3 text-sm font-medium text-blue-600 bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-100 hover:border-blue-400 focus:z-10 focus:ring-2 focus:ring-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-600 dark:hover:bg-blue-900/50 dark:hover:border-blue-500 transition-all"
					>
						<svg class="w-5 h-5 me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 6v6m0 0v6m0-6h6m-6 0H6"
							/>
						</svg>
						Add {field.label.replace(/s$/, '')}
					</button>
				{/if}
			{/if}
		</div>
	{:else if field.type === 'object-array'}
		<div class="space-y-4">
			{#if ensureArray().length === 0 && !readonly}
				<!-- Empty state for object arrays -->
				<div
					class="flex flex-col items-center justify-center py-10 px-4 bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg"
				>
					<svg
						class="w-10 h-10 text-gray-400 dark:text-gray-500 mb-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
						></path>
					</svg>
					<p class="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
						No {field.label.toLowerCase()} created yet
					</p>
					<button
						type="button"
						onclick={addObjectItem}
						class="inline-flex items-center px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 transition-colors"
					>
						<svg class="w-4 h-4 me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 6v6m0 0v6m0-6h6m-6 0H6"
							/>
						</svg>
						Create {field.label.replace(/s$/, '')}
					</button>
				</div>
			{:else}
				{#each ensureArray() as item, index}
					<div
						class="group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
					>
						<!-- Card header -->
						<div
							class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-t-xl"
						>
							<div class="flex items-center space-x-3">
								<!-- Drag handle -->
								<div class="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
										></path>
									</svg>
								</div>
								<div class="flex items-center space-x-2">
									<div
										class="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center"
									>
										<span class="text-sm font-semibold text-blue-600 dark:text-blue-400"
											>{index + 1}</span
										>
									</div>
									<h4 class="text-sm font-semibold text-gray-900 dark:text-white">
										{field.label.replace(/s$/, '')}
										{index + 1}
									</h4>
								</div>
							</div>
							{#if !readonly}
								<div class="flex items-center space-x-2">
									<button
										type="button"
										onclick={() => removeObjectItem(index)}
										class="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
										aria-label="Remove {field.label.replace(/s$/, '')} {index + 1}"
										title="Remove item"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											></path>
										</svg>
									</button>
								</div>
							{/if}
						</div>

						<!-- Card content -->
						<div class="p-4">
							{#if field.arraySchema}
								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
									{#each Object.entries(field.arraySchema) as [key, schemaObj]}
										{@const schema = schemaObj as any}
										<div class="space-y-2">
											<label
												for="{field.id}-{index}-{key}"
												class="block text-sm font-medium text-gray-700 dark:text-gray-300"
											>
												{schema.label || key.charAt(0).toUpperCase() + key.slice(1)}
												{#if schema.required}<span class="text-red-500 ml-1">*</span>{/if}
											</label>
											{#if schema.type === 'textarea'}
												<textarea
													id="{field.id}-{index}-{key}"
													value={item[key] || ''}
													placeholder={schema.placeholder || `Enter ${schema.label || key}`}
													rows={schema.rows || 3}
													class="{baseInputClass} {readonlyClass} text-sm resize-none"
													{readonly}
													onchange={(e) => updateObjectItem(index, key, e.currentTarget.value)}
												></textarea>
											{:else}
												<input
													id="{field.id}-{index}-{key}"
													type="text"
													value={item[key] || ''}
													placeholder={schema.placeholder || `Enter ${schema.label || key}`}
													class="{baseInputClass} {readonlyClass} text-sm"
													{readonly}
													onchange={(e) => updateObjectItem(index, key, e.currentTarget.value)}
												/>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/each}

				{#if !readonly}
					<!-- Enhanced add button -->
					<button
						type="button"
						onclick={addObjectItem}
						class="group w-full flex items-center justify-center px-4 py-4 text-sm font-medium text-blue-600 bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl hover:bg-blue-100 hover:border-blue-400 focus:z-10 focus:ring-2 focus:ring-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-600 dark:hover:bg-blue-900/50 dark:hover:border-blue-500 transition-all duration-200"
					>
						<div class="flex items-center space-x-3">
							<div
								class="p-2 bg-blue-100 dark:bg-blue-800 rounded-full group-hover:bg-blue-200 dark:group-hover:bg-blue-700 transition-colors"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 6v6m0 0v6m0-6h6m-6 0H6"
									/>
								</svg>
							</div>
							<span>Add {field.label.replace(/s$/, '')}</span>
						</div>
					</button>
				{/if}
			{/if}
		</div>
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
