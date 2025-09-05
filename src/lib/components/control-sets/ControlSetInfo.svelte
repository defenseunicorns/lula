<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { appState } from '$lib/websocket';
	import { ArrowsHorizontal } from 'carbon-icons-svelte';
</script>

{#if $appState.isConnected}
	<a
		href="/setup"
		class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
		title="Switch control set"
	>
		<ArrowsHorizontal size={16} />
		Switch
	</a>
{:else}
	<div class="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
{/if}
