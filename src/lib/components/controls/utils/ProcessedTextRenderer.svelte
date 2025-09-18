<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { processMultilineText } from './textProcessor';
	
	interface Props {
		text: string;
	}
	
	let { text }: Props = $props();
	
	const sections = $derived(processMultilineText(text));
</script>

<div class="space-y-3">
	{#each sections as section, index (index)}
		{#if section.type === 'header'}
			<h4 class="font-semibold text-gray-900 dark:text-gray-100 mt-4 first:mt-0">
				{section.content}
			</h4>
		{:else if section.type === 'table' && section.data?.rows}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
						{#each section.data.rows as row, index (index)}
							<tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
								{#each row.columns as column, j (j)}
									<td class="px-3 py-2 text-sm {j === 0 ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}">
										{#if column.startsWith('CCI-')}
											<code class="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
												{column}
											</code>
										{:else if /^[A-Z]{2}-\d+/.test(column)}
											<code class="px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
												{column}
											</code>
										{:else}
											{column}
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if section.type === 'list' && section.data?.items}
			<ul class="space-y-1 ml-4">
				{#each section.data.items as item, index (index)}
					<li class="flex items-start">
						<span class="text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0">•</span>
						<span class="text-gray-600 dark:text-gray-400 text-sm">{item}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-gray-600 dark:text-gray-400 text-sm whitespace-pre-wrap">
				{section.content}
			</p>
		{/if}
	{/each}
</div>
