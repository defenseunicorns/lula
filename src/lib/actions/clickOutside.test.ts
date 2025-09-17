// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clickOutside } from './clickOutside';

describe('clickOutside action', () => {
	let node: HTMLDivElement;
	let innerNode: HTMLDivElement;
	let outsideNode: HTMLDivElement;
	let callback: () => void;

	beforeEach(() => {
		// Create test DOM elements
		node = document.createElement('div');
		innerNode = document.createElement('div');
		outsideNode = document.createElement('div');

		// Set up the DOM structure
		node.appendChild(innerNode);
		document.body.appendChild(node);
		document.body.appendChild(outsideNode);

		// Create a mock callback
		callback = vi.fn();
	});

	afterEach(() => {
		// Clean up the DOM
		document.body.removeChild(node);
		document.body.removeChild(outsideNode);
		vi.resetAllMocks();
	});

	it('should call the callback when clicking outside the node', () => {
		// Initialize the action
		const action = clickOutside(node, callback);

		// Simulate a click outside the node
		outsideNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// Verify callback was called
		expect(callback).toHaveBeenCalledTimes(1);

		// Clean up
		action.destroy();
	});

	it('should not call the callback when clicking inside the node', () => {
		// Initialize the action
		const action = clickOutside(node, callback);

		// Simulate a click inside the node
		innerNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// Verify callback was not called
		expect(callback).not.toHaveBeenCalled();

		// Clean up
		action.destroy();
	});

	it('should update the callback when provided a new one', () => {
		// Initialize the action
		const action = clickOutside(node, callback);

		// Create a new callback
		const newCallback = vi.fn();

		// Update the action with the new callback
		action.update(newCallback);

		// Simulate a click outside the node
		outsideNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// Verify the new callback was called and the old one wasn't
		expect(newCallback).toHaveBeenCalledTimes(1);
		expect(callback).not.toHaveBeenCalled();

		// Clean up
		action.destroy();
	});

	it('should remove the event listener when destroyed', () => {
		// Spy on document.removeEventListener
		const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

		// Initialize the action
		const action = clickOutside(node, callback);

		// Destroy the action
		action.destroy();

		// Verify removeEventListener was called
		expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), true);

		// Clean up
		removeEventListenerSpy.mockRestore();
	});
});
