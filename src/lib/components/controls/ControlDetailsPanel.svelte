<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { TimelineItem } from '$components/version-control';
	import { hasAssessmentObjectives } from '$lib/assessmentObjectives';
	import type { Control, ControlCompleteData, FieldSchema } from '$lib/types';
	import { appState, wsClient } from '$lib/websocket';
	import { mappings } from '$stores/compliance';
	import {
		CheckmarkOutline,
		Connect,
		Edit,
		Error,
		Information,
		Time,
		WarningAlt
	} from 'carbon-icons-svelte';
	import { MappingCard, MappingForm } from '.';
	import { EmptyState, TabNavigation } from '../ui';

	interface Props {
		control: Control;
	}

	let { control }: Props = $props();

	// Component state
	let editedControl = $state({ ...control });
	let originalControl = $state({ ...control });
	let activeTab = $state<'details' | 'narrative' | 'custom' | 'mappings' | 'history'>('details');
	let showNewMappingForm = $state(false);
	let editingMapping = $state<any>(null);
	let saveDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
	let fieldSchema = $state<Record<string, FieldSchema> | null>(null);
	let isSaving = $state(false);
	let showSavedMessage = $state(false);
	let savedMessageTimeout: ReturnType<typeof setTimeout> | null = null;

	// Data loading state
	let completeData: ControlCompleteData | null = $state(null);
	let loadingCompleteData = $state(false);
	let loadingSchema = $state(false);

	// Form state
	let newMappingData = $state({
		justification: '',
		status: 'planned' as 'planned' | 'implemented' | 'verified'
	});

	// Derived values
	const hasChanges = $derived(JSON.stringify(editedControl) !== JSON.stringify(originalControl));
	const associatedMappings = $derived(
		(completeData as ControlCompleteData | null)?.mappings ||
			$mappings.filter((m) => m.control_id === control.id)
	);
	const unifiedTimeline = $derived(
		(completeData as ControlCompleteData | null)?.unifiedHistory.commits || []
	);
	const saveStatus = $derived(
		isSaving ? 'saving' : (hasChanges ? 'unsaved' : (showSavedMessage ? 'just-saved' : 'clean'))
	);

	// Helper to get implementation status icon and color
	const getImplementationStatus = $derived.by(() => {
		const status = control['control-implementation-status'] || 'Not Implemented';
		switch (status) {
			case 'Implemented':
				return {
					icon: CheckmarkOutline,
					color: 'text-green-600',
					bg: 'bg-green-50 dark:bg-green-900/20',
					text: 'text-green-800 dark:text-green-200',
					label: 'Implemented'
				};
			case 'Partially Implemented':
				return {
					icon: WarningAlt,
					color: 'text-yellow-600',
					bg: 'bg-yellow-50 dark:bg-yellow-900/20',
					text: 'text-yellow-800 dark:text-yellow-200',
					label: 'Partially Implemented'
				};
			case 'Planned':
				return {
					icon: WarningAlt,
					color: 'text-blue-600',
					bg: 'bg-blue-50 dark:bg-blue-900/20',
					text: 'text-blue-800 dark:text-blue-200',
					label: 'Planned'
				};
			case 'Not Implemented':
				return {
					icon: Error,
					color: 'text-red-600',
					bg: 'bg-red-50 dark:bg-red-900/20',
					text: 'text-red-800 dark:text-red-200',
					label: 'Not Implemented'
				};
			default:
				return {
					icon: WarningAlt,
					color: 'text-gray-600',
					bg: 'bg-gray-50 dark:bg-gray-900/20',
					text: 'text-gray-800 dark:text-gray-200',
					label: status
				};
		}
	});

	// Effects
	$effect(() => {
		// Only run when control prop actually changes
		const controlIdChanged = control.id !== originalControl?.id;
		
		// If we're just getting the same control back (like after a save), don't reset
		// Check if the incoming control is essentially the same as what we already have
		if (!controlIdChanged) {
			// If we have pending changes, don't overwrite them with incoming data
			if (hasChanges) {
				return; // Keep our local edits
			}
			
			// If no local changes and the data is the same, skip update
			if (JSON.stringify(control) === JSON.stringify(originalControl)) {
				return;
			}
		}
		
		// Reset component state when control changes
		// Clear any existing save timeout
		if (saveDebounceTimeout) {
			clearTimeout(saveDebounceTimeout);
		}
		
		// Only update if this is a different control or significant change
		if (controlIdChanged) {
			editedControl = { ...control };
			originalControl = { ...control };
			completeData = null;
			loadingCompleteData = false;
			activeTab = 'details';
			editingMapping = null;
		} else if (!hasChanges) {
			// Only update if we don't have local changes
			editedControl = { ...control };
			originalControl = { ...control };
		}

		// Load field schema on mount
		loadFieldSchema();

		// Cleanup on component unmount
		return () => {
			if (saveDebounceTimeout) {
				clearTimeout(saveDebounceTimeout);
			}
		};
	});

	// Effect to auto-save when editedControl changes
	$effect(() => {
		// Skip if no changes or if this is the initial load
		if (!hasChanges || JSON.stringify(editedControl) === JSON.stringify(control)) {
			return;
		}
		
		// Clear any existing save timeout
		if (saveDebounceTimeout) {
			clearTimeout(saveDebounceTimeout);
		}
		
		// Debounce the save by 500ms to avoid too many saves while typing
		saveDebounceTimeout = setTimeout(() => {
			performSave();
		}, 500);
		
		return () => {
			if (saveDebounceTimeout) {
				clearTimeout(saveDebounceTimeout);
			}
		};
	});

	// Perform the actual save
	async function performSave() {
		if (!hasChanges || isSaving) return;
		
		isSaving = true;
		try {
			// Create a clean copy without runtime data like timeline
			const controlToSave = { ...editedControl };
			delete controlToSave.timeline;
			delete controlToSave.unifiedHistory;
			delete controlToSave._metadata;  // Remove any other runtime metadata
			
			await wsClient.updateControl(controlToSave);
			originalControl = { ...editedControl };
			showTemporarySavedMessage();
			console.log('Saved control changes');
		} catch (error) {
			console.error('Save failed:', error);
		} finally {
			isSaving = false;
		}
	}
	
	// Show the saved message temporarily
	function showTemporarySavedMessage() {
		// Clear any existing timeout
		if (savedMessageTimeout) {
			clearTimeout(savedMessageTimeout);
		}
		
		// Show the message
		showSavedMessage = true;
		
		// Hide it after 3 seconds
		savedMessageTimeout = setTimeout(() => {
			showSavedMessage = false;
			savedMessageTimeout = null;
		}, 3000);
	}


	$effect(() => {
		// Load complete data when history tab is selected
		if ((activeTab === 'history' || control.timeline) && !completeData && !loadingCompleteData) {
			loadCompleteData();
		}
	});

	// Event handlers

	async function handleCreateMapping(data: typeof newMappingData) {
		try {
			const mappingData = {
				control_id: control.id,
				justification: data.justification,
				status: data.status,
				source_entries: []
			};

			await wsClient.createMapping(mappingData);
			resetMappingForm();
		} catch (error) {
			console.error('Failed to create mapping:', error);
		}
	}

	function cancelNewMapping() {
		resetMappingForm();
	}

	function resetMappingForm() {
		newMappingData = {
			justification: '',
			status: 'planned'
		};
		showNewMappingForm = false;
		editingMapping = null;
	}

	function startEditMapping(mapping: any) {
		editingMapping = { ...mapping };
		showNewMappingForm = true;
		newMappingData = {
			justification: mapping.justification,
			status: mapping.status
		};
	}

	async function handleUpdateMapping(data: typeof newMappingData) {
		if (!editingMapping) return;

		try {
			const updatedMapping = {
				...editingMapping,
				justification: data.justification,
				status: data.status
			};

			await wsClient.updateMapping(updatedMapping);
			resetMappingForm();
		} catch (error) {
			console.error('Failed to update mapping:', error);
		}
	}

	async function handleDeleteMapping(uuid: string) {
		try {
			await wsClient.deleteMapping(uuid);
			// Refresh complete data if needed
			if (completeData) {
				completeData = null;
				loadCompleteData();
			}
		} catch (error) {
			console.error('Failed to delete mapping:', error);
		}
	}

	// Utility functions

	async function loadFieldSchema() {
		if (fieldSchema || loadingSchema) return;

		loadingSchema = true;
		try {
			// Get field schema from WebSocket state
			const schema = $appState.fieldSchema || $appState.field_schema;
			if (schema?.fields) {
				fieldSchema = schema.fields;
			}
		} catch (error) {
			console.error('Failed to load field schema:', error);
		} finally {
			loadingSchema = false;
		}
	}

	// Helper to get fields for a specific tab
	function getFieldsForTab(tab: 'overview' | 'implementation' | 'custom') {
		if (!fieldSchema) return [];

		return Object.entries(fieldSchema)
			.filter(([fieldName, field]) => {
				// Exclude id and family fields from overview since they're in the header
				if (tab === 'overview' && (fieldName === 'id' || fieldName === 'family')) {
					return false;
				}
				// Map category to tab if tab not explicitly set
				const fieldTab = field.tab || getDefaultTabForCategory(field.category);
				return fieldTab === tab && field.visible;
			})
			.sort((a, b) => a[1].display_order - b[1].display_order);
	}

	// Helper to determine field layout class based on field type
	function getFieldLayoutClass(field: FieldSchema): string {
		// Textareas and long text fields get full width
		if (field.ui_type === 'textarea' || field.ui_type === 'long_text') {
			return 'col-span-full';
		}
		// Medium text fields also get full width
		if (field.ui_type === 'medium_text' && field.max_length && field.max_length > 100) {
			return 'col-span-full';
		}
		// Dropdowns and short fields can be side by side
		if (
			field.ui_type === 'select' ||
			field.ui_type === 'boolean' ||
			field.ui_type === 'date' ||
			field.ui_type === 'number' ||
			(field.ui_type === 'short_text' && field.max_length && field.max_length <= 50)
		) {
			return 'col-span-1';
		}
		// Default to full width for everything else
		return 'col-span-full';
	}

	// Helper to group fields by layout type
	function groupFieldsForLayout(fields: Array<[string, FieldSchema]>) {
		const groups: Array<Array<[string, FieldSchema]>> = [];
		let currentGroup: Array<[string, FieldSchema]> = [];

		for (const field of fields) {
			const layoutClass = getFieldLayoutClass(field[1]);

			if (layoutClass === 'col-span-full') {
				// Full width fields go in their own group
				if (currentGroup.length > 0) {
					groups.push(currentGroup);
					currentGroup = [];
				}
				groups.push([field]);
			} else {
				// Half width fields can be grouped
				currentGroup.push(field);
				if (currentGroup.length === 2) {
					groups.push(currentGroup);
					currentGroup = [];
				}
			}
		}

		// Add any remaining fields
		if (currentGroup.length > 0) {
			groups.push(currentGroup);
		}

		return groups;
	}

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

	async function loadCompleteData() {
		if (completeData || loadingCompleteData) return;

		loadingCompleteData = true;
		try {
			// Get mappings from WebSocket state
			const controlMappings = $appState.mappings.filter((m) => m.control_id === control.id);

			// Use timeline from control prop if available
			completeData = {
				control,
				mappings: controlMappings,
				unifiedHistory: control.timeline || {
					commits: [],
					totalCommits: 0,
					controlCommits: 0,
					mappingCommits: 0
				}
			};
		} catch (error) {
			console.error('Failed to load complete data:', error);
			completeData = {
				control,
				mappings: $appState.mappings.filter((m) => m.control_id === control.id),
				unifiedHistory: control.timeline || {
					commits: [],
					totalCommits: 0,
					controlCommits: 0,
					mappingCommits: 0
				}
			};
		} finally {
			loadingCompleteData = false;
		}
	}
