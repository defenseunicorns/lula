<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { clickOutside } from '$lib/actions/clickOutside';
	import type { GitStatus } from '$lib/types';
	import {
		Branch,
		CloudDownload,
		Renew,
		Time,
		Warning,
		Information,
		OverflowMenuVertical
	} from 'carbon-icons-svelte';

	let gitStatus = $state<GitStatus | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let isDropdownOpen = $state(false);

	// Fetch fresh git status when dropdown is opened
	$effect(() => {
		if (isDropdownOpen && !gitStatus) {
			fetchGitStatus();
		}
	});

	async function fetchGitStatus() {
		try {
			loading = true;
			error = null;
			const response = await fetch('/api/git-status');
			if (response.ok) {
				gitStatus = await response.json();
			} else {
				throw new Error('Failed to fetch git status');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
			console.error('Error fetching git status:', err);
		} finally {
			loading = false;
		}
	}

	async function pullChanges() {
		if (!gitStatus?.canPull) return;

		try {
			loading = true;
			error = null;

			const response = await fetch('/api/git-pull', { method: 'POST' });
			const result = await response.json();

			if (result.success) {
				await fetchGitStatus();
			} else {
				error = result.message;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to pull changes';
			console.error('Error pulling changes:', err);
		} finally {
			loading = false;
		}
	}

	async function refreshGitStatus() {
		await fetchGitStatus();
	}

	function formatTimestamp(timestamp: string | null): string {
		if (!timestamp) return 'Unknown';

		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffHours / 24);

		if (diffDays > 0) {
			return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
		} else if (diffHours > 0) {
			return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
		} else {
			const diffMinutes = Math.floor(diffMs / (1000 * 60));
			return diffMinutes > 0 ? `${diffMinutes} min ago` : 'Just now';
		}
	}

	function getStatusIcon() {
		if (!gitStatus?.isGitRepository) return Information;
		if (gitStatus?.branchInfo?.isBehind) return Warning;
		if (gitStatus?.branchInfo?.isAhead) return CloudDownload;
		return Branch;
	}

	function getStatusColor(): string {
		if (!gitStatus?.isGitRepository) return 'text-gray-500';
		if (gitStatus?.branchInfo?.isBehind) return 'text-yellow-500';
		if (gitStatus?.branchInfo?.isAhead) return 'text-blue-500';
		return 'text-green-500';
	}
</script>

<div class="relative" use:clickOutside={() => (isDropdownOpen = false)}>
	<button
		onclick={() => (isDropdownOpen = !isDropdownOpen)}
		class="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
		aria-label="Git options"
	>
		<OverflowMenuVertical class="w-5 h-5" />
	</button>

	{#if isDropdownOpen}
		<div
			class="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-100"
		>
			<div class="p-4 space-y-4">
				<div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
					{#if true}
						{@const StatusIcon = getStatusIcon()}
						<StatusIcon class="w-4 h-4 {getStatusColor()}" />
					{/if}
					<span class="text-sm font-medium text-gray-900 dark:text-white"> Git Status </span>
				</div>

				{#if loading && !gitStatus}
					<div class="flex items-center justify-center py-8">
						<div
							class="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 rounded-full animate-spin"
						></div>
						<span class="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading git status...</span>
					</div>
				{:else if gitStatus}
					{#if !gitStatus?.isGitRepository}
						<div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
							<Information class="w-4 h-4" />
							<span>Not a Git repository</span>
						</div>
					{:else}
						<div class="space-y-2">
							<div class="flex items-center gap-2">
								<Branch class="w-4 h-4 text-gray-500" />
								<span class="text-sm font-medium text-gray-900 dark:text-white">
									{gitStatus?.currentBranch || 'Unknown branch'}
								</span>
							</div>

							{#if gitStatus?.branchInfo}
								<div class="pl-6 space-y-1">
									{#if gitStatus?.branchInfo?.isBehind}
										<div class="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
											<Warning class="w-3 h-3" />
											<span class="text-xs">
												{gitStatus.branchInfo.behindCount} commit{gitStatus.branchInfo
													.behindCount !== 1
													? 's'
													: ''} behind
											</span>
										</div>
									{/if}

									{#if gitStatus?.branchInfo?.isAhead}
										<div class="flex items-center gap-2 text-blue-600 dark:text-blue-400">
											<CloudDownload class="w-3 h-3" />
											<span class="text-xs">
												{gitStatus.branchInfo.aheadCount} commit{gitStatus.branchInfo.aheadCount !==
												1
													? 's'
													: ''} ahead
											</span>
										</div>
									{/if}

									{#if !gitStatus?.branchInfo?.isBehind && !gitStatus?.branchInfo?.isAhead}
										<div class="flex items-center gap-2 text-green-600 dark:text-green-400">
											<span class="text-xs">Up to date</span>
										</div>
									{/if}
								</div>

								{#if gitStatus?.branchInfo?.lastCommitDate}
									<div class="pt-2 border-t border-gray-200 dark:border-gray-700">
										<div class="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
											<Time class="w-3 h-3 mt-0.5 flex-shrink-0" />
											<div>
												<div>
													Last commit: {formatTimestamp(gitStatus.branchInfo.lastCommitDate)}
												</div>
												{#if gitStatus?.branchInfo?.lastCommitMessage}
													<div class="mt-1 text-gray-500 dark:text-gray-500 truncate max-w-60">
														{gitStatus.branchInfo.lastCommitMessage}
													</div>
												{/if}
											</div>
										</div>
									</div>
								{/if}
							{/if}
						</div>

						<div class="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
							<button
								onclick={refreshGitStatus}
								disabled={loading}
								class="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors"
							>
								{#if loading}
									<div
										class="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"
									></div>
									Refreshing...
								{:else}
									<Renew class="w-4 h-4" />
									Refresh Status
								{/if}
							</button>

							{#if gitStatus?.canPull}
								<button
									onclick={pullChanges}
									disabled={loading}
									class="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
								>
									{#if loading}
										<div
											class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
										></div>
										Pulling...
									{:else}
										<CloudDownload class="w-4 h-4" />
										Pull Changes
									{/if}
								</button>
							{/if}
						</div>

						{#if error}
							<div class="pt-2 border-t border-gray-200 dark:border-gray-700">
								<div
									class="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400"
								>
									<Warning class="w-3 h-3 mt-0.5 flex-shrink-0" />
									<span>{error}</span>
								</div>
							</div>
						{/if}
					{/if}
				{:else}
					<div
						class="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400"
					>
						Click to load git status
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
