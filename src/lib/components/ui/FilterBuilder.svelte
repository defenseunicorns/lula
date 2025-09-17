<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import {
		complianceStore,
		type FilterOperator,
		type FilterCondition,
		activeFilters,
		families
	} from '$stores/compliance';
	import { appState } from '$lib/websocket';
	import { Filter, Add, TrashCan, ChevronDown, ChevronUp } from 'carbon-icons-svelte';
	import { clickOutside } from '$lib/actions/clickOutside';
	import { slide, fade } from 'svelte/transition';
	import { derived } from 'svelte/store';
	import { twMerge } from 'tailwind-merge';

	// Local state
	let showFilterPanel = false;
	let showFieldDropdown = false;
	let showOperatorDropdown = false;
	let showValueDropdown = false;
	let newFilterField = '';
	let newFilterOperator: FilterOperator = 'equals';
	let newFilterValue = '';

	// Get field schema and families from app state
	const fieldSchema = derived(appState, ($state) => $state.fieldSchema?.fields || {});
	const availableFamilies = derived(appState, ($state) => $state.families || []);

	// Get available fields from the store
	$: availableFields = complianceStore.getAvailableFields();

	// Use the activeFilters store directly
	$: activeFiltersList = $activeFilters;

	// Get field type for the selected field
	$: selectedFieldSchema = $fieldSchema[newFilterField] || null;
	$: selectedFieldType = selectedFieldSchema?.type || 'string';
	$: selectedFieldUiType = selectedFieldSchema?.ui_type || 'short_text';
	$: isSelectField = selectedFieldUiType === 'select';
	$: fieldOptions = isSelectField ? selectedFieldSchema?.options || [] : [];
	
	// Group fields by tab
	$: fieldsByTab = {
		overview: [] as string[],
		implementation: [] as string[],
		custom: [] as string[]
	};
	
	$: {
		// Reset arrays before populating
		fieldsByTab.overview = [];
		fieldsByTab.implementation = [];
		fieldsByTab.custom = [];
		
		// Filter out special fields (family and mapping fields)
		const regularFields = availableFields.filter(f => f !== 'family' && !f.startsWith('mapping.'));
		
		// Group fields by tab
		regularFields.forEach(field => {
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
		});
	}

	// Special handling for family field
	$: isFamilyField = newFilterField === 'family';
	$: if (isFamilyField) {
		// Force equals operator for family field
		newFilterOperator = 'equals';
	}

	// Determine if value input should be shown based on operator
	$: showValueInput = newFilterOperator !== 'exists' && newFilterOperator !== 'not_exists';

	// Operator options
	const operatorOptions = [
		{ value: 'equals', label: 'Equals' },
		{ value: 'not_equals', label: 'Not equals' },
		{ value: 'includes', label: 'Contains' },
		{ value: 'not_includes', label: 'Does not contain' },
		{ value: 'exists', label: 'Exists' },
		{ value: 'not_exists', label: 'Not exists' }
	];

	// Add a new filter
	function addFilter() {
		if (!newFilterField) return;

		let value = newFilterValue;

		// Convert value based on field type
		let processedValue: any = value;
		if (selectedFieldType === 'number' && !isNaN(Number(value))) {
			processedValue = Number(value);
		} else if (selectedFieldType === 'boolean') {
			processedValue = value === 'true';
		}

		value = processedValue;

		complianceStore.addFilter(
			newFilterField,
			newFilterOperator,
			showValueInput ? value : undefined
		);

		// Reset form
		newFilterValue = '';
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

	// Get display name for a field
	function getFieldDisplayName(fieldName: string): string {
		const schema = $fieldSchema[fieldName];
		return schema?.original_name || schema?.display_name || fieldName.replace(/-/g, ' ');
	}

	// Get display value for a filter
	function getFilterDisplayValue(filter: FilterCondition): string {
		if (filter.operator === 'exists') return 'exists';
		if (filter.operator === 'not_exists') return 'does not exist';

		const operatorText =
			operatorOptions.find((op) => op.value === filter.operator)?.label || filter.operator;
		return `${operatorText.toLowerCase()} "${filter.value}"`;
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

				{#if activeFiltersList.length === 0}
					<p class="text-sm text-gray-500 dark:text-gray-400">No active filters</p>
				{:else}
					<div class="space-y-2">
						{#each activeFiltersList as filter, index}
							<div
								class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded-md"
							>
								<div class="flex items-center">
									<input
										type="checkbox"
										checked={filter.active}
										onchange={() => complianceStore.toggleFilter(index)}
										class="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
									/>
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

						{#if activeFiltersList.length > 1}
							<button
								onclick={() => complianceStore.clearFilters()}
								class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
							>
								Clear all filters
							</button>
						{/if}
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
						<div class="relative" use:clickOutside={() => showFieldDropdown = false}>
							<!-- Dropdown Trigger -->
							<button
								onclick={() => showFieldDropdown = !showFieldDropdown}
								class={twMerge(
									"w-full flex items-center justify-between px-3 py-2 text-sm rounded-md border transition-colors",
									showFieldDropdown 
										? "border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900"
										: "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500",
									"bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
								)}
							>
								<span class="truncate">
									{newFilterField ? getFieldDisplayName(newFilterField) : "Select a field"}
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
									<!-- Family field is always first and specially formatted -->
									<button
										class={twMerge(
											"w-full text-left px-3 py-2 text-sm font-medium",
											newFilterField === 'family'
												? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
												: "hover:bg-gray-100 dark:hover:bg-gray-700/50"
										)}
										onclick={() => {
											newFilterField = 'family';
											showFieldDropdown = false;
										}}
									>
										Family
									</button>
									
									<!-- Divider -->
									<div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
									
									<!-- Overview fields -->
									<div class="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/80">
										Overview Fields
									</div>
									{#each fieldsByTab.overview as field}
										<button
											class={twMerge(
												"w-full text-left px-3 py-2 text-sm",
												newFilterField === field
													? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
													: "hover:bg-gray-100 dark:hover:bg-gray-700/50"
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
										<div class="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/80">
											Implementation Fields
										</div>
										{#each fieldsByTab.implementation as field}
											<button
												class={twMerge(
													"w-full text-left px-3 py-2 text-sm",
													newFilterField === field
														? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
														: "hover:bg-gray-100 dark:hover:bg-gray-700/50"
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
										<div class="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/80">
											Custom Fields
										</div>
										{#each fieldsByTab.custom as field}
											<button
												class={twMerge(
													"w-full text-left px-3 py-2 text-sm",
													newFilterField === field
														? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
														: "hover:bg-gray-100 dark:hover:bg-gray-700/50"
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

					<!-- Operator Selection (hidden for family field) -->
					{#if !isFamilyField}
						<div>
							<label
								for="filter-operator"
								class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Operator</label
							>
							<select
								id="filter-operator"
								bind:value={newFilterOperator}
								class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
							>
								{#each operatorOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>
					{/if}

					<!-- Value Input (conditional or always for family) -->
					{#if showValueInput || isFamilyField}
						<div>
							<label for="filter-value" class="block text-xs text-gray-600 dark:text-gray-400 mb-1"
								>Value</label
							>

							{#if newFilterField === 'family'}
								<!-- Special handling for family field -->
								<select
									id="filter-value"
									bind:value={newFilterValue}
									class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
								>
									<option value="" disabled>Select a family</option>
									{#each $availableFamilies as family}
										<option value={family}>{family}</option>
									{/each}
								</select>
							{:else if newFilterField === 'mapping.status'}
								<!-- Special handling for mapping status field -->
								<select
									id="filter-value"
									bind:value={newFilterValue}
									class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
								>
									<option value="" disabled>Select a status</option>
									<option value="planned">Planned</option>
									<option value="implemented">Implemented</option>
									<option value="verified">Verified</option>
								</select>
							{:else if isSelectField}
								<!-- Dropdown for select fields -->
								<select
									id="filter-value"
									bind:value={newFilterValue}
									class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
								>
									<option value="" disabled>Select a value</option>
									{#each fieldOptions as option}
										<option value={option}>{option}</option>
									{/each}
								</select>
							{:else if selectedFieldType === 'boolean'}
								<!-- Boolean toggle -->
								<select
									id="filter-value"
									bind:value={newFilterValue}
									class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
								>
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
