<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import type { Control } from '$lib/types';
	import { appState, wsClient } from '$lib/websocket';
	import {
		CheckmarkFilled,
		Connect,
		Edit,
		Information,
		InProgress,
		Time,
		WarningFilled
	} from 'carbon-icons-svelte';
	import { TabNavigation } from '../ui';
	import {
		CustomFieldsTab,
		ImplementationTab,
		MappingsTab,
		OverviewTab,
		TimelineTab
	} from './tabs';

	interface Props {
		control: Control;
	}

	let { control }: Props = $props();

	// Component state - initialize with reactive derived values
	let editedControl = $state<Control>({ ...control });
	let originalControl = $state<Control>({ ...control });
	let activeTab = $state<'details' | 'narrative' | 'custom' | 'mappings' | 'history'>('details');
	let saveDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
	let isSaving = $state(false);
	let showSavedMessage = $state(false);
	let savedMessageTimeout: ReturnType<typeof setTimeout> | null = null;

	// Derived values
	const fieldSchema = $derived($appState.fieldSchema.fields);
	const hasChanges = $derived(JSON.stringify(editedControl) !== JSON.stringify(originalControl));
	const associatedMappings = $derived(
		$appState.mappings.filter((m) => m.control_id === control.id)
	);
	const saveStatus = $derived(
		isSaving ? 'saving' : (hasChanges ? 'unsaved' : (showSavedMessage ? 'just-saved' : 'clean'))
	);
	
	// Formatted control with CCI definitions properly split
	const formattedControl = $derived.by(() => {
		// Create a view model based on editedControl without mutating it
		const viewModel = { ...editedControl };
		
		const cciDefinition = viewModel.cci_definition || viewModel['cci-definition'];
		if (viewModel.cci && cciDefinition) {
			// Split the CCI list, handling semicolon separation
			const cciList = viewModel.cci
				.split(';')
				.map((cci: string) => cci.trim())
				.filter((cci: string) => cci.length > 0);
			
			// Only format if there are multiple CCIs
			if (cciList.length > 1) {
				const definitions = cciDefinition;
				const formattedDefinitions: string[] = [];
				
				// For each CCI in the list, try to extract its definition
				for (const cci of cciList) {
					const pattern = new RegExp(`${cci}:\\s*([^;]+)(?:;|$)`, 'i');
					const match = definitions.match(pattern);
					
					if (match) {
						const definition = match[1].trim();
						// Remove any trailing period and add it back for consistency
						const cleanDefinition = definition.replace(/\.$/, '');
						formattedDefinitions.push(`${cci}: ${cleanDefinition}.`);
					} else {
						// If pattern matching fails, look for the CCI anywhere in the string
						// and try to extract the text that follows it
						const fallbackPattern = new RegExp(`${cci}[^;]*`, 'i');
						const fallbackMatch = definitions.match(fallbackPattern);
						if (fallbackMatch) {
							formattedDefinitions.push(fallbackMatch[0].trim());
						}
					}
				}
				
				if (formattedDefinitions.length > 0) {
					viewModel.cci_definition = formattedDefinitions.join('\n\n');
					viewModel['cci-definition'] = formattedDefinitions.join('\n\n');
				}
			}
		}
		
		return viewModel;
	});
	
	// Check if tabs have any fields
	const hasCustomFields = $derived(() => {
		if (!fieldSchema) return false;
		return Object.values(fieldSchema).some((field: any) => field.tab === 'custom');
	});
	
	const hasImplementationFields = $derived(() => {
		if (!fieldSchema) return false;
		return Object.values(fieldSchema).some((field: any) => field.tab === 'implementation');
	});

	// Watch for control changes - only reset when ID changes
	$effect(() => {
		// Access control within the effect to properly track changes
		const currentControl = control;
		if (currentControl.id !== editedControl?.id) {
			if (saveDebounceTimeout) {
				clearTimeout(saveDebounceTimeout);
			}
			editedControl = { ...currentControl };
			originalControl = { ...currentControl };
			activeTab = 'details';
		}
	});

	// Manual trigger for auto-save when field changes
	function triggerAutoSave() {
		if (!hasChanges) return;
		
		// Clear any existing save timeout
		if (saveDebounceTimeout) {
			clearTimeout(saveDebounceTimeout);
		}
		
		// Debounce the save by 500ms to avoid too many saves while typing
		saveDebounceTimeout = setTimeout(() => {
			performSave();
		}, 500);
	}

	// Perform the actual save
	async function performSave() {
		if (!hasChanges || isSaving) return;
		
		isSaving = true;
		try {
			// Only send the fields that have actually changed
			const changes: Record<string, any> = { id: editedControl.id };
			
			// Compare each field and only include changed ones
			for (const [key, value] of Object.entries(editedControl)) {
				// Skip runtime fields
				if (key === 'timeline' || key === 'unifiedHistory' || key === '_metadata') {
					continue;
				}
				
				// Only include if value has changed
				if (JSON.stringify(value) !== JSON.stringify(originalControl[key])) {
					changes[key] = value;
				}
			}
			
			// Only send if there are actual changes beyond the ID
			if (Object.keys(changes).length > 1) {
				await wsClient.updateControl(changes as Control);
				originalControl = { ...editedControl };
				showTemporarySavedMessage();
				console.log('Saved changes:', Object.keys(changes).filter(k => k !== 'id').join(', '));
			}
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

	// Handle field changes from custom tab
	function handleFieldChange(_fieldName: string, _value: any) {
		triggerAutoSave();
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
					<p class="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
						{control.title}
					</p>
				</div>
			</div>
			<div class="flex items-center">
				<!-- Save status icon indicator -->
				{#if saveStatus === 'saving'}
					<div
						class="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30"
						title="Saving..."
					>
						<InProgress class="w-5 h-5 text-blue-600 dark:text-blue-400" />
					</div>
				{:else if saveStatus === 'unsaved'}
					<div
						class="w-8 h-8 flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30"
						title="Unsaved changes"
					>
						<WarningFilled class="w-5 h-5 text-amber-600 dark:text-amber-400" />
					</div>
				{:else if saveStatus === 'just-saved'}
					<div
						class="w-8 h-8 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 animate-fade-in"
						title="Saved"
					>
						<CheckmarkFilled class="w-5 h-5 text-green-600 dark:text-green-400" />
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
			...(hasImplementationFields() ? [{ id: 'narrative', label: 'Implementation', icon: Edit }] : []),
			...(hasCustomFields() ? [{ id: 'custom', label: 'Custom', icon: Edit }] : []),
			{ id: 'mappings', label: 'Mappings', icon: Connect, count: associatedMappings.length },
			{
				id: 'history',
				label: 'Timeline',
				icon: Time,
				count: control.timeline?.totalCommits
			}
		]}
		onSelect={(tabId) => (activeTab = tabId as typeof activeTab)}
	/>
</div>

<!-- Tab content without card wrapper -->
<main class="flex-1 overflow-auto pt-4">
	<div class="">
		{#if activeTab === 'details'}
			<OverviewTab control={formattedControl} {fieldSchema} />
		{:else if activeTab === 'narrative'}
			<ImplementationTab control={formattedControl} {fieldSchema} />
		{:else if activeTab === 'custom'}
			<CustomFieldsTab 
				control={editedControl} 
				{fieldSchema} 
				onFieldChange={handleFieldChange}
			/>
		{:else if activeTab === 'mappings'}
			<MappingsTab 
				control={formattedControl} 
				mappings={associatedMappings} 
			/>
		{:else if activeTab === 'history'}
			<TimelineTab 
				timeline={control.timeline}
			/>
		{/if}
	</div>
</main>
