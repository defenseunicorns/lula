<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { formatValue } from '$lib/formatUtils';

	interface Props {
		yamlDiff: any; // YamlDiffResult
		showToggle?: boolean;
	}

	let { yamlDiff, showToggle = true }: Props = $props();

	let showDetailedView = $state(false); // Default to summary/compact view

	function getChangeIcon(type: string) {
		switch (type) {
			case 'added':
				return '+';
			case 'removed':
				return '-';
			case 'modified':
				return '~';
			default:
				return '•';
		}
	}

	function getChangeColor(type: string) {
		switch (type) {
			case 'added':
				return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
			case 'removed':
				return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
			case 'modified':
				return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
			default:
				return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
		}
	}

	// Function to highlight character differences in text
	function getTextDiff(oldText: string, newText: string) {
		if (!oldText && !newText) return { oldHighlighted: '', newHighlighted: '' };
		if (!oldText) return { oldHighlighted: '', newHighlighted: escapeHtml(newText) };
		if (!newText) return { oldHighlighted: escapeHtml(oldText), newHighlighted: '' };

		const oldStr = String(oldText);
		const newStr = String(newText);

		// Split on word boundaries, keeping separators
		const oldTokens = oldStr.split(/(\s+)/);
		const newTokens = newStr.split(/(\s+)/);

		let oldHighlighted = '';
		let newHighlighted = '';

		// Simple LCS-style alignment
		const oldLen = oldTokens.length;
		const newLen = newTokens.length;

		// Create a table to track matches
		const dp = Array(oldLen + 1)
			.fill(null)
			.map(() => Array(newLen + 1).fill(0));

		// Fill LCS table
		for (let i = 1; i <= oldLen; i++) {
			for (let j = 1; j <= newLen; j++) {
				if (oldTokens[i - 1] === newTokens[j - 1]) {
					dp[i][j] = dp[i - 1][j - 1] + 1;
				} else {
					dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
				}
			}
		}

		// Trace back to find the actual differences
		let i = oldLen,
			j = newLen;
		const oldChanges = [];
		const newChanges = [];

		while (i > 0 || j > 0) {
			if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
				// Tokens match
				oldChanges.unshift({ token: oldTokens[i - 1], changed: false });
				newChanges.unshift({ token: newTokens[j - 1], changed: false });
				i--;
				j--;
			} else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
				// Token was deleted
				oldChanges.unshift({ token: oldTokens[i - 1], changed: true });
				i--;
			} else if (j > 0) {
				// Token was added
				newChanges.unshift({ token: newTokens[j - 1], changed: true });
				j--;
			}
		}

		// Build highlighted strings
		oldHighlighted = oldChanges
			.map(({ token, changed }) =>
				changed
					? `<mark class="bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100 px-0.5 rounded">${escapeHtml(token)}</mark>`
					: escapeHtml(token)
			)
			.join('');

		newHighlighted = newChanges
			.map(({ token, changed }) =>
				changed
					? `<mark class="bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 px-0.5 rounded">${escapeHtml(token)}</mark>`
					: escapeHtml(token)
			)
			.join('');

		return { oldHighlighted, newHighlighted };
	}

	// Helper function to escape HTML
	function escapeHtml(text: string): string {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	// Helper function to truncate text while preserving highlights
	function truncateWithHighlight(htmlText: string, maxLength: number): string {
		if (!htmlText) return '';

		// Remove HTML tags to check actual text length
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = htmlText;
		const textContent = tempDiv.textContent || tempDiv.innerText || '';

		if (textContent.length <= maxLength) {
			return htmlText;
		}

		// If we need to truncate and there are highlights, find the best section
		if (htmlText.includes('<mark')) {
			// Find all highlights and their positions
			const markRegex = /<mark[^>]*>([^<]*)<\/mark>/g;
			const highlights = [];
			let match;

			while ((match = markRegex.exec(htmlText)) !== null) {
				highlights.push({
					start: match.index,
					end: match.index + match[0].length,
					text: match[1],
					fullMatch: match[0]
				});
			}

			if (highlights.length > 0) {
				// Find the first substantial highlight (not just whitespace)
				const goodHighlight = highlights.find((h) => h.text.trim().length > 0) || highlights[0];

				// Calculate context window around this highlight
				const contextSize = Math.floor((maxLength - goodHighlight.text.length) / 2);

				// Find text boundaries in the original HTML
				const beforeText = htmlText.substring(0, goodHighlight.start);
				const afterText = htmlText.substring(goodHighlight.end);

				// Convert HTML positions to text positions for better calculation
				const beforeDiv = document.createElement('div');
				beforeDiv.innerHTML = beforeText;
				const beforePlainText = beforeDiv.textContent || '';

				const afterDiv = document.createElement('div');
				afterDiv.innerHTML = afterText;
				const afterPlainText = afterDiv.textContent || '';

				// Calculate how much context to show
				const beforeContextLength = Math.min(beforePlainText.length, contextSize);
				const afterContextLength = Math.min(afterPlainText.length, contextSize);

				// Find word boundaries for cleaner truncation
				const beforeStart = Math.max(0, beforePlainText.length - beforeContextLength);
				const afterEnd = Math.min(afterPlainText.length, afterContextLength);

				// Find corresponding positions in HTML (simplified approach)
				let beforeTruncated = '';
				let afterTruncated = '';

				if (beforeStart < beforePlainText.length) {
					// Try to find a reasonable cut point in the HTML
					const ratio = beforeStart / beforePlainText.length;
					const htmlCutPoint = Math.floor(beforeText.length * ratio);
					beforeTruncated = '...' + beforeText.substring(htmlCutPoint);
				} else {
					beforeTruncated = beforeText;
				}

				if (afterEnd < afterPlainText.length) {
					const ratio = afterEnd / afterPlainText.length;
					const htmlCutPoint = Math.floor(afterText.length * ratio);
					afterTruncated = afterText.substring(0, htmlCutPoint) + '...';
				} else {
					afterTruncated = afterText;
				}

				return beforeTruncated + goodHighlight.fullMatch + afterTruncated;
			}
		}

		// Fallback: simple word-boundary truncation
		const words = textContent.split(/\s+/);
		let result = '';
		let currentLength = 0;

		for (const word of words) {
			if (currentLength + word.length + (result ? 1 : 0) > maxLength) {
				break;
			}
			if (result) result += ' ';
			result += word;
			currentLength += word.length + (result.length > word.length ? 1 : 0);
		}

		return escapeHtml(result) + (currentLength < textContent.length ? '...' : '');
	}
</script>

<div
	class="yaml-diff-viewer bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden"
>
	<div class="bg-gray-100 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-between">
			<div class="flex items-center space-x-2">
				<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
					/>
				</svg>
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Changes</span>
				<span
					class="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full"
				>
					{yamlDiff?.summary || 'No changes'}
				</span>
			</div>

			{#if showToggle}
				<button
					onclick={() => (showDetailedView = !showDetailedView)}
					class="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
				>
					<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 10V3L4 14h7v7l9-11h-7z"
						/>
					</svg>
					{showDetailedView ? 'Summary' : 'Details'}
				</button>
			{/if}
		</div>
	</div>

	<div class="max-h-96 overflow-y-auto">
		{#if yamlDiff?.changes && yamlDiff.changes.length > 0}
			{#if showDetailedView}
				<!-- Detailed view with full context -->
				<div class="divide-y divide-gray-200 dark:divide-gray-600">
					{#each yamlDiff.changes as change, i (i)}
						<div class="p-3 {getChangeColor(change.type)}">
							<div class="flex items-start space-x-3">
								<div
									class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
								>
									{getChangeIcon(change.type)}
								</div>

								<div class="flex-1 min-w-0">
									<div class="flex items-center space-x-2 mb-1">
										<span class="text-sm font-medium text-gray-900 dark:text-white">
											{change.description}
										</span>
										<span
											class="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded"
										>
											{change.path}
										</span>
									</div>

									{#if change.type === 'modified'}
										<div class="text-sm space-y-1">
											<div class="flex items-start space-x-2">
												<span class="text-red-600 dark:text-red-400 font-mono text-xs">-</span>
												<code
													class="text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded text-xs"
												>
													{formatValue(change.oldValue)}
												</code>
											</div>
											<div class="flex items-start space-x-2">
												<span class="text-green-600 dark:text-green-400 font-mono text-xs">+</span>
												<code
													class="text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded text-xs"
												>
													{formatValue(change.newValue)}
												</code>
											</div>
										</div>
									{:else if change.type === 'added'}
										<div class="text-sm">
											<code
												class="text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded text-xs"
											>
												{formatValue(change.newValue)}
											</code>
										</div>
									{:else if change.type === 'removed'}
										<div class="text-sm">
											<code
												class="text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded text-xs"
											>
												{formatValue(change.oldValue)}
											</code>
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- Summary view - more compact -->
				<div class="p-4 space-y-2">
					{#each yamlDiff.changes as change (change)}
						<div class="flex items-center space-x-2 text-sm">
							<span
								class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold {getChangeColor(
									change.type
								)}"
							>
								{getChangeIcon(change.type)}
							</span>

							<span class="font-medium text-gray-900 dark:text-white">
								{change.description}
							</span>

							{#if change.type === 'modified' && change.oldValue !== change.newValue}
								{@const diff = getTextDiff(
									formatValue(change.oldValue),
									formatValue(change.newValue)
								)}
								{@const oldTruncated = truncateWithHighlight(
									diff.oldHighlighted || escapeHtml(formatValue(change.oldValue)),
									80
								)}
								{@const newTruncated = truncateWithHighlight(
									diff.newHighlighted || escapeHtml(formatValue(change.newValue)),
									80
								)}
								<div class="flex items-center space-x-2 text-xs ml-2 mt-1">
									<span class="text-red-600 dark:text-red-400 font-mono">−</span>
									<code
										class="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded"
									>
										{@html oldTruncated}
									</code>
								</div>
								<div class="flex items-center space-x-2 text-xs ml-2 mt-1">
									<span class="text-green-600 dark:text-green-400 font-mono">+</span>
									<code
										class="text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded"
									>
										{@html newTruncated}
									</code>
								</div>
							{:else if change.type === 'added' && change.newValue !== undefined}
								<div class="flex items-center space-x-1 text-xs ml-2">
									<code
										class="text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded"
									>
										{typeof change.newValue === 'string' && change.newValue.length > 20
											? change.newValue.substring(0, 20) + '...'
											: formatValue(change.newValue)}
									</code>
								</div>
							{:else if change.type === 'removed' && change.oldValue !== undefined}
								<div class="flex items-center space-x-1 text-xs ml-2">
									<code
										class="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded"
									>
										{typeof change.oldValue === 'string' && change.oldValue.length > 20
											? change.oldValue.substring(0, 20) + '...'
											: formatValue(change.oldValue)}
									</code>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<div class="p-6 text-center text-gray-500 dark:text-gray-400">
				<svg class="mx-auto h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<p class="text-sm">No changes detected</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.yaml-diff-viewer {
		font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
	}
</style>
