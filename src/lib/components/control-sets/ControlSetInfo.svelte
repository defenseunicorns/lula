<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { appState } from '$lib/websocket';

	$: loading = !$appState.isConnected;
	$: hasValidControlSet =
		$appState.name &&
		$appState.name !== 'Unknown Control Set' &&
		$appState.id !== 'unknown' &&
		$appState.id !== 'default';
</script>

{#if loading}
	<div class="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
{:else}
	<div class="flex items-center gap-3">
		{#if hasValidControlSet}
			<div class="text-sm flex-1">
				<div class="font-medium text-gray-900 dark:text-white">
					{$appState.title || $appState.name}
				</div>
				<div class="text-gray-600 dark:text-gray-300 mt-1 space-y-1">
					{#if $appState.project?.framework?.baseline}
						<div class="text-xs">
							<span class="font-medium">{$appState.project.framework.baseline.toUpperCase()}</span> baseline
						</div>
					{/if}
					{#if $appState.families && $appState.families.length > 0}
						<div class="text-xs">
							{$appState.families.length} families • {$appState.totalControls || 'Unknown'} controls
						</div>
					{/if}
				</div>
			</div>
		{/if}
		<a
			href="/setup"
			class="inline-flex items-center px-3 py-1.5 text-sm font-medium {hasValidControlSet
				? 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
				: 'text-white bg-blue-600 hover:bg-blue-700'} rounded-md transition-colors"
			title={hasValidControlSet ? 'Switch control set' : 'Import controls'}
		>
			{hasValidControlSet ? 'Switch' : 'Import Controls'}
		</a>
	</div>
{/if}
