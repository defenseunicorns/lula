// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fadeWhenScrollable } from './fadeWhenScrollable';

class MockResizeObserver {
	private callback: ResizeObserverCallback;
	public observedElements: Set<Element> = new Set();

	constructor(callback: ResizeObserverCallback) {
		this.callback = callback;
	}

	observe(element: Element) {
		this.observedElements.add(element);
	}

	disconnect() {
		this.observedElements.clear();
	}

	unobserve(element: Element) {
		this.observedElements.delete(element);
	}

	triggerResize(entries: ResizeObserverEntry[]) {
		this.callback(entries, this as ResizeObserver);
	}
}

class MockMutationObserver {
	private callback: MutationCallback;
	public observedElements: Set<Node> = new Set();

	constructor(callback: MutationCallback) {
		this.callback = callback;
	}

	observe(target: Node, _options?: MutationObserverInit) {
		this.observedElements.add(target);
	}

	disconnect() {
		this.observedElements.clear();
	}

	takeRecords(): MutationRecord[] {
		return [];
	}
	triggerMutation(mutations: MutationRecord[]) {
		this.callback(mutations, this as MutationObserver);
	}
}

global.ResizeObserver = MockResizeObserver as typeof ResizeObserver;
global.MutationObserver = MockMutationObserver as typeof MutationObserver;

