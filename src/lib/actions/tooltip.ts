// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * Tooltip positioning action for Svelte components
 * Adds dynamic positioning based on viewport and element bounds
 */

/**
 * Applies tooltip positioning to an element with a .tooltip child
 * @param node The HTML element to attach the tooltip to
 * @returns Svelte action object
 */
export function tooltip(node: HTMLElement) {
	const tooltipEl = node.querySelector('.tooltip') as HTMLElement;

	// Add data attribute to allow CSS targeting
	node.setAttribute('data-tooltip-trigger', 'true');

	function updatePosition() {
		if (!tooltipEl) return;

		// Get element positions
		const rect = node.getBoundingClientRect();

		// Set position variables as CSS custom properties
		Object.entries({
			'--group-top': `${rect.top}px`,
			'--group-right': `${rect.right}px`,
			'--group-left': `${rect.left}px`,
			'--group-width': `${rect.width}px`,
			'--group-bottom': `${rect.bottom}px`,
			'--group-height': `${rect.height}px`
		}).forEach(([prop, val]) => tooltipEl.style.setProperty(prop, val));

		// Check if tooltip already has a position class
		const hasPositionClass = /tooltip-(left|right|top|bottom)/.test(tooltipEl.className);

		// Only calculate and apply position if no position class is already specified
		if (!hasPositionClass) {
			// Determine tooltip positioning based on available space
			const spaceOnRight = window.innerWidth - rect.right;
			const spaceBelow = window.innerHeight - rect.bottom;
			const tooltipWidth = 288; // Approximate tooltip min-width
			const tooltipHeight = 100; // Approximate tooltip height

			// Default horizontal position (right or left)
			const horizontalPosition = spaceOnRight < tooltipWidth + 20 ? 'left' : 'right';

			// Default vertical position (bottom or top)
			const verticalPosition = spaceBelow < tooltipHeight + 20 ? 'top' : 'bottom';

			// Determine if we should prioritize vertical positioning
			const useVerticalPosition =
				(horizontalPosition === 'left' && rect.left < tooltipWidth) ||
				(spaceBelow < tooltipHeight && rect.top > tooltipHeight) ||
				(rect.top < tooltipHeight && spaceBelow > tooltipHeight);

			// Add appropriate positioning class
			const position = useVerticalPosition
				? `tooltip-${verticalPosition}`
				: `tooltip-${horizontalPosition}`;

			tooltipEl.className =
				tooltipEl.className.replace(/tooltip-(left|right|top|bottom)/g, '') + ' ' + position;
		}
	}

	// Create a real function reference for event listener removal
	const handleMouseEnter = () => window.requestAnimationFrame(updatePosition);

	// Only update position on hover
	node.addEventListener('mouseenter', handleMouseEnter);

	return {
		update: updatePosition,
		destroy() {
			node.removeEventListener('mouseenter', handleMouseEnter);
			node.removeAttribute('data-tooltip-trigger');
		}
	};
}
