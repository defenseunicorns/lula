<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import {
		complianceStore,
		type FilterOperator,
		type FilterCondition,
		type FilterValue,
		activeFilters,
		FILTER_OPERATORS,
		getOperatorLabel,
		MAPPING_STATUS_OPTIONS
	} from '$stores/compliance';
	import { appState } from '$lib/websocket';
	import { Filter, Add, TrashCan, ChevronDown, ChevronUp } from 'carbon-icons-svelte';
	import { clickOutside } from '$lib/actions/clickOutside';
	import { slide, fade } from 'svelte/transition';
	import { derived } from 'svelte/store';
	import { twMerge } from 'tailwind-merge';
	import CustomDropdown from './CustomDropdown.svelte';

	// Local state
	let showFilterPanel = false;
	let showFieldDropdown = false;
	let newFilterField = '';
	let newFilterOperator: FilterOperator = 'equals';
	let newFilterValue = '';

	// Get field schema and families from app state
	const fieldSchema = derived(appState, ($state) => $state.fieldSchema?.fields || {});

	// Get available fields from the store
	$: availableFields = complianceStore.getAvailableFields();

	// Get the active filters from the store
	$: activeFiltersList = $activeFilters;

	// Get field type for the selected field
	$: selectedFieldSchema = $fieldSchema[newFilterField] || null;
	$: selectedFieldType =
		getMappingFieldType(newFilterField) || selectedFieldSchema?.type || 'string';
	$: selectedFieldUiType =
		getMappingFieldUiType(newFilterField) || selectedFieldSchema?.ui_type || 'short_text';
	$: isSelectField = selectedFieldUiType === 'select';
	$: fieldOptions =
		getMappingFieldOptions(newFilterField) ||
		(isSelectField ? selectedFieldSchema?.options || [] : []);

	// Force equals operator for select fields (but allow operators for mapping fields)
	// Also force equals operator for has_mappings field
	$: if (
		(isSelectField && !['has_mappings', 'mapping_status'].includes(newFilterField)) ||
		newFilterField === 'has_mappings' ||
		newFilterField === 'mapping_status'
	) {
		newFilterOperator = 'equals';
	}

	// Group fields by tab
	$: fieldsByTab = {
		overview: [] as string[],
		implementation: [] as string[],
		mappings: [] as string[],
		custom: [] as string[]
	};

	$: {
		// Reset arrays before populating
		fieldsByTab.overview = [];
		fieldsByTab.implementation = [];
		fieldsByTab.mappings = [];
		fieldsByTab.custom = [];

		// Group fields by tab
		availableFields.forEach((field) => {
			// Handle mapping-related fields specially
			if (field === 'has_mappings' || field === 'mapping_status') {
				fieldsByTab.mappings.push(field);
			} else {
				const schema = $fieldSchema[field];
				if (schema) {
					const tab = schema.tab || getDefaultTabForCategory(schema.category);
					if (tab === 'overview') fieldsByTab.overview.push(field);
					else if (tab === 'implementation') fieldsByTab.implementation.push(field);
					else fieldsByTab.custom.push(field);
				} else {
					// If no schema, default to custom
					fieldsByTab.custom.push(field);
				}
			}
		});
	}

	// Determine if value input should be shown based on operator
	$: showValueInput = newFilterOperator !== 'exists' && newFilterOperator !== 'not_exists';

	// Create a new array from the readonly constant to make it mutable for Svelte
	const operatorOptions = FILTER_OPERATORS.map((op) => ({ value: op.value, label: op.label }));

	// Add a new filter
	function addFilter() {
		if (!newFilterField) return;

		let value = newFilterValue;

		// Extract value from dropdown objects if necessary
		if (typeof value === 'object' && value !== null && 'value' in value) {
			value = (value as any).value;
		}

		// Convert value based on field type
		let processedValue: FilterValue = value;
		if (selectedFieldType === 'boolean' && typeof value === 'string') {
			processedValue = value.toLowerCase() === 'true';
		} else if (selectedFieldType === 'number' && typeof value === 'string') {
			const parsedValue = parseFloat(value);
			processedValue = isNaN(parsedValue) ? value : parsedValue; // Fallback to string if parsing fails
		}

		// Add the filter
		complianceStore.addFilter(newFilterField, newFilterOperator, processedValue);

		// Reset the form
		newFilterField = '';
		newFilterOperator = 'equals';
		newFilterValue = '';
		showFilterPanel = false;
	}

	// Toggle filter panel
	function toggleFilterPanel() {
		showFilterPanel = !showFilterPanel;
	}

	// Helper function to map category to tab (same logic as ControlDetailsPanel)
	function getDefaultTabForCategory(category: string): 'overview' | 'implementation' | 'custom' {
		switch (category) {
			case 'core':
			case 'metadata':
				return 'overview';
			case 'compliance':
			case 'content':
				return 'implementation';
			default:
				return 'custom';
		}
	}

	// Centralized mapping field metadata
	const mappingFieldConfig: Record<
		string,
		{
			type: string;
			ui_type: string;
			options?: Array<{ value: string; label: string }>;
		}
	> = {
		has_mappings: {
			type: 'boolean',
			ui_type: 'select',
			options: [
				{ value: 'true', label: 'Yes' },
				{ value: 'false', label: 'No' }
			]
		},
		mapping_status: {
			type: 'string',
			ui_type: 'short_text',
			options: MAPPING_STATUS_OPTIONS
		}
	};

	function getMappingFieldType(fieldName: string): string | null {
		return mappingFieldConfig[fieldName]?.type ?? null;
	}

	function getMappingFieldUiType(fieldName: string): string | null {
		return mappingFieldConfig[fieldName]?.ui_type ?? null;
	}

	function getMappingFieldOptions(
		fieldName: string
	): Array<{ value: string; label: string }> | null {
		return mappingFieldConfig[fieldName]?.options ?? null;
	}

	// Get display name for a field
	function getFieldDisplayName(fieldName: string): string {
		// Handle mapping fields specially
		switch (fieldName) {
			case 'has_mappings':
				return 'Has Mappings';
			case 'mapping_status':
				return 'Mapping Status';
		}

		const schema = $fieldSchema[fieldName];

		// Use schema names if available
		if (schema?.original_name || schema?.display_name) {
			return schema.original_name || schema.display_name;
		}

		// Otherwise use the field name with hyphens replaced by spaces and first letter capitalized
		let displayName = fieldName.replace(/-/g, ' ');
		return displayName.charAt(0).toUpperCase() + displayName.slice(1);
	}

	// Get display value for a filter
	function getFilterDisplayValue(filter: FilterCondition): string {
		// Special cases for exists/not_exists that don't need to show a value
		if (filter.operator === 'exists') return 'exists';
		if (filter.operator === 'not_exists') return 'does not exist';

		// Convert value to string, handling objects and arrays properly
		let displayValue = '';
		if (filter.value === null || filter.value === undefined) {
			displayValue = '';
		} else if (typeof filter.value === 'object') {
			// Handle objects by converting to JSON or getting a meaningful representation
			if (Array.isArray(filter.value)) {
				displayValue = filter.value.join(', ');
			} else if ('value' in filter.value) {
				// Handle dropdown option objects
				displayValue = String((filter.value as any).value);
			} else {
				displayValue = JSON.stringify(filter.value);
			}
		} else {
			displayValue = String(filter.value);
		}

		// Use the shared getOperatorLabel function
		const operatorText = getOperatorLabel(filter.operator).toLowerCase();
		return `${operatorText} "${displayValue}"`;
	}

	// Handle click outside to close the panel
	function handleClickOutside() {
		showFilterPanel = false;
	}
