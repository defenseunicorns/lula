// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$app/environment', () => ({
	browser: true
}));

import { appState, type WSMessage, type AppState } from './websocket';
import type { Control, Mapping, SourceEntry } from './types';

class MockWebSocket {
	url: string;
	readyState = 0;
	onopen: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;

	constructor(url: string) {
		this.url = url;
		mockInstance = this;
	}

	send = vi.fn();
	close = vi.fn();

	CONNECTING = 0;
	OPEN = 1;
	CLOSING = 2;
	CLOSED = 3;

	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;
}

let mockInstance: MockWebSocket | null = null;

global.WebSocket = MockWebSocket as any;

const { wsClient } = await import('./websocket');

describe('WebSocket Client', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockInstance = null;

		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});

		appState.set({
			id: 'unknown',
			name: 'Unknown Control Set',
			currentPath: '',
			controls: [],
			mappings: [],
			families: [],
			totalControls: 0,
			totalMappings: 0,
			isConnected: false
		});

		Object.defineProperty(window, 'location', {
			value: {
				protocol: 'http:',
				hostname: 'localhost',
				host: 'localhost:5173'
			},
			writable: true
		});
	});

	afterEach(() => {
		wsClient.disconnect();
		vi.restoreAllMocks();
	});

	describe('Connection Management', () => {
		it('should connect to WebSocket with correct URL', () => {
			wsClient.connect();

			expect(mockInstance?.url).toBe('ws://localhost:3000/ws');
		});

		it('should use wss protocol for https sites', () => {
			Object.defineProperty(window, 'location', {
				value: {
					protocol: 'https:',
					hostname: 'example.com',
					host: 'example.com'
				},
				writable: true
			});

			wsClient.connect();

			expect(mockInstance?.url).toBe('wss://example.com/ws');
		});

		it('should update connection status when onopen is called', async () => {
			wsClient.connect();

			await new Promise((resolve) => setTimeout(resolve, 1));

			if (mockInstance) {
				mockInstance.readyState = MockWebSocket.OPEN;
				if (mockInstance.onopen) {
					mockInstance.onopen(new Event('open'));
				}
			}

			expect(wsClient.isConnected()).toBe(true);
		});
	});

	describe('Message Handling', () => {
		beforeEach(async () => {
			wsClient.connect();
			await new Promise((resolve) => setTimeout(resolve, 1));
			if (mockInstance) {
				mockInstance.readyState = MockWebSocket.OPEN;
				if (mockInstance.onopen) {
					mockInstance.onopen(new Event('open'));
				}
			}
		});

		it('should handle connected message', () => {
			if (mockInstance?.onmessage) {
				mockInstance.onmessage({
					data: JSON.stringify({ type: 'connected' })
				} as MessageEvent);
			}

			let currentState: AppState;
			appState.subscribe((state) => (currentState = state))();
			expect(currentState!.isConnected).toBe(true);
		});

		it('should handle state-update message', () => {
			const payload = {
				id: 'test-control-set',
				name: 'Test Control Set',
				controls: [{ id: 'test-1', title: 'Test Control', family: 'access-control' }],
				mappings: [
					{
						uuid: 'mapping-1',
						control_id: 'test-1',
						justification: 'Test justification',
						source_entries: [{ location: 'test/location' }] as SourceEntry[],
						status: 'implemented'
					}
				],
				totalControls: 1,
				totalMappings: 1
			};

			if (mockInstance?.onmessage) {
				mockInstance.onmessage({
					data: JSON.stringify({ type: 'state-update', payload })
				} as MessageEvent);
			}

			let currentState: AppState;
			appState.subscribe((state) => (currentState = state))();
			expect(currentState!.id).toBe('test-control-set');
		});

		it('should handle controls-update message', () => {
			const controls = [
				{ id: 'test-1', title: 'Test Control 1', family: 'access-control' },
				{ id: 'test-2', title: 'Test Control 2', family: 'audit' }
			];

			if (mockInstance?.onmessage) {
				mockInstance.onmessage({
					data: JSON.stringify({ type: 'controls-update', payload: controls })
				} as MessageEvent);
			}

			let currentState: AppState;
			appState.subscribe((state) => (currentState = state))();
			expect(currentState!.controls).toEqual(controls);
		});

		it('should emit custom event for control-details', () => {
			const payload = { id: 'test-1', title: 'Test Control' };
			let receivedDetail: any = null;

			window.addEventListener('control-details', (event: any) => {
				receivedDetail = event.detail;
			});

			if (mockInstance?.onmessage) {
				mockInstance.onmessage({
					data: JSON.stringify({ type: 'control-details', payload })
				} as MessageEvent);
			}

			expect(receivedDetail).toEqual(payload);
		});

		it('should handle malformed JSON gracefully', () => {
			expect(() => {
				if (mockInstance?.onmessage) {
					mockInstance.onmessage({ data: 'invalid json' } as MessageEvent);
				}
			}).not.toThrow();
		});
	});

	describe('Command Methods', () => {
		beforeEach(async () => {
			wsClient.connect();
			await new Promise((resolve) => setTimeout(resolve, 1));

			if (mockInstance) {
				mockInstance.readyState = MockWebSocket.OPEN;
				if (mockInstance.onopen) {
					mockInstance.onopen(new Event('open'));
				}
			}
		});

		it('should send updateControl command when connected', async () => {
			const control: Control = {
				id: 'test-1',
				title: 'Test Control',
				family: 'access-control'
			};

			await wsClient.updateControl(control);

			expect(mockInstance?.send).toHaveBeenCalledWith(
				JSON.stringify({ type: 'update-control', payload: control })
			);
		});

		it('should send createMapping command when connected', async () => {
			const mapping: Mapping = {
				uuid: 'mapping-1',
				control_id: 'test-1',
				justification: 'Test justification',
				source_entries: [{ location: 'test/location' }],
				status: 'implemented'
			};

			await wsClient.createMapping(mapping);

			expect(mockInstance?.send).toHaveBeenCalledWith(
				JSON.stringify({ type: 'create-mapping', payload: mapping })
			);
		});

		it('should send scanControlSets command when connected', async () => {
			await wsClient.scanControlSets();

			expect(mockInstance?.send).toHaveBeenCalledWith(
				JSON.stringify({ type: 'scan-control-sets' })
			);
		});
	});

	describe('Connection State', () => {
		it('should return correct connection status', async () => {
			expect(wsClient.isConnected()).toBe(false);

			wsClient.connect();
			await new Promise((resolve) => setTimeout(resolve, 1));

			if (mockInstance) {
				mockInstance.readyState = MockWebSocket.OPEN;
				if (mockInstance.onopen) {
					mockInstance.onopen(new Event('open'));
				}
			}

			expect(wsClient.isConnected()).toBe(true);

			wsClient.disconnect();
			expect(wsClient.isConnected()).toBe(false);
		});

		it('should clean up properly on disconnect', () => {
			wsClient.connect();
			wsClient.disconnect();

			expect(mockInstance?.close).toHaveBeenCalled();
		});

		it('should handle connection close events', () => {
			wsClient.connect();

			if (mockInstance?.onclose) {
				mockInstance.onclose(new CloseEvent('close'));
			}

			expect(wsClient.isConnected()).toBe(false);
		});
	});
});
