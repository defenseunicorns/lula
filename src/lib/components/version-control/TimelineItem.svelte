<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import type { GitCommit } from '$lib/types';
	import { DiffViewer, YamlDiffViewer } from '.';

	interface Props {
		commit: GitCommit & { type?: string; fileType?: string; source?: 'control' | 'mapping' };
		showConnector?: boolean;
	}

	let { commit, showConnector = false }: Props = $props();

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="relative">
	<!-- Connector line -->
	{#if showConnector}
		<div class="absolute left-4 top-12 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-800"></div>
	{/if}

	<!-- Timeline item -->
	<div class="relative">
		<!-- Icon/dot -->
		<div
			class="absolute left-0 mt-1.5 w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 flex items-center justify-center"
		>
			{#if commit.isPending}
				<div class="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></div>
			{:else if commit.source === 'mapping' || commit.type === 'mapping'}
				<div class="w-3 h-3 rounded-full bg-green-500"></div>
			{:else}
				<div class="w-3 h-3 rounded-full bg-blue-500"></div>
			{/if}
		</div>

		<!-- Content card -->
		<div
			class="ml-12 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
		>
			<!-- Header -->
			<div
				class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-t-xl"
			>
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-3">
						<h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
							{commit.fileType ||
								(commit.source === 'mapping' || commit.type === 'mapping'
									? 'Mappings'
									: 'Control File')}
						</h4>
						{#if commit.isPending}
							<span
								class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
							>
								Pending
							</span>
						{:else}
							<span
								class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
							>
								{commit.shortHash}
							</span>
						{/if}
					</div>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						{formatDate(commit.date)}
					</p>
				</div>

				<p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
					{commit.author}
				</p>
			</div>

			<!-- Content -->
			<div class="px-6 py-4">
				<pre
					class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">{commit.message}</pre>
			</div>

			<!-- Always show diff content -->
			<div class="p-2">
				{#if commit.diff && !commit.yamlDiff?.hasChanges}
					<div class="border-t border-gray-200 dark:border-gray-700">
						<DiffViewer diff={commit.diff} />
					</div>
				{:else if commit.yamlDiff?.hasChanges}
					<div class="border-t border-gray-200 dark:border-gray-700">
						<YamlDiffViewer yamlDiff={commit.yamlDiff} />
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
