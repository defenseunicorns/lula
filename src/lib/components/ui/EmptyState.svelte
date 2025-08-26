<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description: string;
		icon?: Snippet;
		action?: Snippet;
		size?: 'sm' | 'md' | 'lg';
	}

	let { title, description, icon, action, size = 'md' }: Props = $props();

	const getSizeClasses = (size: string) => {
		switch (size) {
			case 'sm':
				return {
					container: 'py-6',
					icon: 'h-8 w-8',
					title: 'text-sm',
					description: 'text-xs'
				};
			case 'lg':
				return {
					container: 'py-16',
					icon: 'h-16 w-16',
					title: 'text-lg',
					description: 'text-base'
				};
			default: // md
				return {
					container: 'py-12',
					icon: 'h-12 w-12',
					title: 'text-base',
					description: 'text-sm'
				};
		}
	};

	const classes = getSizeClasses(size);
</script>

<div class="text-center {classes.container}">
	{#if icon}
		<div class="mx-auto {classes.icon} mb-4 text-gray-400 dark:text-gray-500">
			{@render icon()}
		</div>
	{:else}
		<!-- Default icon -->
		<svg
			class="mx-auto {classes.icon} mb-4 text-gray-400 dark:text-gray-500"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
			/>
		</svg>
	{/if}

	<h3 class="font-medium text-gray-900 dark:text-white {classes.title}">
		{title}
	</h3>
	<p class="mt-2 text-gray-500 dark:text-gray-400 {classes.description}">
		{description}
	</p>

	{#if action}
		<div class="mt-6">
			{@render action()}
		</div>
	{/if}
</div>
