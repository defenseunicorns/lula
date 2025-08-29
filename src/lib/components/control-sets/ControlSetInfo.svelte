<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { onMount } from 'svelte';
	import type { ControlSet } from '$lib/types';

	interface Props {
		controlSet?: ControlSet | null;
	}

	let { controlSet = $bindable(null) }: Props = $props();
	let loading = $state(true);

	onMount(async () => {
		try {
			const response = await fetch('/api/control-set');
			if (response.ok) {
				controlSet = await response.json();
			}
		} catch (error) {
			console.error('Failed to load control set info:', error);
		} finally {
			loading = false;
		}
	});
</script>

{#if loading}
	<div class="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
{:else if controlSet && controlSet.name !== 'Unknown Control Set' && controlSet.id !== 'unknown'}
	<div class="text-sm">
		<div class="font-medium text-gray-900 dark:text-white">
			{controlSet.title || controlSet.name}
		</div>
		<div class="text-gray-600 dark:text-gray-300 mt-1 space-y-1">
			{#if controlSet.project?.framework?.baseline}
				<div class="text-xs">
					<span class="font-medium">{controlSet.project.framework.baseline.toUpperCase()}</span> baseline
				</div>
			{/if}
			{#if controlSet.families && controlSet.families.length > 0}
				{@const totalControls = controlSet.families.reduce((sum, family) => sum + (family.control_count || 0), 0)}
				<div class="text-xs">
					{controlSet.families.length} families • {totalControls > 0 ? totalControls : controlSet.statistics?.total_controls || 'Unknown'} controls
				</div>
			{/if}
		</div>
	</div>
{:else}
	<a 
		href="/setup" 
		class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
	>
		Import Controls
	</a>
{/if}
