<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import type { Control } from '$lib/types';
	import { appState, wsClient } from '$lib/websocket';
	import {
		Connect,
		Edit,
		Information,
		Time
	} from 'carbon-icons-svelte';
	import { TabNavigation } from '../ui';
	import { 
		OverviewTab, 
		ImplementationTab, 
		CustomFieldsTab, 
		MappingsTab, 
		TimelineTab 
	} from './tabs';

	interface Props {
		control: Control;
	}

	let { control }: Props = $props();

	// Component state
	let editedControl = $state({ ...control });
	let originalControl = $state({ ...control });
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

	// Watch for control changes - only reset when ID changes
	$effect(() => {
		if (control.id !== editedControl?.id) {
			if (saveDebounceTimeout) {
				clearTimeout(saveDebounceTimeout);
			}
			editedControl = { ...control };
			originalControl = { ...control };
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
	function handleFieldChange(fieldName: string, value: any) {
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
			{ id: 'custom', label: 'Custom', icon: Edit },
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
			<OverviewTab control={editedControl} {fieldSchema} />
		{:else if activeTab === 'narrative'}
			<ImplementationTab control={editedControl} {fieldSchema} />
		{:else if activeTab === 'custom'}
			<CustomFieldsTab 
				control={editedControl} 
				{fieldSchema} 
				onFieldChange={handleFieldChange}
			/>
		{:else if activeTab === 'mappings'}
			<MappingsTab 
				{control} 
				mappings={associatedMappings} 
			/>
		{:else if activeTab === 'history'}
			<TimelineTab 
				{control} 
				timeline={control.timeline}
			/>
		{/if}
	</div>
</main>