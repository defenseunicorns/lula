<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { complianceStore, type FilterOperator, type FilterCondition, activeFilters, families } from '$stores/compliance';
	import { appState } from '$lib/websocket';
	import { Filter, Add, TrashCan, ChevronDown } from 'carbon-icons-svelte';
	import { clickOutside } from '$lib/actions/clickOutside';
	import { slide } from 'svelte/transition';
	import { derived } from 'svelte/store';
	
	// Local state
	let showFilterPanel = false;
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
	$: fieldOptions = isSelectField ? (selectedFieldSchema?.options || []) : [];
	
	// Special handling for family field
	$: isFamilyField = newFilterField === 'family';
	$: if (isFamilyField) {
		// Force equals operator for family field
		newFilterOperator = 'equals';
	}
	
	// Determine if value input should be shown based on operator
	$: showValueInput = newFilterOperator !== 'is_set' && newFilterOperator !== 'is_not_set';
	
	// Operator options
	const operatorOptions = [
		{ value: 'equals', label: 'Equals' },
		{ value: 'not_equals', label: 'Not equals' },
		{ value: 'includes', label: 'Contains' },
		{ value: 'not_includes', label: 'Does not contain' },
		{ value: 'is_set', label: 'Is set' },
		{ value: 'is_not_set', label: 'Is not set' }
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
		
		complianceStore.addFilter(newFilterField, newFilterOperator, showValueInput ? value : undefined);
		
		// Reset form
		newFilterValue = '';
	}
	
	// Toggle filter panel
	function toggleFilterPanel() {
		showFilterPanel = !showFilterPanel;
	}
	
	// Get display name for a field
	function getFieldDisplayName(fieldName: string): string {
		const schema = $fieldSchema[fieldName];
		return schema?.original_name || schema?.display_name || fieldName.replace(/-/g, ' ');
	}
	
	// Get display value for a filter
	function getFilterDisplayValue(filter: FilterCondition): string {
		if (filter.operator === 'is_set') return 'is set';
		if (filter.operator === 'is_not_set') return 'is not set';
		
		const operatorText = operatorOptions.find(op => op.value === filter.operator)?.label || filter.operator;
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
			<span class="ml-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 text-xs font-medium px-2 py-0.5 rounded-full">
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
							<div class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded-md">
								<div class="flex items-center">
									<input
										type="checkbox"
										checked={filter.active}
										onchange={() => complianceStore.toggleFilter(index)}
										class="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
									/>
									<span class="text-sm text-gray-700 dark:text-gray-300">
										<span class="font-medium">{getFieldDisplayName(filter.fieldName)}</span>
										<span class="mx-1 text-gray-500 dark:text-gray-400">{getFilterDisplayValue(filter)}</span>
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
					<!-- Field Selection -->
					<div>
						<label for="filter-field" class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Field</label>
						<select
							id="filter-field"
							bind:value={newFilterField}
							class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
						>
							<option value="" disabled>Select a field</option>
							
							<!-- Family field is always first and specially formatted -->
							<option value="family" class="font-medium">Family</option>
							
							<!-- Divider -->
							<option disabled>──────────</option>
							
							<!-- Other fields -->
							{#each availableFields.filter(f => f !== 'family') as field}
								<option value={field}>{getFieldDisplayName(field)}</option>
							{/each}
						</select>
					</div>
					
					<!-- Operator Selection (hidden for family field) -->
					{#if !isFamilyField}
						<div>
							<label for="filter-operator" class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Operator</label>
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
							<label for="filter-value" class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Value</label>
							
							{#if isFamilyField}
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
