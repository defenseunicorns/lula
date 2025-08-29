<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { ControlSetInfo } from '$components/control-sets';
	import { complianceStore, loading, selectedControl } from '$stores/compliance';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import '../app.css';

	let { children } = $props();
	let hasControlSet = true;

	onMount(async () => {
		// Skip redirect if we're already on the setup page
		if ($page.url.pathname === '/setup') {
			return;
		}
		
		try {
			// Check if control set exists
			const response = await fetch('/api/control-set');
			if (!response.ok) {
				hasControlSet = false;
				// Redirect to setup wizard if no control set
				await goto('/setup');
				return;
			}
			
			const data = await response.json();
			// Check if it's the default "Unknown Control Set"
			if (data.name === 'Unknown Control Set' || data.id === 'unknown') {
				hasControlSet = false;
				// Redirect to setup wizard if no real control set
				await goto('/setup');
				return;
			}
			
			// Initialize compliance store if control set exists
			complianceStore.init();
			// Clear any selected control when visiting home page
			selectedControl.set(null);
		} catch (error) {
			console.error('Error checking control set:', error);
			// Redirect to setup on error
			await goto('/setup');
		}
	});
</script>

<div class="h-screen flex flex-col">
	{#if $page.url.pathname !== '/setup'}
		<!-- Fixed Header -->
		<header
			class="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
		>
			<div class="w-full px-4 sm:px-6 lg:px-8">
				<div class="flex justify-between items-center py-4">
					<a href="/" class="ml-1 flex sm:ml-2 md:mr-4">
						<img src="/lula.png" class="mr-1 block h-8 sm:mr-4" alt="Logo" />
						<span
							class="text-md self-center font-semibold whitespace-nowrap text-gray-100 md:text-2xl"
						>
							Lula
						</span>
					</a>
					<div class="flex items-center space-x-4">
						<ControlSetInfo />
					</div>
				</div>
			</div>
		</header>

		<!-- Split Pane Layout with Cards -->
		<div class="flex-1 flex gap-6 p-6 overflow-hidden">
			{#if $loading}
				<div class="flex-1 flex justify-center items-center">
					<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
				</div>
			{:else}
				{@render children()}
			{/if}
		</div>
	{:else}
		<!-- Setup page gets full screen -->
		{@render children()}
	{/if}
</div>
