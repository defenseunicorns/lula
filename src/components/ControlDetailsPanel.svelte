<script lang="ts">
	import { run } from 'svelte/legacy';

	import { api } from '$lib/api';
	import type { Control, ControlCompleteData } from '$lib/types.js';
	import { Connect, Edit, Information, Time, View } from 'carbon-icons-svelte';
	import { complianceStore, mappings } from '../stores/compliance';
	import DiffViewer from './DiffViewer.svelte';
	import YamlDiffViewer from './YamlDiffViewer.svelte';
	import { modal } from '$lib/actions/modal';

	interface Props {
		control: Control;
	}

	let { control }: Props = $props();

	let editedControl = $state({ ...control });
	let originalControl = $state({ ...control });
	let activeTab = $state('details');
	let showNewMappingForm = $state(false);
	let completeData: ControlCompleteData | null = $state(null);
	let loadingCompleteData = $state(false);
	let expandedCommits = $state(new Set<string>()); // Track which commits have expanded diffs
	let fileModalContent = $state('');
	let fileModalTitle = $state('');
	let loadingFileContent = $state(false);
	let newMapping = $state({
		justification: '',
		status: 'planned' as 'planned' | 'implemented' | 'verified'
	});

	// Check if there are any changes
	let hasChanges = $derived(JSON.stringify(editedControl) !== JSON.stringify(originalControl));

	function handleSave() {
		complianceStore.updateControl(editedControl);
		// Update original control after save
		originalControl = { ...editedControl };
	}

	async function handleCreateMapping() {
		try {
			const mappingData = {
				control_id: control.id,
				justification: newMapping.justification,
				status: newMapping.status,
				source_entries: []
			};

			await complianceStore.createMapping(mappingData);

			// Reset form
			newMapping = {
				justification: '',
				status: 'planned'
			};
			showNewMappingForm = false;
		} catch (error) {
			console.error('Failed to create mapping:', error);
		}
	}

	function cancelNewMapping() {
		newMapping = {
			justification: '',
			status: 'planned'
		};
		showNewMappingForm = false;
	}

	async function loadCompleteData() {
		if (completeData || loadingCompleteData) return; // Don't load if already loaded or loading

		loadingCompleteData = true;
		try {
			console.log(`Loading complete data for control: ${control.id}`);
			completeData = await api.getControlComplete(control.id, 50); // Get last 50 commits
			console.log(`Loaded complete data:`, completeData);
		} catch (error) {
			console.error('Failed to load complete data:', error);
			// Create fallback data
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

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function toggleDiffExpansion(commitHash: string) {
		if (expandedCommits.has(commitHash)) {
			expandedCommits.delete(commitHash);
		} else {
			expandedCommits.add(commitHash);
		}
		expandedCommits = new Set(expandedCommits); // Trigger reactivity
	}

	function parseCCIsFromNarrative(narrative: string): string[] {
		const cciPattern = /CCI-(\d{6})/g;
		const matches = narrative.match(cciPattern);
		return matches ? [...new Set(matches)] : [];
	}

	let ccisInNarrative = $derived(parseCCIsFromNarrative(editedControl['control-implementation-narrative']));
	let associatedMappings =
		$derived(completeData?.mappings || $mappings.filter((m) => m.control_id === control.id));

	// Update editedControl when control prop changes
	run(() => {
		editedControl = { ...control };
		originalControl = { ...control };
		// Reset complete data when control changes
		completeData = null;
		loadingCompleteData = false;
		expandedCommits = new Set();
		// Switch back to details tab when control changes for better UX
		activeTab = 'details';
	});

	async function showFileAtCommit(commitHash: string, isMapping: boolean = false) {
		if (loadingFileContent) return;

		loadingFileContent = true;
		try {
			const type = isMapping ? 'mapping' : 'control';
			const family = isMapping ? control['control-acronym'].split('-')[0] : undefined;
			const controlId = !isMapping ? control.id : undefined;

			const result = await api.getFileContentAtCommit(commitHash, type, controlId, family);

			fileModalContent = result.content || 'File content not available';
			fileModalTitle = `${result.filePath} @ ${commitHash.substring(0, 7)}`;
		} catch (error) {
			console.error('Failed to load file content:', error);
			fileModalContent = 'Error loading file content';
			fileModalTitle = 'Error';
		} finally {
			loadingFileContent = false;
		}
	}

	// Get unified timeline from complete data
	let unifiedTimeline = $derived(completeData?.unifiedHistory.commits || []);

	// Load complete data when history tab is selected or when component mounts
	run(() => {
		if (activeTab === 'history') {
			loadCompleteData();
		}
	});

	// Proactively load complete data when control changes to show history count immediately
	run(() => {
		if (control) {
			loadCompleteData();
		}
	});
</script>

<div class="h-full flex flex-col">
	<!-- Card Header -->
	<div
		class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
	>
		<div>
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">
				{control['control-acronym']}
			</h2>
			<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
				{control['control-implementation-status']} • {control['compliance-status']}
			</p>
		</div>
		<button
			onclick={handleSave}
			disabled={!hasChanges}
			class="px-4 py-2 text-sm font-medium transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 {hasChanges
				? 'text-white bg-blue-600 border-transparent hover:bg-blue-700 focus:ring-blue-500'
				: 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 cursor-not-allowed'}"
		>
			{hasChanges ? 'Save Changes' : 'No Changes'}
		</button>
	</div>

	<!-- Tabs -->
	<div class="border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
		<nav class="flex space-x-8 px-6">
			<button
				onclick={() => (activeTab = 'details')}
				class="inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm {activeTab ===
				'details'
					? 'border-blue-500 text-blue-600 dark:text-blue-400'
					: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
			>
				<Information class="w-4 h-4 mr-2" />
				Details
			</button>
			<button
				onclick={() => (activeTab = 'narrative')}
				class="inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm {activeTab ===
				'narrative'
					? 'border-blue-500 text-blue-600 dark:text-blue-400'
					: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
			>
				<Edit class="w-4 h-4 mr-2" />
				Implementation
			</button>
			<button
				onclick={() => (activeTab = 'mappings')}
				class="inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm {activeTab ===
				'mappings'
					? 'border-blue-500 text-blue-600 dark:text-blue-400'
					: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
			>
				<Connect class="w-4 h-4 mr-2" />
				Mappings ({associatedMappings.length})
			</button>
			<button
				onclick={() => (activeTab = 'history')}
				class="inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm {activeTab ===
				'history'
					? 'border-blue-500 text-blue-600 dark:text-blue-400'
					: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
			>
				<Time class="w-4 h-4 mr-2" />
				Timeline {completeData?.unifiedHistory.totalCommits
					? `(${completeData.unifiedHistory.totalCommits})`
					: ''}
			</button>
		</nav>
	</div>

	<!-- Tab Content -->
	<div class="flex-1 overflow-auto">
		<div class="p-8">
			{#if activeTab === 'details'}
				<div class="space-y-6">
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						<div>
							<label
								for="control-id"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
								>Control ID</label
							>
							<input
								id="control-id"
								bind:value={editedControl.id}
								type="text"
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
							/>
						</div>
						<div>
							<label
								for="control-acronym"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
								>Control Acronym</label
							>
							<input
								id="control-acronym"
								bind:value={editedControl['control-acronym']}
								type="text"
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
						<div>
							<label
								for="implementation-status"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
								>Implementation Status</label
							>
							<select
								id="implementation-status"
								bind:value={editedControl['control-implementation-status']}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
							>
								<option>Implemented</option>
								<option>Planned</option>
								<option>Not Implemented</option>
							</select>
						</div>
						<div>
							<label
								for="compliance-status"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
								>Compliance Status</label
							>
							<select
								id="compliance-status"
								bind:value={editedControl['compliance-status']}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
							>
								<option>Compliant</option>
								<option>Non-Compliant</option>
								<option>Not Assessed</option>
							</select>
						</div>
						<div>
							<label
								for="security-control-designation"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
								>Security Control Designation</label
							>
							<select
								id="security-control-designation"
								bind:value={editedControl['security-control-designation']}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
							>
								<option>Common</option>
								<option>Hybrid</option>
								<option>System-Specific</option>
							</select>
						</div>
					</div>

					<div>
						<label
							for="control-information"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
							>Control Information</label
						>
						<textarea
							id="control-information"
							bind:value={editedControl['control-information']}
							rows="12"
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-vertical"
						></textarea>
					</div>
				</div>
			{:else if activeTab === 'narrative'}
				<div class="space-y-6">
					<div>
						<label
							for="implementation-narrative"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>Implementation Narrative</label
						>
						<textarea
							id="implementation-narrative"
							bind:value={editedControl['control-implementation-narrative']}
							rows="8"
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
						></textarea>
					</div>

					{#if ccisInNarrative.length > 0}
						<div>
							<div class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								CCIs Found in Narrative
							</div>
							<div class="flex flex-wrap gap-2">
								{#each ccisInNarrative as cci}
									<span
										class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
									>
										{cci}
									</span>
								{/each}
							</div>
						</div>
					{/if}

					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div>
							<label
								for="cci"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CCI</label
							>
							<input
								id="cci"
								bind:value={editedControl.cci}
								type="text"
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
							/>
						</div>
						<div>
							<label
								for="inherited"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
								>Inherited</label
							>
							<input
								id="inherited"
								bind:value={editedControl.inherited}
								type="text"
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
							/>
						</div>
					</div>

					<div>
						<label
							for="cci-definition"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>CCI Definition</label
						>
						<textarea
							id="cci-definition"
							bind:value={editedControl['cci-definition']}
							rows="3"
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
						></textarea>
					</div>

					<div>
						<label
							for="implementation-guidance"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>Implementation Guidance</label
						>
						<textarea
							id="implementation-guidance"
							bind:value={editedControl['implementation-guidance']}
							rows="4"
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
						></textarea>
					</div>

					<div>
						<label
							for="assessment-procedures"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>Assessment Procedures</label
						>
						<textarea
							id="assessment-procedures"
							bind:value={editedControl['assessment-procedures']}
							rows="4"
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
						></textarea>
					</div>

					<div>
						<label
							for="test-results"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>Test Results</label
						>
						<textarea
							id="test-results"
							bind:value={editedControl['test-results']}
							rows="3"
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
						></textarea>
					</div>
				</div>
			{:else if activeTab === 'mappings'}
				<div class="space-y-6">
					<!-- Add New Mapping Section -->
					<div class="border-b border-gray-200 dark:border-gray-700 pb-4">
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
							<div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4">
								<h4 class="text-lg font-medium text-gray-900 dark:text-white">
									Create New Mapping
								</h4>

								<div class="grid grid-cols-1 gap-4">
									<div>
										<label
											for="mapping-status"
											class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
											>Status</label
										>
										<select
											id="mapping-status"
											bind:value={newMapping.status}
											class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
										>
											<option>planned</option>
											<option>implemented</option>
											<option>verified</option>
										</select>
									</div>
								</div>

								<div>
									<label
										for="mapping-justification"
										class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
										>Justification</label
									>
									<textarea
										id="mapping-justification"
										bind:value={newMapping.justification}
										rows="4"
										placeholder="Explain why this mapping is necessary..."
										class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
									></textarea>
								</div>

								<div class="flex justify-end space-x-3">
									<button
										onclick={cancelNewMapping}
										class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500"
									>
										Cancel
									</button>
									<button
										onclick={handleCreateMapping}
										disabled={!newMapping.justification.trim()}
										class="px-4 py-2 text-sm font-medium transition-colors rounded-md {newMapping.justification.trim()
											? 'text-white bg-blue-600 hover:bg-blue-700'
											: 'text-gray-400 bg-gray-200 dark:bg-gray-600 cursor-not-allowed'}"
									>
										Create Mapping
									</button>
								</div>
							</div>
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
									<div
										class="bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
									>
										<!-- Header section with darker background -->
										<div
											class="bg-slate-100 dark:bg-slate-800 rounded-t-xl px-6 py-4 border-b border-slate-200 dark:border-slate-700"
										>
											<div class="flex justify-between items-start">
												<span
													class="inline-flex items-center px-3 py-1 rounded-lg text-xs font-mono font-medium bg-slate-800 dark:bg-slate-900 text-slate-100 dark:text-slate-200 shadow-sm"
													>@mapControl {mapping.uuid}</span
												>
												<button
													onclick={() =>
														navigator.clipboard.writeText(`@mapControl ${mapping.uuid}`)}
													class="inline-flex items-center px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-all duration-200 shadow-sm hover:shadow"
												>
													Copy UUID
												</button>
											</div>
										</div>

										<!-- Content section -->
										<div class="px-6 py-4">
											<p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
												{mapping.justification}
											</p>
											<div class="flex items-center justify-start">
												<span
													class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium shadow-sm {mapping.status ===
													'implemented'
														? 'bg-green-500 text-white'
														: mapping.status === 'verified'
															? 'bg-blue-500 text-white'
															: 'bg-yellow-500 text-white'}">Status: {mapping.status}</span
												>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<div class="text-center py-8">
								<svg
									class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
								<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
									No mappings yet
								</h3>
								<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
									Create your first mapping for this control.
								</p>
							</div>
						{/if}
					</div>
				</div>
			{:else if activeTab === 'history'}
				<div class="space-y-6">
					<!-- Timeline -->
					<div class="space-y-6">
						{#if loadingCompleteData}
							<div class="flex items-center justify-center py-16">
								<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
								<span class="ml-3 text-gray-600 dark:text-gray-400"
									>Loading activity timeline...</span
								>
							</div>
						{:else if unifiedTimeline.length > 0}
							<div class="space-y-6">
								{#each unifiedTimeline as commit}
									<div class="relative">
										<!-- Timeline connector line -->
										{#if commit !== unifiedTimeline[unifiedTimeline.length - 1]}
											<div
												class="absolute left-3 top-16 w-0.5 h-6 bg-gradient-to-b from-gray-300 to-transparent dark:from-gray-600"
											></div>
										{/if}

										<!-- Commit card -->
										<div
											class="relative bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
										>
											<!-- Header section with darker background -->
											<div
												class="bg-slate-100 dark:bg-slate-800 rounded-t-xl px-6 py-4 border-b border-slate-200 dark:border-slate-700"
											>
												<div class="flex items-center justify-between">
													<div class="flex items-center space-x-3">
														<span
															class="inline-flex items-center px-3 py-1 rounded-lg text-xs font-mono font-medium bg-slate-800 dark:bg-slate-900 text-slate-100 dark:text-slate-200 shadow-sm"
														>
															{commit.shortHash}
														</span>
														<span
															class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium shadow-sm {commit.type ===
															'control'
																? 'bg-purple-500 text-white'
																: 'bg-amber-500 text-white'}"
														>
															{commit.fileType === 'Control File' ? 'Controls' : 'Mappings'}
														</span>
													</div>
													<div class="text-right">
														<div class="text-sm font-medium text-slate-900 dark:text-slate-100">
															{commit.author}
														</div>
														<div class="text-xs text-slate-500 dark:text-slate-400">
															{formatDate(commit.date)}
														</div>
													</div>
												</div>
											</div>

											<!-- Content section -->
											<div class="px-6 py-4">
												<p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
													{commit.message}
												</p>

												<!-- Action buttons -->
												<div class="flex items-center justify-between">
													<button
														class="inline-flex items-center px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-all duration-200 shadow-sm hover:shadow"
														title="View file content at this commit"
														disabled={loadingFileContent}
														onclick={() => showFileAtCommit(commit.hash, commit.type === 'mapping')}
													>
														<View class="w-3.5 h-3.5 mr-2" />
														{loadingFileContent ? 'Loading...' : 'View File'}
														
														<!-- Modal using modal action -->
														<div use:modal style="display: none;">
															<div class="modal-content fixed inset-0 z-50 flex items-center justify-center p-4">
																<div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
																	<!-- Modal Header -->
																	<div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
																		<div>
																			<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
																				{fileModalTitle}
																			</h3>
																			<p class="text-sm text-gray-500 dark:text-gray-400">
																				Commit: {commit.hash.substring(0, 7)} by {commit.author} on {new Date(commit.date).toLocaleDateString()}
																			</p>
																		</div>
																	</div>
																	<!-- Modal Body -->
																	<div class="p-6 max-h-96 overflow-y-auto">
																		<pre class="text-sm bg-gray-50 dark:bg-gray-900 rounded-lg p-4 font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap overflow-x-auto">{fileModalContent}</pre>
																	</div>
																</div>
															</div>
														</div>
													</button>

													{#if commit.diff && !commit.yamlDiff?.hasChanges}
														<button
															onclick={() => toggleDiffExpansion(commit.hash)}
															class="inline-flex items-center px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all duration-200 shadow-sm hover:shadow"
														>
															<svg
																class="w-3.5 h-3.5 mr-2 {expandedCommits.has(commit.hash)
																	? 'rotate-180'
																	: ''} transition-transform duration-200"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	stroke-width="2"
																	d="M19 9l-7 7-7-7"
																/>
															</svg>
															{expandedCommits.has(commit.hash) ? 'Hide' : 'Show'} Diff
														</button>
													{/if}
												</div>
											</div>

											<!-- Diff section -->
											{#if commit.yamlDiff && commit.yamlDiff.hasChanges}
												<div class="rounded-b-xl p-4">
													<YamlDiffViewer yamlDiff={commit.yamlDiff} />
												</div>
											{:else if commit.diff && expandedCommits.has(commit.hash)}
												<div class="rounded-b-xl p-4">
													<DiffViewer
														diff={commit.diff}
														fileName={commit.type === 'mapping'
															? `${control['control-acronym'].split('-')[0]}-mappings.yaml`
															: control.id + '.yaml'}
														language="yaml"
														compact={true}
													/>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<div class="text-center py-12">
								<svg
									class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
									/>
								</svg>
								<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
									No activity history found
								</h3>
								<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
									{#if completeData?.unifiedHistory.totalCommits === 0}
										This control and its mapping files are new and haven't been committed to git
										yet.
									{:else}
										Unable to load git history for this control and its mappings.
									{/if}
								</p>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
