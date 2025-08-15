<script lang="ts">
	import { View } from 'carbon-icons-svelte';
	import { modal } from '$lib/actions/modal';
	import DiffViewer from '../DiffViewer.svelte';
	import YamlDiffViewer from '../YamlDiffViewer.svelte';
	import type { GitCommit } from '$lib/types';

	interface Props {
		commit: GitCommit & { type?: string; fileType?: string };
		showConnector?: boolean;
		onViewFile?: (commitHash: string, isMapping: boolean) => void;
		onToggleDiff?: (commitHash: string) => void;
		isDiffExpanded?: boolean;
		fileModalContent?: string;
		fileModalTitle?: string;
		loadingFileContent?: boolean;
		// Additional props for diff viewer
		fileName?: string;
		controlId?: string;
	}

	let { 
		commit, 
		showConnector = false, 
		onViewFile,
		onToggleDiff,
		isDiffExpanded = false,
		fileModalContent = '',
		fileModalTitle = '',
		loadingFileContent = false,
		fileName = '',
		controlId = ''
	}: Props = $props();

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function handleViewFile() {
		onViewFile?.(commit.hash, commit.type === 'mapping');
	}

	function handleToggleDiff() {
		onToggleDiff?.(commit.hash);
	}
</script>

<div class="relative">
	{#if showConnector}
		<div class="absolute left-3 top-16 w-0.5 h-6 bg-gradient-to-b from-gray-300 to-transparent dark:from-gray-600"></div>
	{/if}

	<div class="relative bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 {commit.isPending ? 'ring-2 ring-amber-400 ring-opacity-50' : ''}">
		<!-- Header -->
		<div class="bg-slate-100 dark:bg-slate-800 rounded-t-xl px-6 py-4 border-b border-slate-200 dark:border-slate-700 {commit.isPending ? 'bg-amber-50 dark:bg-amber-900/20' : ''}">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-3">
					{#if commit.isPending}
						<span class="inline-flex items-center px-3 py-1 rounded-lg text-xs font-mono font-medium bg-amber-500 text-white shadow-sm animate-pulse">
							PENDING
						</span>
					{:else}
						<span class="inline-flex items-center px-3 py-1 rounded-lg text-xs font-mono font-medium bg-slate-800 dark:bg-slate-900 text-slate-100 dark:text-slate-200 shadow-sm">
							{commit.shortHash}
						</span>
					{/if}
					<span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium shadow-sm {commit.type === 'control' ? 'bg-purple-500 text-white' : 'bg-amber-500 text-white'}">
						{commit.fileType === 'Control File' ? 'Controls' : 'Mappings'}
					</span>
					{#if commit.isPending}
						<span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
							Uncommitted
						</span>
					{/if}
				</div>
				<div class="text-right">
					<div class="text-sm font-medium text-slate-900 dark:text-slate-100">{commit.author}</div>
					<div class="text-xs text-slate-500 dark:text-slate-400">
						{#if commit.isPending}
							Now (unsaved changes)
						{:else}
							{formatDate(commit.date)}
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Content -->
		<div class="px-6 py-4">
			<p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">{commit.message}</p>

			<!-- Action buttons -->
			<div class="flex items-center justify-between">
				{#if onViewFile}
					<button
						class="inline-flex items-center px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-all duration-200 shadow-sm hover:shadow"
						title="View file content at this commit"
						disabled={loadingFileContent}
						onclick={handleViewFile}
					>
						<View class="w-3.5 h-3.5 mr-2" />
						{loadingFileContent ? 'Loading...' : 'View File'}
						
						<div use:modal style="display: none;">
							<div class="modal-content fixed inset-0 z-50 flex items-center justify-center p-4">
								<div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
									<div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
										<div>
											<h3 class="text-lg font-semibold text-gray-900 dark:text-white">{fileModalTitle}</h3>
											<p class="text-sm text-gray-500 dark:text-gray-400">
												Commit: {commit.hash.substring(0, 7)} by {commit.author} on {new Date(commit.date).toLocaleDateString()}
											</p>
										</div>
									</div>
									<div class="p-6 max-h-96 overflow-y-auto">
										<pre class="text-sm bg-gray-50 dark:bg-gray-900 rounded-lg p-4 font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap overflow-x-auto">{fileModalContent}</pre>
									</div>
								</div>
							</div>
						</div>
					</button>
				{/if}

				{#if commit.diff && !commit.yamlDiff?.hasChanges && onToggleDiff}
					<button
						onclick={handleToggleDiff}
						class="inline-flex items-center px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all duration-200 shadow-sm hover:shadow"
					>
						<svg
							class="w-3.5 h-3.5 mr-2 {isDiffExpanded ? 'rotate-180' : ''} transition-transform duration-200"
							fill="none" stroke="currentColor" viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
						{isDiffExpanded ? 'Hide' : 'Show'} Diff
					</button>
				{/if}
			</div>
		</div>

		<!-- Diff section -->
		{#if commit.yamlDiff && commit.yamlDiff.hasChanges}
			<div class="rounded-b-xl p-4">
				<YamlDiffViewer yamlDiff={commit.yamlDiff} />
			</div>
		{:else if commit.diff && isDiffExpanded}
			<div class="rounded-b-xl p-4">
				<DiffViewer
					diff={commit.diff}
					{fileName}
					language="yaml"
					compact={true}
				/>
			</div>
		{/if}
	</div>
</div>