<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { ControlDetailsPanel, ControlsList } from '$components/controls';
	import { selectedControl } from '$stores/compliance';
	import { Document } from 'carbon-icons-svelte';
</script>

<!-- Left Pane: Controls List Card -->
<div class="w-1/2 flex flex-col">
	<div
		class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm h-full flex flex-col"
	>
		<ControlsList />
	</div>
</div>

<!-- Right Pane: Control Details -->
<div class="w-1/2 flex flex-col">
	{#if $selectedControl}
		<ControlDetailsPanel control={$selectedControl} />
	{:else}
		<div class=" h-full flex flex-col">
			<div class="flex-1 flex items-center justify-center p-8">
				<div class="text-center text-gray-500 dark:text-gray-400">
					<Document class="mx-auto h-16 w-16 mb-4" />
					<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
						No Control Selected
					</h3>
					<p class="text-gray-600 dark:text-gray-400">
						Select a control from the list to view and edit its details
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>
