<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Dropdown, SearchBar, Tooltip } from '$components/ui';
	import type { Control, FieldSchema } from '$lib/types';
	import { appState } from '$lib/websocket';
	import { complianceStore, searchTerm, selectedFamily } from '$stores/compliance';
	import { Filter, Information } from 'carbon-icons-svelte';
	import { derived, writable } from 'svelte/store';

	// Derive controls and families from appState
	const controls = derived(appState, ($state) => $state.controls || []);
	const families = derived(appState, ($state) => $state.families || []);
	const loading = derived(appState, ($state) => !$state.isConnected);

	// Derive controls with mappings
	const controlsWithMappings = derived(appState, ($state) => {
		return ($state.controls || []).map((control) => ({
			...control,
			mappings: ($state.mappings || []).filter((m) => m.control_id === control.id)
		}));
	});

	// Use compliance store for search and family filter - stores are imported directly
	
	// Track selected control based on current route
	let selectedControlId: string | null = null;
	$: selectedControlId = $page.params.id || null;

	// Dynamic field schema for table columns
	let fieldSchema: Record<string, FieldSchema> = {};
	let tableColumns: Array<{ fieldName: string; field: FieldSchema }> = [];
	let schemaLoading = true;

	// Watch for control set changes
	$: if ($appState.name && $appState.name !== 'Unknown Control Set') {
		const schema = $appState.fieldSchema || $appState.field_schema;
		if (schema?.fields) {
			fieldSchema = schema.fields;
			// Get overview tab fields for table display
			const overviewFields = Object.entries(fieldSchema)
				.filter(([fieldName, field]) => {
					// Use overview tab fields for the table
					const fieldTab = field.tab || getDefaultTabForCategory(field.category);
					// Include visible overview fields, but skip family as it's redundant
					return fieldTab === 'overview' && field.visible && fieldName !== 'family';
				})
				.sort((a, b) => a[1].display_order - b[1].display_order);

			// Get the control ID field from metadata or default to 'id'
			const controlIdFieldName = $appState.control_id_field || 'id';

			// Always include control ID column first
			const idField = overviewFields.find(([name]) => name === controlIdFieldName || name === 'id');
			const otherFields = overviewFields.filter(
				([name]) => name !== controlIdFieldName && name !== 'id'
			);

			// If control ID field doesn't exist in schema, create a default one
			const idColumn = idField
				? { fieldName: idField[0], field: idField[1] }
				: {
						fieldName: 'id',
						field: {
							display_name: 'Control ID',
							original_name: 'Control ID',
							ui_type: 'short_text',
							visible: true,
							display_order: 0
						}
					};

			// Combine ID first, then other fields sorted by display_order
			// Take up to 5 additional fields after the ID for a total of 6 columns
			tableColumns = [
				idColumn,
				...otherFields.slice(0, 5).map(([fieldName, field]) => ({ fieldName, field }))
			];
		}
		schemaLoading = false;
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

	// Create filtered controls with mappings
	const filteredControlsWithMappings = derived(
		[controlsWithMappings, selectedFamily, searchTerm],
		([$controlsWithMappings, $selectedFamily, $searchTerm]) => {
			let results = $controlsWithMappings;

			if ($selectedFamily) {
				results = results.filter((c) => {
					const family =
						(c as any)?._metadata?.family ||
						(c as any)?.family ||
						(c as any)?.['control-acronym']?.split('-')[0] ||
						'';
					return family === $selectedFamily;
				});
			}

			if ($searchTerm) {
				const term = $searchTerm.toLowerCase();
				results = results.filter((c) => JSON.stringify(c).toLowerCase().includes(term));
			}

			return results;
		}
	);

	function selectControl(control: Control) {
		goto(`/control/${encodeURIComponent(control.id)}`);
	}

	function getStatusBadgeClass(status: string) {
		switch (status) {
			case 'Implemented':
				return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
			case 'Planned':
				return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
			case 'Not Implemented':
				return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
			default:
				return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
		}
	}

	function getComplianceBadgeClass(status: string) {
		switch (status) {
			case 'Compliant':
				return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300';
			case 'Non-Compliant':
				return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
			case 'Not Assessed':
				return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
			default:
				return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
		}
	}

	function extractDescriptionFromNested(data: any): string {
		if (typeof data === 'string') {
			return data;
		}
		if (Array.isArray(data)) {
			// Try to find the first string in the array or extract from nested objects
			for (const item of data) {
				if (typeof item === 'string') {
					return item;
				}
				if (typeof item === 'object' && item !== null) {
					// Extract the first text from nested objects
					for (const [key, value] of Object.entries(item)) {
						if (Array.isArray(value)) {
							const firstText = extractDescriptionFromNested(value);
							if (firstText && typeof firstText === 'string') {
								return firstText;
							}
						}
						// Return the key as it's usually meaningful text
						return key.replace(/:$/, ''); // Remove trailing colon
					}
				}
			}
		}
		return 'No description available';
	}

	// Helper to determine if a field should be truncated and show tooltip
	function shouldTruncateField(field: FieldSchema | undefined, value: string): boolean {
		if (!value) return false;
		
		// Always show tooltip for textarea fields if content is long
		if (field?.ui_type === 'textarea' || field?.ui_type === 'long_text') {
			return value.length > 100; // Lower threshold for long text fields
		}
		
		// For short_text fields, only show if really long
		if (field?.ui_type === 'short_text') {
			return value.length > 200;
		}
		
		// Default for unknown field types
		return value.length > 150;
	}

	// Get truncation length based on field type
	function getTruncationLength(field: FieldSchema | undefined): number {
		if (field?.ui_type === 'textarea' || field?.ui_type === 'long_text') {
			return 100;
		}
		if (field?.ui_type === 'short_text') {
			return 200;
		}
		return 150;
	}
	
	// Check if field should show only icon (for textarea/long_text fields)
	function isLongTextField(field: FieldSchema | undefined): boolean {
		return field?.ui_type === 'textarea' || field?.ui_type === 'long_text';
	}
</script>

<div class="h-full flex flex-col">
	{#if $loading || schemaLoading}
		<!-- Loading state -->
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
				<p class="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading controls...</p>
			</div>
		</div>
	{:else}
		<!-- Compact Header with Controls and Search -->
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-4">
			<!-- Title and Count -->
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Controls</h2>
				<span class="text-sm text-gray-600 dark:text-gray-400">
					{$filteredControlsWithMappings.length} of {$controls.length}
				</span>
			</div>

			<!-- Search Bar and Family Filter -->
			<div class="flex gap-3">
				<div class="flex-1">
					<SearchBar />
				</div>
				<div class="flex-shrink-0">
					<Dropdown
						buttonLabel={$selectedFamily || 'All Families'}
						buttonIcon={Filter}
						buttonClass="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
						dropdownClass="w-64"
					>
						{#snippet children()}
							<div class="space-y-1">
								<button
									onclick={() => {
										complianceStore.setSelectedFamily(null);
									}}
									class="w-full text-left px-3 py-2 text-sm rounded-md transition-colors duration-200 flex items-center justify-between {$selectedFamily ===
									null
										? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
										: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
								>
									<span>All Families</span>
									<span class="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full">
										{$controls.length}
									</span>
								</button>

								{#each $families as family}
									{@const familyCount = $controls.filter((c) => {
										const controlFamily =
											(c as any)?._metadata?.family ||
											(c as any)?.family ||
											(c as any)?.['control-acronym']?.split('-')[0] ||
											'';
										return controlFamily === family;
									}).length}
									<button
										onclick={() => {
											complianceStore.setSelectedFamily(family);
										}}
										class="w-full text-left px-3 py-2 text-sm rounded-md transition-colors duration-200 flex items-center justify-between {$selectedFamily ===
										family
											? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
											: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
									>
										<span>{family}</span>
										<span class="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full">
											{familyCount}
										</span>
									</button>
								{/each}
							</div>
						{/snippet}
					</Dropdown>
				</div>
			</div>
		</div>

		<!-- Controls Table -->
		<div class="flex-1 flex flex-col overflow-hidden">
			<!-- Fixed Table Header -->
			<div
				class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 flex-shrink-0"
			>
				{#if tableColumns.length > 0}
					<!-- Dynamic columns based on field schema -->
					<div
						class="grid gap-4 px-6 py-3"
						style="grid-template-columns: repeat({tableColumns.length + 1}, minmax(0, 1fr)); max-width: 100%;"
					>
						{#each tableColumns as { fieldName, field }}
							<div
								class="text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
							>
								{field.original_name ||
									(fieldName === 'id' ? 'Control ID' : fieldName.replace(/-/g, ' '))}
							</div>
						{/each}
						<div
							class="text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
						>
							Mappings
						</div>
					</div>
				{:else}
					<!-- Fallback to default columns -->
					<div class="grid grid-cols-5 gap-4 px-6 py-3">
						<div
							class="text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
						>
							Control
						</div>
						<div
							class="text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
						>
							Title
						</div>
						<div
							class="text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
						>
							Statement
						</div>
						<div
							class="text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
						>
							Family
						</div>
						<div
							class="text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
						>
							Mappings
						</div>
					</div>
				{/if}
			</div>

			<!-- Scrollable Table Body -->
			<div class="flex-1 overflow-auto">
				<div class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each $filteredControlsWithMappings as control}
						{@const rawDescription = (() => {
							// Cast control to any to allow dynamic field access
							const anyControl = control as any;
							// Try to find a description from any text field in the schema
							if (fieldSchema) {
								for (const [fieldName, field] of Object.entries(fieldSchema)) {
									if ((field.ui_type === 'long_text' || field.ui_type === 'short_text') && anyControl[fieldName]) {
										return anyControl[fieldName];
									}
								}
							}
							// Fallback to any field that contains text
							for (const [key, value] of Object.entries(control)) {
								if (typeof value === 'string' && value.length > 20 && !key.startsWith('_')) {
									return value;
								}
							}
							return 'No description available';
						})()}
						{@const description = extractDescriptionFromNested(rawDescription) || ''}
						{@const cleanDescription = description
							? description
									.replace(/^(a\.|b\.|1\.|2\.|\s|The organization:)+/, '')
									.replace(/\s+/g, ' ')
									.trim()
									.substring(0, 200) + (description.length > 200 ? '...' : '')
							: 'No description available'}
						{#if tableColumns.length > 0}
							<!-- Dynamic columns based on field schema -->
							<div
								class="grid gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-all duration-150 {selectedControlId ===
								control.id
									? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 shadow-sm'
									: ''}"
								style="grid-template-columns: repeat({tableColumns.length + 1}, minmax(0, 1fr)); max-width: 100%;"
								onclick={() => selectControl(control)}
								onkeydown={(e) =>
									e.key === 'Enter' || e.key === ' ' ? selectControl(control) : null}
								role="button"
								tabindex="0"
								aria-label="Select control {control.id}"
							>
								{#each tableColumns as { fieldName, field }}
									{@const value = (control as any)[fieldName]}
									<div class="flex flex-col justify-center">
										{#if field.ui_type === 'select' && value}
											<span
												class="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 w-fit"
											>
												{value}
											</span>
										{:else if field.ui_type === 'boolean'}
											<span class="text-sm text-gray-900 dark:text-white">
												{value ? 'Yes' : 'No'}
											</span>
										{:else if typeof value === 'string' && value}
											{@const isLongField = isLongTextField(field)}
											{@const truncLength = getTruncationLength(field)}
											{@const needsTruncation = value.length > truncLength}
											{@const displayValue = needsTruncation ? value.substring(0, truncLength) + '...' : value}
											{@const previewText = value.substring(0, 600) + (value.length > 600 ? '...' : '')}
											{#if isLongField && value}
												<!-- For textarea/long_text fields, show only icon with tooltip -->
												<div class="flex items-center">
													<Tooltip content={previewText} placement="bottom" maxWidth="500px" multiline={true}>
														<Information size={20} class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 cursor-help" />
													</Tooltip>
												</div>
											{:else if needsTruncation}
												<!-- For other fields that are truncated, show text with icon -->
												<div class="flex items-start gap-1">
													<div class="text-sm text-gray-900 dark:text-white line-clamp-2 flex-1">
														{displayValue}
													</div>
													<Tooltip content={previewText} placement="bottom" maxWidth="500px" multiline={true}>
														<Information size={16} class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 mt-0.5 cursor-help" />
													</Tooltip>
												</div>
											{:else}
												<!-- For short text, show as is -->
												<div class="text-sm text-gray-900 dark:text-white line-clamp-2">
													{value}
												</div>
											{/if}
										{:else if Array.isArray(value)}
											{@const extractedText = extractDescriptionFromNested(value)}
											{@const isLongField = isLongTextField(field)}
											{@const truncLength = getTruncationLength(field)}
											{@const needsTruncation = extractedText.length > truncLength}
											{@const displayValue = needsTruncation ? extractedText.substring(0, truncLength) + '...' : extractedText}
											{@const previewText = extractedText.substring(0, 600) + (extractedText.length > 600 ? '...' : '')}
											{#if isLongField && extractedText}
												<!-- For textarea/long_text fields, show only icon with tooltip -->
												<div class="flex items-center">
													<Tooltip content={previewText} placement="bottom" maxWidth="500px" multiline={true}>
														<Information size={20} class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 cursor-help" />
													</Tooltip>
												</div>
											{:else if needsTruncation}
												<!-- For other fields that are truncated, show text with icon -->
												<div class="flex items-start gap-1">
													<div class="text-sm text-gray-900 dark:text-white line-clamp-2 flex-1">
														{displayValue}
													</div>
													<Tooltip content={previewText} placement="bottom" maxWidth="500px" multiline={true}>
														<Information size={16} class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 mt-0.5 cursor-help" />
													</Tooltip>
												</div>
											{:else}
												<!-- For short text, show as is -->
												<div class="text-sm text-gray-900 dark:text-white line-clamp-2">
													{extractedText}
												</div>
											{/if}
										{:else if value}
											<div class="text-sm text-gray-900 dark:text-white">
												{JSON.stringify(value)}
											</div>
										{:else}
											<span class="text-sm text-gray-400 dark:text-gray-500">-</span>
										{/if}
									</div>
								{/each}
								<!-- Mappings Column -->
								<div class="flex items-center justify-center">
									<span
										class="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
									>
										{control.mappings?.length || 0}
									</span>
								</div>
							</div>
						{:else}
							{@const statementIsLongText = cleanDescription.length > 120}
							<!-- Fallback to default columns -->
							<div
								class="grid grid-cols-5 gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-all duration-150 {selectedControlId ===
								control.id
									? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 shadow-sm'
									: ''}"
								onclick={() => selectControl(control)}
								onkeydown={(e) =>
									e.key === 'Enter' || e.key === ' ' ? selectControl(control) : null}
								role="button"
								tabindex="0"
								aria-label="Select control {control.id}"
							>
								<!-- Control Column -->
								<div class="flex flex-col justify-center">
									<div class="text-sm font-semibold text-gray-900 dark:text-white">
										{control.id}
									</div>
								</div>
								<!-- Title Column -->
								<div class="flex flex-col justify-center">
									<div class="text-sm text-gray-900 dark:text-white font-medium">
										{control.title || 'No Title'}
									</div>
								</div>
								<!-- Statement Column -->
								<div class="flex flex-col justify-center">
									{#if statementIsLongText}
										<div class="flex items-start gap-1">
											<div class="text-sm text-gray-900 dark:text-white line-clamp-2 flex-1">
												{cleanDescription.substring(0, 120)}...
											</div>
											<Tooltip content={cleanDescription.substring(0, 400) + (cleanDescription.length > 400 ? '...' : '')} placement="bottom" maxWidth="400px" multiline={true}>
												<Information size={16} class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 mt-0.5 cursor-help" />
											</Tooltip>
										</div>
									{:else}
										<div class="text-sm text-gray-900 dark:text-white line-clamp-2">
											{cleanDescription}
										</div>
									{/if}
								</div>
								<!-- Family Column -->
								<div class="flex items-center justify-center">
									<span
										class="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
									>
										{(control.family || control.id?.split('-')[0] || '').toUpperCase()}
									</span>
								</div>
								<!-- Mappings Column -->
								<div class="flex items-center justify-center">
									<span
										class="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
									>
										{control.mappings?.length || 0}
									</span>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		</div>

		{#if $filteredControlsWithMappings.length === 0}
			<div class="flex items-center justify-center py-16">
				<div class="text-center">
					<svg
						class="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					<h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">No controls found</h3>
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
						{#if $searchTerm}
							No controls match your search criteria. Try adjusting your search terms or clearing
							filters.
						{:else if $selectedFamily}
							No controls available in this family. Select a different family or check your data.
						{:else if $controls.length === 0}
							No controls have been imported yet.
						{:else}
							No controls available. Select a different family or check your data.
						{/if}
					</p>
					{#if $controls.length === 0}
						<a
							href="/setup"
							class="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
						>
							Import Controls Now
						</a>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>