describe('fadeWhenScrollable action', () => {
	let node: HTMLElement;
	let resizeObserver: MockResizeObserver;
	let mutationObserver: MockMutationObserver;

	beforeEach(() => {
		// Create test element
		node = document.createElement('div');
		node.style.height = '100px';
		node.style.overflow = 'auto';
		document.body.appendChild(node);

		global.addEventListener = vi.fn();
		global.removeEventListener = vi.fn();
		global.ResizeObserver = class extends MockResizeObserver {
			constructor(callback: ResizeObserverCallback) {
				super(callback);
				resizeObserver = this as MockResizeObserver;
			}
		} as typeof ResizeObserver;

		global.MutationObserver = class extends MockMutationObserver {
			constructor(callback: MutationCallback) {
				super(callback);
				mutationObserver = this as MockMutationObserver;
			}
		} as typeof MutationObserver;
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('should add no-fade class when element is not scrollable', () => {
		Object.defineProperty(node, 'scrollHeight', { value: 100, configurable: true });
		Object.defineProperty(node, 'clientHeight', { value: 100, configurable: true });

		const action = fadeWhenScrollable(node);

		expect(node.classList.contains('no-fade')).toBe(true);

		if (action.destroy) action.destroy();
	});

	it('should remove no-fade class when element becomes scrollable', () => {
		Object.defineProperty(node, 'scrollHeight', { value: 200, configurable: true });
		Object.defineProperty(node, 'clientHeight', { value: 100, configurable: true });

		const action = fadeWhenScrollable(node);

		expect(node.classList.contains('no-fade')).toBe(false);

		if (action.destroy) action.destroy();
	});

	it('should set up ResizeObserver to watch the element', () => {
		const action = fadeWhenScrollable(node);

		expect(resizeObserver).toBeDefined();
		expect(resizeObserver.observedElements.has(node)).toBe(true);

		if (action.destroy) action.destroy();
	});

	it('should set up MutationObserver to watch DOM changes', () => {
		const action = fadeWhenScrollable(node);

		expect(mutationObserver).toBeDefined();
		expect(mutationObserver.observedElements.has(node)).toBe(true);

		if (action.destroy) action.destroy();
	});

	it('should add window resize event listener', () => {
		const action = fadeWhenScrollable(node);

		expect(global.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));

		if (action.destroy) action.destroy();
	});

	it('should respond to ResizeObserver changes', () => {
		Object.defineProperty(node, 'scrollHeight', { value: 100, configurable: true });
		Object.defineProperty(node, 'clientHeight', { value: 100, configurable: true });

		const action = fadeWhenScrollable(node);
		expect(node.classList.contains('no-fade')).toBe(true);

		Object.defineProperty(node, 'scrollHeight', { value: 200, configurable: true });

		const mockEntry = {
			target: node,
			contentRect: {
				width: 100,
				height: 100,
				top: 0,
				left: 0,
				bottom: 100,
				right: 100,
				x: 0,
				y: 0,
				toJSON: () => ({})
			},
			borderBoxSize: [],
			contentBoxSize: [],
			devicePixelContentBoxSize: []
		} as unknown as ResizeObserverEntry;

		resizeObserver.triggerResize([mockEntry]);

		expect(node.classList.contains('no-fade')).toBe(false);

		if (action.destroy) action.destroy();
	});

	it('should respond to MutationObserver changes', () => {
		Object.defineProperty(node, 'scrollHeight', { value: 100, configurable: true });
		Object.defineProperty(node, 'clientHeight', { value: 100, configurable: true });

		const action = fadeWhenScrollable(node);
		expect(node.classList.contains('no-fade')).toBe(true);

		Object.defineProperty(node, 'scrollHeight', { value: 200, configurable: true });

		const mockMutation = {
			type: 'childList' as MutationRecordType,
			target: node,
			addedNodes: {
				item: () => null,
				length: 0,
				forEach: () => {},
				entries: () => [][Symbol.iterator](),
				keys: () => [][Symbol.iterator](),
				values: () => [][Symbol.iterator](),
				[Symbol.iterator]: () => [][Symbol.iterator]()
			} as NodeList,
			removedNodes: {
				item: () => null,
				length: 0,
				forEach: () => {},
				entries: () => [][Symbol.iterator](),
				keys: () => [][Symbol.iterator](),
				values: () => [][Symbol.iterator](),
				[Symbol.iterator]: () => [][Symbol.iterator]()
			} as NodeList,
			previousSibling: null,
			nextSibling: null,
			attributeName: null,
			attributeNamespace: null,
			oldValue: null
		} as MutationRecord;

		mutationObserver.triggerMutation([mockMutation]);

		expect(node.classList.contains('no-fade')).toBe(false);

		if (action.destroy) action.destroy();
	});

	it('should toggle class correctly based on scroll state', () => {
		Object.defineProperty(node, 'scrollHeight', { value: 100, configurable: true });
		Object.defineProperty(node, 'clientHeight', { value: 100, configurable: true });

		const action = fadeWhenScrollable(node);

		expect(node.classList.contains('no-fade')).toBe(true);

		Object.defineProperty(node, 'scrollHeight', { value: 200, configurable: true });
		resizeObserver.triggerResize([{} as ResizeObserverEntry]);
		expect(node.classList.contains('no-fade')).toBe(false);

		Object.defineProperty(node, 'scrollHeight', { value: 100, configurable: true });
		resizeObserver.triggerResize([{} as ResizeObserverEntry]);
		expect(node.classList.contains('no-fade')).toBe(true);

		if (action.destroy) action.destroy();
	});

	it('should clean up observers and event listeners on destroy', () => {
		const action = fadeWhenScrollable(node);

		const resizeDisconnectSpy = vi.spyOn(resizeObserver, 'disconnect');
		const mutationDisconnectSpy = vi.spyOn(mutationObserver, 'disconnect');

		if (action.destroy) {
			action.destroy();
		}

		expect(resizeDisconnectSpy).toHaveBeenCalled();
		expect(mutationDisconnectSpy).toHaveBeenCalled();
		expect(global.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
	});

	it('should handle edge case where scrollHeight equals clientHeight', () => {
		Object.defineProperty(node, 'scrollHeight', { value: 100, configurable: true });
		Object.defineProperty(node, 'clientHeight', { value: 100, configurable: true });

		const action = fadeWhenScrollable(node);

		expect(node.classList.contains('no-fade')).toBe(true);

		if (action.destroy) action.destroy();
	});

	it('should handle edge case where scrollHeight is less than clientHeight', () => {
		Object.defineProperty(node, 'scrollHeight', { value: 80, configurable: true });
		Object.defineProperty(node, 'clientHeight', { value: 100, configurable: true });

		const action = fadeWhenScrollable(node);

		expect(node.classList.contains('no-fade')).toBe(true);

		if (action.destroy) action.destroy();
	});

	it('should work with elements that have initial classes', () => {
		node.className = 'existing-class another-class';

		Object.defineProperty(node, 'scrollHeight', { value: 100, configurable: true });
		Object.defineProperty(node, 'clientHeight', { value: 100, configurable: true });

		const action = fadeWhenScrollable(node);

		expect(node.classList.contains('existing-class')).toBe(true);
		expect(node.classList.contains('another-class')).toBe(true);
		expect(node.classList.contains('no-fade')).toBe(true);

		Object.defineProperty(node, 'scrollHeight', { value: 200, configurable: true });
		resizeObserver.triggerResize([{} as ResizeObserverEntry]);

		expect(node.classList.contains('existing-class')).toBe(true);
		expect(node.classList.contains('another-class')).toBe(true);
		expect(node.classList.contains('no-fade')).toBe(false);

		if (action.destroy) action.destroy();
	});

	it('should handle window resize events', () => {
		const action = fadeWhenScrollable(node);

		expect(global.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));

		const mockAddEventListener = global.addEventListener as ReturnType<typeof vi.fn>;
		const resizeCall = mockAddEventListener.mock.calls.find(
			(call: unknown[]) => call[0] === 'resize'
		);
		const resizeHandler = resizeCall?.[1] as EventListener;

		Object.defineProperty(node, 'scrollHeight', { value: 200, configurable: true });
		Object.defineProperty(node, 'clientHeight', { value: 100, configurable: true });

		if (resizeHandler) {
			resizeHandler(new Event('resize'));
		}

		expect(node.classList.contains('no-fade')).toBe(false);

		if (action.destroy) action.destroy();
	});

	it('should work correctly with multiple rapid changes', () => {
		const action = fadeWhenScrollable(node);

		for (let i = 0; i < 10; i++) {
			const isScrollable = i % 2 === 0;
			Object.defineProperty(node, 'scrollHeight', {
				value: isScrollable ? 200 : 100,
				configurable: true
			});
			Object.defineProperty(node, 'clientHeight', { value: 100, configurable: true });

			resizeObserver.triggerResize([{} as ResizeObserverEntry]);

			expect(node.classList.contains('no-fade')).toBe(!isScrollable);
		}

		if (action.destroy) action.destroy();
	});
});
