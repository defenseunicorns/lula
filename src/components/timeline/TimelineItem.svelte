<script lang="ts">
	import DiffViewer from '../DiffViewer.svelte';
	import YamlDiffViewer from '../YamlDiffViewer.svelte';
	import type { GitCommit } from '$lib/types';

	interface Props {
		commit: GitCommit & { type?: string; fileType?: string };
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
		<div class="absolute left-4 top-12 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700"></div>
	{/if}

	<!-- Timeline item -->
	<div class="relative">
		<!-- Icon/dot -->
		<div
			class="absolute left-0 mt-1.5 w-8 h-8 rounded-full border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center"
		>
			{#if commit.isPending}
				<div class="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></div>
			{:else if commit.type === 'mapping'}
				<div class="w-3 h-3 rounded-full bg-green-500"></div>
			{:else}
				<div class="w-3 h-3 rounded-full bg-blue-500"></div>
			{/if}
		</div>

		<!-- Content card -->
		<div
			class="ml-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
		>
			<!-- Header -->
			<div
				class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 rounded-t-xl"
			>
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-3">
						<h4 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
							{commit.fileType || (commit.type === 'mapping' ? 'Mappings' : 'Control File')}
						</h4>
						{#if commit.isPending}
							<span
								class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
							>
								Pending
							</span>
						{:else}
							<span
								class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
							>
								{commit.shortHash}
							</span>
						{/if}
					</div>
					<p class="text-xs text-slate-500 dark:text-slate-400">
						{formatDate(commit.date)}
					</p>
				</div>

				<p class="text-xs text-slate-600 dark:text-slate-400 mt-1">
					{commit.author} • {commit.changes.files}
					{commit.changes.files === 1 ? 'file' : 'files'} changed
				</p>
			</div>

			<!-- Content -->
			<div class="px-6 py-4">
				<p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{commit.message}</p>
			</div>

			<!-- Always show diff content -->
			<div class="p-2">
				{#if commit.diff && !commit.yamlDiff?.hasChanges}
					<div class="border-t border-slate-200 dark:border-slate-700">
						<DiffViewer diff={commit.diff} />
					</div>
				{:else if commit.yamlDiff?.hasChanges}
					<div class="border-t border-slate-200 dark:border-slate-700">
						<YamlDiffViewer yamlDiff={commit.yamlDiff} />
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
