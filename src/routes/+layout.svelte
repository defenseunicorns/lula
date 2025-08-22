<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { ControlSetInfo } from '$components/control-sets';
	import { complianceStore, loading, selectedControl } from '$stores/compliance';
	import { onMount } from 'svelte';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		complianceStore.init();
		// Clear any selected control when visiting home page
		selectedControl.set(null);
	});
</script>

<div class="h-screen flex flex-col">
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
</div>
