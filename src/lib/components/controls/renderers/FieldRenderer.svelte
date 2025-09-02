<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import type { FieldSchema } from '$lib/types';

	interface Props {
		fieldName: string;
		field: FieldSchema | null;
		value: any;
		readonly?: boolean;
	}

	let { fieldName, field, value, readonly = true }: Props = $props();

	const displayName = $derived(
		field?.original_name || fieldName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
	);
</script>

<div class="space-y-2">
	<div class="text-sm font-medium text-gray-500 dark:text-gray-400">
		{displayName}
	</div>
	<div class="text-gray-900 dark:text-white font-medium">
		{#if value === null || value === undefined || value === ''}
			<span class="text-gray-400 dark:text-gray-500 italic">Not specified</span>
		{:else if typeof value === 'boolean'}
			<span class="capitalize">{value ? 'Yes' : 'No'}</span>
		{:else if Array.isArray(value)}
			<span>{value.join(', ')}</span>
		{:else}
			<span class="whitespace-pre-line">{value}</span>
		{/if}
	</div>
</div>