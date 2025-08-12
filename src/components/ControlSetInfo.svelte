<script lang="ts">
	import { onMount } from 'svelte';
	import type { ControlSet } from '$lib/types';

	export let controlSet: ControlSet | null = null;
	let loading = true;

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
{:else if controlSet}
	<div class="text-sm">
		<div class="font-medium text-gray-900 dark:text-white">
			{controlSet.name}
			{#if controlSet.version}
				<span class="font-normal text-gray-600 dark:text-gray-300">{controlSet.version}</span>
			{/if}
		</div>
		{#if controlSet.description}
			<div class="text-gray-600 dark:text-gray-400 mt-1">
				{controlSet.description}
			</div>
		{/if}
	</div>
{:else}
	<div class="text-sm text-gray-500 dark:text-gray-400">No control set info</div>
{/if}
