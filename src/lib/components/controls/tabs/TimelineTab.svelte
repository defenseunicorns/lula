<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import type { Control } from '$lib/types';
	import { TimelineItem } from '$components/version-control';
	import { EmptyState } from '../../ui';

	interface Props {
		control: Control;
		timeline?: any; // Timeline type from control.timeline
	}

	let { control, timeline }: Props = $props();

	const commits = $derived(timeline?.commits || []);
</script>

<div>
	{#if !timeline}
		<EmptyState
			title="No timeline data available"
			description="Timeline information is not available for this control."
			size="lg"
		/>
	{:else if commits.length > 0}
		<div class="mb-4">
			<div class="space-y-6">
				{#each commits as commit, index}
					<TimelineItem {commit} showConnector={index < commits.length - 1} />
				{/each}
			</div>
		</div>
	{:else}
		<EmptyState
			title="No activity history found"
			description="This control and its mapping files are new and haven't been committed to git yet."
			size="lg"
		/>
	{/if}
</div>