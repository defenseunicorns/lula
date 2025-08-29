<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { goto } from '$app/navigation';
	import { Dropdown, SearchBar } from '$components/ui';
	import { tooltip } from '$lib/actions/tooltip';
	import type { Control } from '$lib/types';
	import {
		complianceStore,
		controls,
		controlsWithMappings,
		families,
		searchTerm,
		selectedControl,
		selectedFamily
	} from '$stores/compliance';
	import { Filter } from 'carbon-icons-svelte';
	import { derived } from 'svelte/store';

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
</script>

<div class="h-full flex flex-col">
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
		</div>

		<!-- Scrollable Table Body -->
		<div class="flex-1 overflow-auto">
			<div class="divide-y divide-gray-200 dark:divide-gray-700">
				{#each $filteredControlsWithMappings as control}
					{@const rawDescription =
						control['control-information'] ||
						control['cci-definition'] ||
						control['implementation-guidance'] ||
						control.title ||
						'No description available'}
					{@const description = extractDescriptionFromNested(rawDescription)}
					{@const cleanDescription =
						description
							.replace(/^(a\.|b\.|1\.|2\.|\s|The organization:)+/, '')
							.replace(/\s+/g, ' ')
							.trim()
							.substring(0, 200) + (description.length > 200 ? '...' : '')}
					<div
						class="grid grid-cols-5 gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-all duration-150 {$selectedControl?.id ===
						control.id
							? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 shadow-sm'
							: ''}"
						onclick={() => selectControl(control)}
						onkeydown={(e) => (e.key === 'Enter' || e.key === ' ' ? selectControl(control) : null)}
						role="button"
						tabindex="0"
						aria-label="Select control {control.id}"
					>
						<!-- Control Column -->
						<div class="flex flex-col justify-center">
							<div class="text-sm font-semibold text-gray-900 dark:text-white">
								{control.id}
							</div>
							<div class="text-xs text-gray-500 dark:text-gray-400 font-medium">
								{control.class || 'OSCAL'}
							</div>
						</div>
						<!-- Title Column -->
						<div class="flex flex-col justify-center">
							<div class="text-sm text-gray-900 dark:text-white font-medium">
								{control.title ||
									(control['control-information']
										? Array.isArray(control['control-information'])
											? typeof control['control-information'][0] === 'string'
												? control['control-information'][0]?.trim() || 'No Title'
												: typeof control['control-information'][0] === 'object'
													? Object.keys(control['control-information'][0])[0]?.replace(/:$/, '') ||
														'No Title'
													: 'No Title'
											: control['control-information'].split('\n')[0].trim()
										: 'No Title')}
							</div>
						</div>
						<!-- Statement Column -->
						<div class="flex flex-col justify-center">
							<div class="text-sm text-gray-900 dark:text-white line-clamp-2">
								{cleanDescription.substring(0, 120)}{cleanDescription.length > 120 ? '...' : ''}
							</div>
						</div>
						<!-- Family Column -->
						<div class="flex items-center justify-center">
							<span
								class="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
							>
								{(control.family || control['control-acronym']?.split('-')[0] || '').toUpperCase()}
							</span>
						</div>
						<!-- Mappings Column -->
						<div class="flex items-center justify-center">
							<span
								class="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
							>
								{control.mappings.length}
							</span>
						</div>
					</div>
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
</div>
