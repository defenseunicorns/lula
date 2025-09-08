<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	type Props = {
		content: string;
		placement?: 'top' | 'bottom' | 'left' | 'right';
		maxWidth?: string;
		multiline?: boolean;
		children: () => any;
	};

	let {
		content,
		placement = 'top',
		maxWidth = '300px',
		multiline = false,
		children
	}: Props = $props();

	let tooltip: HTMLDivElement | null = $state(null);
	let trigger: HTMLDivElement;
	let isVisible = $state(false);
	let position = $state({ x: 0, y: 0 });

	function calculatePosition() {
		if (!trigger || !tooltip) return;

		const triggerRect = trigger.getBoundingClientRect();
		const tooltipRect = tooltip.getBoundingClientRect();
		const spacing = 8;

		let x = 0;
		let y = 0;

		switch (placement) {
			case 'top':
				x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
				y = triggerRect.top - tooltipRect.height - spacing;
				break;
			case 'bottom':
				x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
				y = triggerRect.bottom + spacing;
				break;
			case 'left':
				x = triggerRect.left - tooltipRect.width - spacing;
				y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
				break;
			case 'right':
				x = triggerRect.right + spacing;
				y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
				break;
		}

		// Keep tooltip within viewport
		const padding = 8;
		x = Math.max(padding, Math.min(x, window.innerWidth - tooltipRect.width - padding));
		y = Math.max(padding, Math.min(y, window.innerHeight - tooltipRect.height - padding));

		position = { x, y };
	}

	function showTooltip() {
		isVisible = true;
		requestAnimationFrame(calculatePosition);
	}

	function hideTooltip() {
		isVisible = false;
	}

	onMount(() => {
		window.addEventListener('scroll', calculatePosition, true);
		window.addEventListener('resize', calculatePosition);
	});

	onDestroy(() => {
		window.removeEventListener('scroll', calculatePosition, true);
		window.removeEventListener('resize', calculatePosition);
	});
</script>

<div
	bind:this={trigger}
	class="inline-flex items-center"
	onmouseenter={showTooltip}
	onmouseleave={hideTooltip}
	onfocus={showTooltip}
	onblur={hideTooltip}
	role="button"
	tabindex="0"
>
	{@render children?.()}
</div>

{#if isVisible}
	<div
		bind:this={tooltip}
		class="fixed z-50 px-3 py-2 text-sm text-white bg-gray-900 dark:bg-gray-700 rounded-md shadow-lg pointer-events-none transition-opacity duration-200 {multiline
			? 'whitespace-pre-wrap'
			: 'whitespace-nowrap'}"
		style="left: {position.x}px; top: {position.y}px; max-width: {maxWidth};"
		role="tooltip"
	>
		{content}
		<div
			class="absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 transform rotate-45"
			class:bottom-[-4px]={placement === 'top'}
			class:left-[50%]={placement === 'top' || placement === 'bottom'}
			class:translate-x-[-50%]={placement === 'top' || placement === 'bottom'}
			class:top-[-4px]={placement === 'bottom'}
			class:right-[-4px]={placement === 'left'}
			class:top-[50%]={placement === 'left' || placement === 'right'}
			class:translate-y-[-50%]={placement === 'left' || placement === 'right'}
			class:left-[-4px]={placement === 'right'}
		></div>
	</div>
{/if}
