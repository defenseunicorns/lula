<script lang="ts">
	import { api } from '$lib/api';
	import type { Control, ControlCompleteData, ControlSet } from '$lib/types.js';
	import { Connect, Edit, Information, Time } from 'carbon-icons-svelte';
	import { complianceStore, mappings } from '../stores/compliance';
	import { StatusBadge, TabNavigation, EmptyState } from './ui';
	import { FormField, DynamicControlForm } from './forms';
	import { MappingCard, MappingForm } from './controls';
	import { TimelineItem } from './timeline';

	interface Props {
		control: Control;
		useDynamicForms: boolean;
	}

	let { control, useDynamicForms }: Props = $props();

	// Load control set schema for dynamic forms
	let controlSet: ControlSet | null = $state(null);

	// Component state
	let editedControl = $state({ 
		...control, 
		inherited: control.inherited || '',
		'test-results': control['test-results'] || ''
	});
	let originalControl = $state({ ...control });
	let activeTab = $state<'details' | 'narrative' | 'mappings' | 'history'>('details');
	let showNewMappingForm = $state(false);
	let editingMapping = $state<any>(null);
	let autoSaveInterval: ReturnType<typeof setInterval> | null = null;
	
	// Data loading state
	let completeData: ControlCompleteData | null = $state(null);
	let loadingCompleteData = $state(false);
	
	
	
	// Form state
	let newMappingData = $state({
		justification: '',
		status: 'planned' as 'planned' | 'implemented' | 'verified'
	});

	// Derived values
	const hasChanges = $derived(JSON.stringify(editedControl) !== JSON.stringify(originalControl));
	const ccisInNarrative = $derived(parseCCIsFromNarrative(editedControl['control-implementation-narrative'] || ''));
	const associatedMappings = $derived(completeData?.mappings || $mappings.filter((m) => m.control_id === control.id));
	const unifiedTimeline = $derived(completeData?.unifiedHistory.commits || []);
	const saveStatus = $derived(hasChanges ? 'unsaved' : 'saved');
	const isAutoSaving = $derived(false); // We'll keep this simple for now

	// Effects
	$effect(() => {
		// Reset component state when control changes
		// Clear any existing auto-save interval
		if (autoSaveInterval) {
			clearInterval(autoSaveInterval);
		}
		
		editedControl = { 
			...control, 
			inherited: control.inherited || '',
			'test-results': control['test-results'] || ''
		};
		originalControl = { 
			...control, 
			inherited: control.inherited || '',
			'test-results': control['test-results'] || ''
		};
		completeData = null;
		loadingCompleteData = false;
		activeTab = 'details';
		editingMapping = null;
		
		// Start auto-save interval
		autoSaveInterval = setInterval(checkAndSave, 10000); // Check every 10 seconds
		
		// Cleanup on component unmount
		return () => {
			if (autoSaveInterval) {
				clearInterval(autoSaveInterval);
			}
		};
	});

	// Auto-save function that runs periodically
	async function checkAndSave() {
		if (hasChanges) {
			try {
				await complianceStore.updateControl(editedControl);
				originalControl = { ...editedControl };
				console.log('Auto-saved control changes');
			} catch (error) {
				console.error('Auto-save failed:', error);
			}
		}
	}

	// Keyboard shortcut for manual save
	$effect(() => {
		function handleKeydown(event: KeyboardEvent) {
			if ((event.ctrlKey || event.metaKey) && event.key === 's') {
				event.preventDefault();
				if (hasChanges) {
					handleSave();
				}
			}
		}

		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});

	$effect(() => {
		// Load complete data when history tab is selected or when component mounts
		if (activeTab === 'history' || control) {
			loadCompleteData();
		}
	});

	$effect(() => {
		// Load control set schema when component mounts
		loadControlSet();
	});

	// Event handlers
	async function handleSave() {
		// No need to cancel anything for manual save
		
		try {
			await complianceStore.updateControl(editedControl);
			originalControl = { ...editedControl };
			console.log('Manual save completed');
		} catch (error) {
			console.error('Manual save failed:', error);
		}
	}

	async function handleCreateMapping(data: typeof newMappingData) {
		try {
			const mappingData = {
				control_id: control.id,
				justification: data.justification,
				status: data.status,
				source_entries: []
			};

			await complianceStore.createMapping(mappingData);
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

			await complianceStore.updateMapping(updatedMapping);
			resetMappingForm();
		} catch (error) {
			console.error('Failed to update mapping:', error);
		}
	}

	async function handleDeleteMapping(uuid: string) {
		try {
			await complianceStore.deleteMapping(uuid);
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
	async function loadControlSet() {
		try {
			controlSet = await api.getControlSet();
		} catch (error) {
			console.error('Failed to load control set:', error);
		}
	}

	async function loadCompleteData() {
		if (completeData || loadingCompleteData) return;

		loadingCompleteData = true;
		try {
			completeData = await api.getControlComplete(control.id, 50);
		} catch (error) {
			console.error('Failed to load complete data:', error);
			completeData = {
				control,
				mappings: $mappings.filter((m) => m.control_id === control.id),
				unifiedHistory: {
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


	function parseCCIsFromNarrative(narrative: string): string[] {
		const cciPattern = /CCI-(\d{6})/g;
		const matches = narrative.match(cciPattern);
		return matches ? [...new Set(matches)] : [];
	}
</script>

<div class="h-full flex flex-col">
	<!-- Card Header -->
	<header class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
		<div>
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">
				{control['control-acronym']}
			</h2>
			<div class="flex items-center space-x-3 mt-1">
				<p class="text-sm text-gray-600 dark:text-gray-400">
					{control['control-implementation-status']} • {control['compliance-status']}
				</p>
				<StatusBadge 
					status={editedControl['control-implementation-status']} 
					type="control" 
					size="sm"
				/>
			</div>
		</div>
		<div class="flex items-center space-x-3">
			<div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
				{#if isAutoSaving || saveStatus === 'unsaved'}
					<svg class="w-4 h-4 mr-1 text-amber-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clip-rule="evenodd" />
					</svg>
					{isAutoSaving ? 'Auto-saving...' : 'Changes pending...'}
				{:else}
					<svg class="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.236 4.53L8.083 10.5a.75.75 0 00-1.166 1.166l1.714 1.714a.75.75 0 001.19-.236l3.857-5.389z" clip-rule="evenodd" />
					</svg>
					All changes saved
				{/if}
			</div>
			{#if hasChanges}
				<button
					onclick={handleSave}
					class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
					title="Save changes now (Ctrl+S)"
				>
					Save Now
				</button>
			{/if}
		</div>
	</header>

	<!-- Tabs -->
	<TabNavigation
		active={activeTab}
		tabs={[
			{ id: 'details', label: 'Details', icon: Information },
			{ id: 'narrative', label: 'Implementation', icon: Edit },
			{ id: 'mappings', label: 'Mappings', icon: Connect, count: associatedMappings.length },
			{ id: 'history', label: completeData?.unifiedHistory.totalCommits ? `Timeline (${completeData.unifiedHistory.totalCommits})` : 'Timeline', icon: Time }
		]}
		onSelect={(tabId) => activeTab = tabId as typeof activeTab}
	/>

	<!-- Tab Content -->
	<main class="flex-1 overflow-auto">
		<div class="p-6">
			{#if activeTab === 'details'}
				{@render detailsTab()}
			{:else if activeTab === 'narrative'}
				{@render narrativeTab()}
			{:else if activeTab === 'mappings'}
				{@render mappingsTab()}
			{:else if activeTab === 'history'}
				{@render historyTab()}
			{/if}
		</div>
	</main>
</div>

{#snippet detailsTab()}
	{#if useDynamicForms}
		<DynamicControlForm
			bind:control={editedControl}
			schema={controlSet?.schema ? {
				name: controlSet.schema.name,
				version: controlSet.schema.version,
				description: 'Control identification and basic information',
				fields: controlSet.schema.fields.filter(f => 
					f.group === 'identification' || f.group === 'description'
				).map(f => ({
					id: f.id,
					label: f.label,
					type: f.type === 'multi-select' ? 'multiselect' : f.type,
					required: f.required || false,
					options: f.options,
					description: f.description,
					group: f.group
				}))
			} : { name: 'Loading...', version: '0.0.0', description: 'Loading schema...', fields: [] }}
		/>
	{:else}
		<!-- Legacy static form with clean sections -->
		<div class="space-y-8">
			<!-- Identification Section -->
			<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
				<div class="border-b border-slate-200 dark:border-slate-700 px-6 py-4">
					<h3 class="text-lg font-medium text-slate-900 dark:text-white">Identification</h3>
				</div>
				<div class="p-6">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<FormField
							id="control-id"
							label="Control ID"
							bind:value={editedControl.id}
						/>
						<FormField
							id="control-acronym"
							label="Control Acronym"
							bind:value={editedControl['control-acronym']}
						/>
					</div>
				</div>
			</div>

			<!-- Status Section -->
			<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
				<div class="border-b border-slate-200 dark:border-slate-700 px-6 py-4">
					<h3 class="text-lg font-medium text-slate-900 dark:text-white">Status & Classification</h3>
				</div>
				<div class="p-6">
					<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
						<FormField
							id="implementation-status"
							label="Implementation Status"
							type="select"
							bind:value={editedControl['control-implementation-status']}
							options={['Implemented', 'Planned', 'Not Implemented']}
						/>
						<FormField
							id="compliance-status"
							label="Compliance Status"
							type="select"
							bind:value={editedControl['compliance-status']}
							options={['Compliant', 'Non-Compliant', 'Not Assessed']}
						/>
						<FormField
							id="security-control-designation"
							label="Security Control Designation"
							type="select"
							bind:value={editedControl['security-control-designation']}
							options={['Common', 'Hybrid', 'System-Specific']}
						/>
					</div>
				</div>
			</div>

			<!-- Description Section -->
			<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
				<div class="border-b border-slate-200 dark:border-slate-700 px-6 py-4">
					<h3 class="text-lg font-medium text-slate-900 dark:text-white">Description</h3>
				</div>
				<div class="p-6">
					<FormField
						id="control-information"
						label="Control Information"
						type="textarea"
						bind:value={editedControl['control-information']}
						rows={12}
					/>
				</div>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet narrativeTab()}
	{#if useDynamicForms}
		<DynamicControlForm
			bind:control={editedControl}
			schema={controlSet?.schema ? {
				name: controlSet.schema.name,
				version: controlSet.schema.version,
				description: 'Control implementation and compliance details',
				fields: controlSet.schema.fields.filter(f => 
					f.group === 'implementation' || f.group === 'compliance'
				).map(f => ({
					id: f.id,
					label: f.label,
					type: f.type === 'multi-select' ? 'multiselect' : f.type,
					required: f.required || false,
					options: f.options,
					description: f.description,
					group: f.group
				}))
			} : { name: 'Loading...', version: '0.0.0', description: 'Loading schema...', fields: [] }}
		/>
		
		{#if ccisInNarrative.length > 0}
			<div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
				<div class="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
					CCIs Found in Narrative
				</div>
				<div class="flex flex-wrap gap-2">
					{#each ccisInNarrative as cci}
						<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
							{cci}
						</span>
					{/each}
				</div>
			</div>
		{/if}
	{:else}
		<!-- Legacy static form -->
		<div class="space-y-6">
			<FormField
				id="implementation-narrative"
				label="Implementation Narrative"
				type="textarea"
				bind:value={editedControl['control-implementation-narrative']}
				rows={8}
			/>

			{#if ccisInNarrative.length > 0}
				<div>
					<div class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						CCIs Found in Narrative
					</div>
					<div class="flex flex-wrap gap-2">
						{#each ccisInNarrative as cci}
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
								{cci}
							</span>
						{/each}
					</div>
				</div>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<FormField
					id="cci"
					label="CCI"
					bind:value={editedControl.cci}
				/>
				<FormField
					id="inherited"
					label="Inherited"
					bind:value={editedControl.inherited}
				/>
			</div>

			<FormField
				id="cci-definition"
				label="CCI Definition"
				type="textarea"
				bind:value={editedControl['cci-definition']}
				rows={3}
			/>

			<FormField
				id="implementation-guidance"
				label="Implementation Guidance"
				type="textarea"
				bind:value={editedControl['implementation-guidance']}
				rows={4}
			/>

			<FormField
				id="assessment-procedures"
				label="Assessment Procedures"
				type="textarea"
				bind:value={editedControl['assessment-procedures']}
				rows={4}
			/>

			<FormField
				id="test-results"
				label="Test Results"
				type="textarea"
				bind:value={editedControl['test-results']}
				rows={3}
			/>
		</div>
	{/if}
{/snippet}

{#snippet mappingsTab()}
	<div class="space-y-6">
		<!-- Add New Mapping Section -->
		<div class="border-b border-gray-200 dark:border-gray-700 pb-4">
			{#if !showNewMappingForm}
				<button
					onclick={() => (showNewMappingForm = true)}
					class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				>
					<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
					</svg>
					Add New Mapping
				</button>
			{:else}
				<MappingForm
					initialData={newMappingData}
					onSubmit={editingMapping ? handleUpdateMapping : handleCreateMapping}
					onCancel={cancelNewMapping}
					submitLabel={editingMapping ? 'Update Mapping' : 'Create Mapping'}
				/>
			{/if}
		</div>

		<!-- Existing Mappings -->
		<div>
			{#if associatedMappings.length > 0}
				<h4 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
					Existing Mappings ({associatedMappings.length})
				</h4>
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
			{:else}
				<EmptyState
					title="No mappings yet"
					description="Create your first mapping for this control."
				/>
			{/if}
		</div>
	</div>
{/snippet}




{#snippet historyTab()}
	<div class="space-y-6">
		{#if loadingCompleteData}
			<div class="flex items-center justify-center py-16">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
				<span class="ml-3 text-gray-600 dark:text-gray-400">Loading activity timeline...</span>
			</div>
		{:else if unifiedTimeline.length > 0}
			<div class="space-y-6">
				{#each unifiedTimeline as commit, index}
					<TimelineItem
						{commit}
						showConnector={index < unifiedTimeline.length - 1}
					/>
				{/each}
			</div>
		{:else}
			<EmptyState
				title="No activity history found"
				description={completeData?.unifiedHistory.totalCommits === 0 
					? "This control and its mapping files are new and haven't been committed to git yet."
					: "Unable to load git history for this control and its mappings."}
				size="lg"
			/>
		{/if}
	</div>
{/snippet}