</script>

<!-- Header outside of any card -->
<header class="flex-shrink-0">
	<div class="py-5">
		<div class="flex items-center justify-between">
			<div class="flex items-center space-x-4">
				<div>
					<h1 class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
						{control.id}
					</h1>
					<div class="flex items-center space-x-3 mt-1">
						<p class="text-sm text-gray-500 dark:text-gray-400 font-medium">
							{control.title}
						</p>
						<span
							class="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
						>
							{control.family?.toUpperCase()}
						</span>
					</div>
				</div>
			</div>
			<div class="flex items-center">
				<!-- Save status icon indicator -->
				{#if saveStatus === 'saving'}
					<div
						class="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30"
						title="Saving..."
					>
						<svg
							class="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					</div>
				{:else if saveStatus === 'unsaved'}
					<div
						class="w-8 h-8 flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30"
						title="Unsaved changes"
					>
						<svg
							class="w-5 h-5 text-amber-600 dark:text-amber-400"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 5h2v6H9V5zm0 8h2v2H9v-2z" />
						</svg>
					</div>
				{:else if saveStatus === 'just-saved'}
					<div
						class="w-8 h-8 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 animate-fade-in"
						title="Saved"
					>
						<svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
				{/if}
			</div>
		</div>
	</div>
</header>

<!-- Tab Navigation outside of any card -->
<div class="mb-2">
	<TabNavigation
		active={activeTab}
		tabs={[
			{ id: 'details', label: 'Overview', icon: Information },
			{ id: 'narrative', label: 'Implementation', icon: Edit },
			...(fieldSchema && getFieldsForTab('custom').length > 0
				? [{ id: 'custom', label: 'Custom', icon: Edit }]
				: []),
			{ id: 'mappings', label: 'Mappings', icon: Connect, count: associatedMappings.length },
			{
				id: 'history',
				label: 'Timeline',
				icon: Time,
				count: completeData?.unifiedHistory.totalCommits
			}
		]}
		onSelect={(tabId) => (activeTab = tabId as typeof activeTab)}
	/>
</div>

<!-- Tab content without card wrapper -->
<main class="flex-1 overflow-auto pt-4">
	<div class="">
		{#if activeTab === 'details'}
			{@render detailsTab()}
		{:else if activeTab === 'narrative'}
			{@render narrativeTab()}
		{:else if activeTab === 'custom'}
			{@render customTab()}
		{:else if activeTab === 'mappings'}
			{@render mappingsTab()}
		{:else if activeTab === 'history'}
			{@render historyTab()}
		{/if}
	</div>
</main>

{#snippet detailsTab()}
	<!-- Readonly Overview Tab with Clean Styling -->
	<div class="space-y-8">
		<!-- Dynamic Fields based on Schema (Overview Tab) -->
		{#if fieldSchema}
			{@const overviewFields = getFieldsForTab('overview')}
			{#if overviewFields.length > 0}
				<div class="space-y-4">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Control Details</h3>
					<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6">
						<div class="space-y-8">
							{#each groupFieldsForLayout(overviewFields) as fieldGroup}
								<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
									{#each fieldGroup as [fieldName, field]}
										<div class={getFieldLayoutClass(field)}>
											{@render renderReadonlyField(fieldName, field, editedControl[fieldName])}
										</div>
									{/each}
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		{:else}
			<!-- Fallback to static fields if no schema -->
			<div class="space-y-8">
				<!-- Implementation Status Display -->
				<div class="space-y-4">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Implementation Status</h3>
					<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6">
						<div class="flex items-center space-x-4">
							{#if getImplementationStatus}
								{@const IconComponent = getImplementationStatus.icon}
								<div class="inline-flex items-center px-4 py-2 rounded-lg {getImplementationStatus.bg}">
									<IconComponent class="w-5 h-5 {getImplementationStatus.color} mr-2" />
									<span class="text-sm font-medium {getImplementationStatus.text}">
										{getImplementationStatus.label}
									</span>
								</div>
							{/if}
							{#if editedControl.priority !== undefined}
								<div class="inline-flex items-center px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700">
									<span class="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
										{editedControl.priority} Priority
									</span>
								</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Control Metadata -->
				<div class="space-y-4">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Control Metadata</h3>
					<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6">
						<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<div class="space-y-6">
								{@render renderReadonlyField('CCI', null, `CCI-${editedControl.cci || 'N/A'}`)}
								{@render renderReadonlyField('Security Control Designation', null, editedControl['security-control-designation'] || 'System')}
								{#if editedControl['control-acronym']}
									{@render renderReadonlyField('Control Acronym', null, editedControl['control-acronym'].toUpperCase())}
								{/if}
							</div>

							<div class="space-y-6">
								{@render renderReadonlyField('Status', null, editedControl.status)}
								{#if editedControl.cci_type}
									{@render renderReadonlyField('CCI Type', null, editedControl.cci_type)}
								{/if}
								{#if editedControl.publish_date}
									{@render renderReadonlyField('Published', null, editedControl.publish_date)}
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Control Information -->
			<div class="space-y-4">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
					Control Information
				</h3>
				<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6 space-y-4">
					{#if Array.isArray(editedControl['control-information'])}
						{#each editedControl['control-information'] as part}
							{@render renderControlPart(part, 0)}
						{/each}
					{:else if typeof editedControl['control-information'] === 'string'}
						<div class="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
							{editedControl['control-information']}
						</div>
					{/if}
				</div>
			</div>

			<!-- CCI Definition -->
			{#if editedControl['cci-definition']}
				<div class="space-y-4">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">CCI Definition</h3>
					<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6">
						<div class="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
							{editedControl['cci-definition']}
						</div>
					</div>
				</div>
			{/if}
		{/if}

		<!-- Control Properties -->
		{#if editedControl.properties && Object.keys(editedControl.properties).length > 0}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Control Properties</h3>
				<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6">
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{#each Object.entries(editedControl.properties) as [key, value]}
							{@render renderReadonlyField(key.replace(/_/g, ' '), null, typeof value === 'object' ? JSON.stringify(value, null, 2) : value)}
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet narrativeTab()}
	<!-- Readonly Implementation Tab with Clean Styling -->
	<div class="space-y-8">
		<!-- Dynamic Fields based on Schema (Implementation Tab) -->
		{#if fieldSchema}
			{@const implementationFields = getFieldsForTab('implementation')}
			{#if implementationFields.length > 0}
				<div class="space-y-4">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Implementation Details</h3>
					<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6">
						<div class="space-y-8">
							{#each groupFieldsForLayout(implementationFields) as fieldGroup}
								<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
									{#each fieldGroup as [fieldName, field]}
										<div class={getFieldLayoutClass(field)}>
											{@render renderReadonlyField(fieldName, field, editedControl[fieldName])}
										</div>
									{/each}
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		{:else}
			<!-- Fallback to static fields if no schema -->
			<div class="space-y-4">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Implementation Details</h3>
				<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6">
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{@render renderReadonlyField('control-implementation-status', null, editedControl['control-implementation-status'])}
						{@render renderReadonlyField('control-implementation-narrative', null, editedControl['control-implementation-narrative'])}
					</div>
				</div>
			</div>
		{/if}

		<!-- Implementation Guidance -->
		{#if editedControl['implementation-guidance']}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Implementation Guidance</h3>
				<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6">
					<div class="text-sm text-gray-500 dark:text-gray-400 mb-4">
						Guidance from the control framework
					</div>
					<div class="text-gray-900 dark:text-white font-medium whitespace-pre-wrap">
						{editedControl['implementation-guidance']}
					</div>
				</div>
			</div>
		{/if}

		<!-- Assessment Objectives -->
		{#if hasAssessmentObjectives(editedControl['assessment-objectives'])}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Assessment Objectives</h3>
				<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6">
					<div class="text-sm text-gray-500 dark:text-gray-400 mb-4">
						A set of determination statements that expresses the desired outcome for the assessment of
						a security control, privacy control, or control enhancement.
					</div>
					<div class="space-y-3">
						{#each editedControl['assessment-objectives'] as objective}
							{#if typeof objective === 'string'}
								<!-- Simple string objective -->
							<div class="flex items-start space-x-3">
								<div class="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
								<p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
									{objective}
								</p>
							</div>
						{:else if typeof objective === 'object' && objective !== null}
							<!-- Nested objective with sub-items -->
							{#each Object.entries(objective) as [key, value]}
								<div class="space-y-2">
									<div class="flex items-start space-x-3">
										<div class="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
										<p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
											{key}
										</p>
									</div>
									{#if Array.isArray(value)}
										<div class="ml-5 space-y-2">
											{#each value as subItem}
												<div class="flex items-start space-x-3">
													<div
														class="flex-shrink-0 w-1.5 h-1.5 bg-gray-400 rounded-full mt-2.5"
													></div>
													<p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
														{subItem}
													</p>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Assessment Procedures -->
		{#if editedControl['assessment-procedures'] && Array.isArray(editedControl['assessment-procedures']) && editedControl['assessment-procedures'].length > 0}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Assessment Procedures</h3>
				<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6">
					<div class="text-sm text-gray-500 dark:text-gray-400 mb-4">
						A set of assessment objectives and an associated set of assessment methods and assessment
						objects.
					</div>
					<div class="space-y-3">
						{#each editedControl['assessment-procedures'] as procedure}
							<div class="flex items-start space-x-3">
								<div class="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
								<p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{procedure}</p>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Parameters Editor -->
		{#if editedControl.parameters && Array.isArray(editedControl.parameters) && editedControl.parameters.length > 0}
			<div
				class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm"
			>
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Control Parameters</h3>
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
					Read-only parameters from the control framework
				</p>
				<div class="space-y-4">
					{#each editedControl.parameters as param}
						<div
							class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
						>
							<div class="flex items-center justify-between mb-2">
								<span class="text-sm font-medium text-gray-900 dark:text-white"
									>{param.label || param.id}</span
								>
								<code
									class="text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"
								>
									{param.id}
								</code>
							</div>
							{#if param.values && param.values.length > 0}
								<div class="mt-2">
									<p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Values:</p>
									<div class="flex flex-wrap gap-1">
										{#each param.values as value}
											<span
												class="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
											>
												{value}
											</span>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet customTab()}
	<div class="space-y-8">
		{#if fieldSchema}
			{@const customFields = getFieldsForTab('custom')}
			{#if customFields.length > 0}
				<div class="space-y-4">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Custom Fields</h3>
					<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6">
						<div class="text-sm text-gray-500 dark:text-gray-400 mb-4">
							Additional fields specific to your organization
						</div>
						<div class="space-y-8">
							{#each groupFieldsForLayout(customFields) as fieldGroup}
								<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
									{#each fieldGroup as [fieldName, field]}
										<div class={getFieldLayoutClass(field)}>
											{@render renderField(fieldName, field)}
										</div>
									{/each}
								</div>
							{/each}
						</div>
					</div>
				</div>
			{:else}
				<div class="text-center py-12">
					<p class="text-gray-500 dark:text-gray-400">No custom fields configured</p>
				</div>
			{/if}
		{:else}
			<div class="text-center py-12">
				<p class="text-gray-500 dark:text-gray-400">Loading field schema...</p>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet mappingsTab()}
	<div class="space-y-6">
		<!-- Add New Mapping Section -->
		<div class="mb-6">
			{#if !showNewMappingForm}
				<button
					onclick={() => (showNewMappingForm = true)}
					class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				>
					<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 6v6m0 0v6m0-6h6m-6 0H6"
						/>
					</svg>
					Add New Mapping
				</button>
			{:else}
				<div
					class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm"
				>
					<MappingForm
						initialData={newMappingData}
						onSubmit={editingMapping ? handleUpdateMapping : handleCreateMapping}
						onCancel={cancelNewMapping}
						submitLabel={editingMapping ? 'Update Mapping' : 'Create Mapping'}
					/>
				</div>
			{/if}
		</div>

		<!-- Existing Mappings -->
		{#if associatedMappings.length > 0}
			<div class="mb-4">
				<div class="space-y-4">
					{#each associatedMappings as mapping}
						<MappingCard
							{mapping}
							showActions={true}
							onEdit={startEditMapping}
							onDelete={handleDeleteMapping}
						/>
					{/each}
				</div>
			</div>
		{:else}
			<EmptyState
				title="No mappings yet"
				description="Create your first mapping for this control."
			/>
		{/if}
	</div>
{/snippet}

{#snippet historyTab()}
	<div>
		{#if loadingCompleteData}
			<div class="flex items-center justify-center py-16">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
				<span class="ml-3 text-gray-600 dark:text-gray-400">Loading activity timeline...</span>
			</div>
		{:else if unifiedTimeline.length > 0}
			<div class="mb-4">
				<div class="space-y-6">
					{#each unifiedTimeline as commit, index}
						<TimelineItem {commit} showConnector={index < unifiedTimeline.length - 1} />
					{/each}
				</div>
			</div>
		{:else}
			<EmptyState
				title="No activity history found"
				description={completeData?.unifiedHistory.totalCommits === 0
					? "This control and its mapping files are new and haven't been committed to git yet."
					: 'Unable to load git history for this control and its mappings.'}
				size="lg"
			/>
		{/if}
	</div>
{/snippet}

{#snippet renderControlPart(part: any, depth: number)}
	{#if typeof part === 'string'}
		<!-- Simple string part -->
		<div class="flex items-start space-x-3" style="margin-left: {depth * 1.25}rem">
			{#if depth === 0}
				<div class="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
				<p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{part}</p>
			{:else if depth === 1}
				<div class="flex-shrink-0 w-1.5 h-1.5 bg-gray-500 rounded-full mt-2.5"></div>
				<p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{part}</p>
			{:else}
				<div class="flex-shrink-0 w-1 h-1 bg-gray-400 rounded-full mt-2.5"></div>
				<p class="text-sm text-gray-500 dark:text-gray-500 leading-relaxed">{part}</p>
			{/if}
		</div>
	{:else if typeof part === 'object' && part !== null}
		<!-- Nested part with sub-items -->
		{#each Object.entries(part) as [key, value]}
			<div class="space-y-2">
				<div class="flex items-start space-x-3" style="margin-left: {depth * 1.25}rem">
					{#if depth === 0}
						<div class="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
						<p class="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">{key}</p>
					{:else if depth === 1}
						<div class="flex-shrink-0 w-1.5 h-1.5 bg-gray-500 rounded-full mt-2"></div>
						<p class="text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
							{key}
						</p>
					{:else}
						<div class="flex-shrink-0 w-1 h-1 bg-gray-400 rounded-full mt-2"></div>
						<p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{key}</p>
					{/if}
				</div>
				{#if Array.isArray(value)}
					<div class="space-y-1">
						{#each value as subItem}
							{@render renderControlPart(subItem, depth + 1)}
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	{/if}
{/snippet}

{#snippet renderReadonlyField(fieldName: string, field: FieldSchema | null, value: any)}
	<div class="space-y-2">
		<div class="text-sm font-medium text-gray-500 dark:text-gray-400">
			{field?.original_name || fieldName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
		</div>
		<div class="text-gray-900 dark:text-white font-medium">
			{#if value === null || value === undefined || value === ''}
				<span class="text-gray-400 dark:text-gray-500 italic">Not specified</span>
			{:else if typeof value === 'boolean'}
				<span class="capitalize">{value ? 'Yes' : 'No'}</span>
			{:else if Array.isArray(value)}
				<span>{value.join(', ')}</span>
			{:else}
				<span class="whitespace-pre-wrap">{value}</span>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet renderField(fieldName: string, field: FieldSchema)}
	<div class="space-y-2">
		<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
			{field.original_name || fieldName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
			{#if field.required}
				<span class="text-red-500">*</span>
			{/if}
		</label>

		{#if field.ui_type === 'select' && field.options}
			<select
				bind:value={editedControl[fieldName]}
				disabled={!field.editable}
				class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400"
			>
				<option value="">-- Select --</option>
				{#each field.options as option}
					<option value={option}>{option}</option>
				{/each}
			</select>
		{:else if field.ui_type === 'textarea' || field.ui_type === 'long_text'}
			<textarea
				bind:value={editedControl[fieldName]}
				disabled={!field.editable}
				rows="8"
				class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed resize-y min-h-[120px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400"
				placeholder={field.examples?.[0] || ''}
			></textarea>
		{:else if field.ui_type === 'boolean'}
			<div class="flex items-center">
				<input
					type="checkbox"
					bind:checked={editedControl[fieldName]}
					disabled={!field.editable}
					class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
				/>
				<label class="ml-2 text-sm text-gray-900 dark:text-gray-300">
					{editedControl[fieldName] ? 'Yes' : 'No'}
				</label>
			</div>
		{:else if field.ui_type === 'date'}
			<input
				type="date"
				bind:value={editedControl[fieldName]}
				disabled={!field.editable}
				class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400"
			/>
		{:else if field.ui_type === 'number'}
			<input
				type="number"
				bind:value={editedControl[fieldName]}
				disabled={!field.editable}
				class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400"
			/>
		{:else}
			<!-- Default to text input -->
			<input
				type="text"
				bind:value={editedControl[fieldName]}
				disabled={!field.editable}
				class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400"
				placeholder={field.examples?.[0] || ''}
			/>
		{/if}

		{#if field.is_array}
			<p class="text-xs text-gray-500 dark:text-gray-400">This field supports multiple values</p>
		{/if}
	</div>
{/snippet}
