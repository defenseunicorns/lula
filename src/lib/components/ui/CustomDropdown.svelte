<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts" generics="T">
	import { clickOutside } from '$lib/actions/clickOutside';
	import { fade } from 'svelte/transition';
	import { twMerge } from 'tailwind-merge';
	import { ChevronDown, ChevronUp } from 'carbon-icons-svelte';

	// Props
	export let value: T = undefined as unknown as T;
	export let options: Array<{ value: T; label: string }> = [];
	export let placeholder: string = 'Select an option';
	export let label: string | undefined = undefined;
	export let labelId: string | undefined = undefined;
	export let getDisplayValue: (value: T) => string = (val) => {
		const option = options.find((opt) => opt.value === val);
		return option ? option.label : String(val);
	};

	// State
	let isOpen = false;

	// Handle selection
	function selectOption(optionValue: T) {
		value = optionValue;
		isOpen = false;
	}

	// Handle toggle
	function toggle() {
		isOpen = !isOpen;
	}

	// Handle close
	function close() {
		isOpen = false;
	}
</script>

<div>
	{#if label}
		<label for={labelId} class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{label}</label>
	{/if}
	<div class="relative" use:clickOutside={close}>
		<!-- Dropdown Trigger -->
		<button
			type="button"
			id={labelId}
			on:click={toggle}
			class={twMerge(
				'w-full flex items-center justify-between px-3 py-2 text-sm rounded-md border transition-colors',
				isOpen
					? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900'
					: 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
				'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
			)}
		>
			<span class="truncate">
				{value ? getDisplayValue(value) : placeholder}
			</span>
			{#if isOpen}
				<ChevronUp class="h-4 w-4 text-gray-500 dark:text-gray-400" />
			{:else}
				<ChevronDown class="h-4 w-4 text-gray-500 dark:text-gray-400" />
			{/if}
		</button>

		<!-- Dropdown Menu -->
		{#if isOpen}
			<div
				class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto"
				transition:fade={{ duration: 100 }}
			>
				<slot name="header" />

				{#each options as option, index (index)}
					<button
						type="button"
						class={twMerge(
							'w-full text-left px-3 py-2 text-sm',
							value === option.value
								? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
								: 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
						)}
						on:click={() => selectOption(option.value)}
					>
						{option.label}
					</button>
				{/each}

				<slot name="footer" />
			</div>
		{/if}
	</div>
</div>