</script>

<div class="relative" use:clickOutside={handleClickOutside}>
	<!-- Filter Button -->
	<button
		onclick={toggleFilterPanel}
		class="flex items-center px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
		aria-expanded={showFilterPanel}
		aria-controls="filter-panel"
	>
		<Filter class="w-4 h-4 mr-2" />
		<span>Filters</span>
		{#if activeFiltersList.length > 0}
			<span
				class="ml-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 text-xs font-medium px-2 py-0.5 rounded-full"
			>
				{activeFiltersList.length}
			</span>
		{/if}
		<ChevronDown class="w-4 h-4 ml-2" />
	</button>

	<!-- Filter Panel -->
	{#if showFilterPanel}
		<div
			id="filter-panel"
			class="absolute z-10 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
			transition:slide={{ duration: 200 }}
		>
			<!-- Active Filters -->
			<div class="p-4 border-b border-gray-200 dark:border-gray-700">
				<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Active Filters</h3>

				{#if $activeFilters.length === 0}
					<p class="text-sm text-gray-500 dark:text-gray-400">No filters</p>
				{:else}
					<div class="space-y-2">
						{#each $activeFilters as filter, index (index)}
							<div
								class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded-md"
							>
								<div class="flex items-center">
									<span class="text-sm text-gray-700 dark:text-gray-300">
										<span class="font-medium">{getFieldDisplayName(filter.fieldName)}</span>
										<span class="mx-1 text-gray-500 dark:text-gray-400"
											>{getFilterDisplayValue(filter)}</span
										>
									</span>
								</div>
								<button
									onclick={() => complianceStore.removeFilter(index)}
									class="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
									aria-label="Remove filter"
								>
									<TrashCan class="w-4 h-4" />
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Add New Filter -->
			<div class="p-4">
				<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Add Filter</h3>

				<div class="space-y-3">
					<!-- Field Selection with Custom Dropdown -->
					<div>
						<label for="filter-field" class="block text-xs text-gray-600 dark:text-gray-400 mb-1"
							>Field</label
						>

						<!-- Custom Field Dropdown -->
						<div class="relative" use:clickOutside={() => (showFieldDropdown = false)}>
							<!-- Dropdown Trigger -->
							<button
								onclick={() => (showFieldDropdown = !showFieldDropdown)}
								class={twMerge(
									'w-full flex items-center justify-between px-3 py-2 text-sm rounded-md border transition-colors',
									showFieldDropdown
										? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900'
										: 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
									'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
								)}
							>
								<span class="truncate">
									{newFilterField ? getFieldDisplayName(newFilterField) : 'Select a field'}
								</span>
								{#if showFieldDropdown}
									<ChevronUp class="h-4 w-4 text-gray-500 dark:text-gray-400" />
								{:else}
									<ChevronDown class="h-4 w-4 text-gray-500 dark:text-gray-400" />
								{/if}
							</button>

							<!-- Dropdown Menu -->
							{#if showFieldDropdown}
								<div
									class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto"
									transition:fade={{ duration: 100 }}
								>
									<!-- Overview fields -->
									<div
										class="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/80"
									>
										Overview Fields
									</div>
									{#each fieldsByTab.overview as field (field)}
										<button
											class={twMerge(
												'w-full text-left px-3 py-2 text-sm',
												newFilterField === field
													? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
													: 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
											)}
											onclick={() => {
												newFilterField = field;
												showFieldDropdown = false;
											}}
										>
											{getFieldDisplayName(field)}
										</button>
									{/each}

									<!-- Implementation fields -->
									{#if fieldsByTab.implementation.length > 0}
										<!-- Divider -->
										<div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
										<div
											class="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/80"
										>
											Implementation Fields
										</div>
										{#each fieldsByTab.implementation as field (field)}
											<button
												class={twMerge(
													'w-full text-left px-3 py-2 text-sm',
													newFilterField === field
														? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
														: 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
												)}
												onclick={() => {
													newFilterField = field;
													showFieldDropdown = false;
												}}
											>
												{getFieldDisplayName(field)}
											</button>
										{/each}
									{/if}

									<!-- Mapping fields -->
									{#if fieldsByTab.mappings.length > 0}
										<!-- Divider -->
										<div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
										<div
											class="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/80"
										>
											Mapping Fields
										</div>
										{#each fieldsByTab.mappings as field (field)}
											<button
												class={twMerge(
													'w-full text-left px-3 py-2 text-sm',
													newFilterField === field
														? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
														: 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
												)}
												onclick={() => {
													newFilterField = field;
													showFieldDropdown = false;
												}}
											>
												{getFieldDisplayName(field)}
											</button>
										{/each}
									{/if}

									<!-- Custom fields -->
									{#if fieldsByTab.custom.length > 0}
										<!-- Divider -->
										<div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
										<div
											class="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/80"
										>
											Custom Fields
										</div>
										{#each fieldsByTab.custom as field (field)}
											<button
												class={twMerge(
													'w-full text-left px-3 py-2 text-sm',
													newFilterField === field
														? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
														: 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
												)}
												onclick={() => {
													newFilterField = field;
													showFieldDropdown = false;
												}}
											>
												{getFieldDisplayName(field)}
											</button>
										{/each}
									{/if}
								</div>
							{/if}
						</div>
					</div>

					<!-- Operator Selection -->
					<div>
						<label for="filter-operator" class="block text-xs text-gray-600 dark:text-gray-400 mb-1"
							>Operator</label
						>

						{#if (isSelectField && !['has_mappings', 'mapping_status'].includes(newFilterField)) || newFilterField === 'has_mappings' || newFilterField === 'mapping_status'}
							<!-- Disabled dropdown for select fields and has_mappings (always equals) -->
							<div
								class="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
							>
								Equals
							</div>
						{:else}
							<!-- Custom Operator Dropdown -->
							<CustomDropdown
								bind:value={newFilterOperator}
								options={operatorOptions}
								getDisplayValue={getOperatorLabel}
								labelId="filter-operator"
							/>
						{/if}
					</div>

					<!-- Value Input (conditional) -->
					{#if showValueInput}
						<div>
							<label for="filter-value" class="block text-xs text-gray-600 dark:text-gray-400 mb-1"
								>Value</label
							>
							{#if newFilterField === 'mapping_status'}
								<!-- Special dropdown for mapping status -->
								<select
									id="filter-value"
									bind:value={newFilterValue}
									class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
								>
									<option value="">Select status...</option>
									{#each MAPPING_STATUS_OPTIONS as status}
										<option value={status.value}>{status.label}</option>
									{/each}
								</select>
							{:else if newFilterField === 'has_mappings'}
								<!-- Special dropdown for has_mappings -->
								<select
									id="filter-value"
									bind:value={newFilterValue}
									class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
								>
									<option value="">Select...</option>
									<option value="true">Yes</option>
									<option value="false">No</option>
								</select>
							{:else if isSelectField}
								<!-- Custom dropdown for select fields -->
								<CustomDropdown
									bind:value={newFilterValue}
									options={fieldOptions.map((option: string) => ({ value: option, label: option }))}
									placeholder="Select a value"
									labelId="filter-value"
								/>
							{:else if selectedFieldType === 'boolean'}
								<!-- Boolean field with CustomDropdown -->
								<select
									id="filter-value"
									bind:value={newFilterValue}
									class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
								>
									<option value="">Select...</option>
									<option value="true">Yes</option>
									<option value="false">No</option>
								</select>
							{:else}
								<!-- Text input for other fields -->
								<input
									id="filter-value"
									type={selectedFieldType === 'number' ? 'number' : 'text'}
									bind:value={newFilterValue}
									placeholder="Enter value"
									class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
								/>
							{/if}
						</div>
					{/if}

					<!-- Add Button -->
					<button
						onclick={addFilter}
						disabled={!newFilterField}
						class="flex items-center px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<Add class="w-4 h-4 mr-2" />
						<span>Add Filter</span>
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
