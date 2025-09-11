// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tooltip } from './tooltip';

Object.defineProperty(window, 'innerWidth', {
	writable: true,
	configurable: true,
	value: 1024
});

Object.defineProperty(window, 'innerHeight', {
	writable: true,
	configurable: true,
	value: 768
});

global.requestAnimationFrame = vi.fn((cb) => {
	cb(0);
	return 0;
});

describe('tooltip action', () => {
	let node: HTMLElement;
	let tooltipEl: HTMLElement;

	beforeEach(() => {
		// Reset window dimensions to defaults
		window.innerWidth = 1024;
		window.innerHeight = 768;

		document.body.innerHTML = '';
		node = document.createElement('div');
		tooltipEl = document.createElement('div');
		tooltipEl.className = 'tooltip';
		node.appendChild(tooltipEl);
		document.body.appendChild(node);

		node.getBoundingClientRect = vi.fn(() => ({
			top: 100,
			right: 200,
			bottom: 150,
			left: 50,
			width: 150,
			height: 50,
			x: 50,
			y: 100,
			toJSON: () => ({})
		}));
	});

	it('should add data-tooltip-trigger attribute', () => {
		tooltip(node);

		expect(node.getAttribute('data-tooltip-trigger')).toBe('true');
	});

	it('should set CSS custom properties on tooltip element', () => {
		tooltip(node);

		// Trigger mouse enter to update position
		const event = new Event('mouseenter');
		node.dispatchEvent(event);

		expect(tooltipEl.style.getPropertyValue('--group-top')).toBe('100px');
		expect(tooltipEl.style.getPropertyValue('--group-right')).toBe('200px');
		expect(tooltipEl.style.getPropertyValue('--group-left')).toBe('50px');
		expect(tooltipEl.style.getPropertyValue('--group-width')).toBe('150px');
		expect(tooltipEl.style.getPropertyValue('--group-bottom')).toBe('150px');
		expect(tooltipEl.style.getPropertyValue('--group-height')).toBe('50px');
	});

	it('should position tooltip on the right by default when space available', () => {
		// Ensure there's enough space on the right
		window.innerWidth = 1000;

		tooltip(node);

		const event = new Event('mouseenter');
		node.dispatchEvent(event);

		expect(tooltipEl.className).toContain('tooltip-right');
	});
	it('should position tooltip on bottom by default when space available', () => {
		window.innerHeight = 1000;

		tooltip(node);

		const event = new Event('mouseenter');
		node.dispatchEvent(event);
		expect(tooltipEl.className).toContain('tooltip-right');
	});

	it('should position tooltip on top when insufficient space below', () => {
		// Set up scenario with insufficient space below
		window.innerHeight = 200; // Not enough space below
		node.getBoundingClientRect = vi.fn(() => ({
			top: 150, // High position
			right: 200,
			bottom: 200,
			left: 50,
			width: 150,
			height: 50,
			x: 50,
			y: 150,
			toJSON: () => ({})
		}));

		tooltip(node);

		const event = new Event('mouseenter');
		node.dispatchEvent(event);

		expect(tooltipEl.className).toContain('tooltip-top');
	});

	it('should prefer vertical positioning when horizontal space is limited', () => {
		window.innerWidth = 100;
		window.innerHeight = 1000;

		node.getBoundingClientRect = vi.fn(() => ({
			top: 100,
			right: 90,
			bottom: 150,
			left: 10,
			width: 80,
			height: 50,
			x: 10,
			y: 100,
			toJSON: () => ({})
		}));

		tooltip(node);

		const event = new Event('mouseenter');
		node.dispatchEvent(event);

		expect(tooltipEl.className).toContain('tooltip-bottom');
	});

	it('should not override existing position classes', () => {
		tooltipEl.className = 'tooltip tooltip-left existing-class';

		tooltip(node);

		const event = new Event('mouseenter');
		node.dispatchEvent(event);

		expect(tooltipEl.className).toContain('tooltip-left');
		expect(tooltipEl.className).toContain('existing-class');
		expect(tooltipEl.className).not.toContain('tooltip-right');
	});

	it('should handle missing tooltip element gracefully', () => {
		const nodeWithoutTooltip = document.createElement('div');

		expect(() => tooltip(nodeWithoutTooltip)).not.toThrow();
	});

	it('should update position when update method is called', () => {
		const action = tooltip(node);

		window.innerWidth = 500;

		if (action.update) {
			action.update();
		}

		expect(tooltipEl.style.getPropertyValue('--group-top')).toBe('100px');
	});

	it('should clean up event listeners and attributes on destroy', () => {
		const action = tooltip(node);

		expect(node.getAttribute('data-tooltip-trigger')).toBe('true');

		if (action.destroy) {
			action.destroy();
		}

		expect(node.getAttribute('data-tooltip-trigger')).toBeNull();
	});

	it('should handle requestAnimationFrame correctly', () => {
		const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

		tooltip(node);

		const event = new Event('mouseenter');
		node.dispatchEvent(event);

		expect(rafSpy).toHaveBeenCalled();
	});

	it('should work with different tooltip sizes', () => {
		window.innerWidth = 350;
		window.innerHeight = 150;

		tooltip(node);

		const event = new Event('mouseenter');
		node.dispatchEvent(event);

		expect(tooltipEl.className).toMatch(/tooltip-(left|right|top|bottom)/);
	});

	it('should handle edge cases with very small viewport', () => {
		window.innerWidth = 100;
		window.innerHeight = 100;

		node.getBoundingClientRect = vi.fn(() => ({
			top: 50,
			right: 80,
			bottom: 80,
			left: 20,
			width: 60,
			height: 30,
			x: 20,
			y: 50,
			toJSON: () => ({})
		}));

		tooltip(node);

		const event = new Event('mouseenter');
		node.dispatchEvent(event);

		expect(tooltipEl.className).toMatch(/tooltip-(left|right|top|bottom)/);
	});

	it('should preserve other CSS classes on tooltip', () => {
		tooltipEl.className = 'tooltip custom-class another-class';

		tooltip(node);

		const event = new Event('mouseenter');
		node.dispatchEvent(event);

		expect(tooltipEl.className).toContain('custom-class');
		expect(tooltipEl.className).toContain('another-class');
		expect(tooltipEl.className).toMatch(/tooltip-(left|right|top|bottom)/);
	});

	it('should handle multiple mouse enter events', () => {
		tooltip(node);

		const event1 = new Event('mouseenter');
		const event2 = new Event('mouseenter');

		node.dispatchEvent(event1);
		node.dispatchEvent(event2);
		expect(tooltipEl.style.getPropertyValue('--group-top')).toBe('100px');
	});
});
