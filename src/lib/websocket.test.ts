// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({
	browser: true
}));

import type { Control, Mapping, SourceEntry } from './types';
import { appState, type AppState } from './websocket';

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

	describe('Message Handler Methods', () => {
		beforeEach(() => {
			// Reset app state before each test
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
		});

		describe('handleConnected', () => {
			it('should update isConnected to true', () => {
				wsClient.handleConnected();

				let currentState: AppState;
				appState.subscribe((state) => (currentState = state))();
				expect(currentState!.isConnected).toBe(true);
			});
		});

		describe('handleStateUpdate', () => {
			it('should update entire app state with payload', () => {
				const payload = {
					id: 'test-control-set',
					name: 'Test Control Set',
					title: 'Test Title',
					version: '1.0.0',
					controls: [{ id: 'test-1', title: 'Test Control', family: 'access-control' }],
					mappings: [],
					totalControls: 1,
					totalMappings: 0
				};

				wsClient.handleStateUpdate(payload);

				let currentState: AppState;
				appState.subscribe((state) => (currentState = state))();
				expect(currentState!.id).toBe('test-control-set');
				expect(currentState!.name).toBe('Test Control Set');
				expect(currentState!.title).toBe('Test Title');
				expect(currentState!.version).toBe('1.0.0');
				expect(currentState!.isConnected).toBe(true);
				expect(currentState!.isSwitchingControlSet).toBe(false);
			});

			it('should not update state if payload is null', () => {
				const initialState = {
					id: 'initial',
					name: 'Initial Control Set',
					currentPath: '',
					controls: [],
					mappings: [],
					families: [],
					totalControls: 0,
					totalMappings: 0,
					isConnected: false
				};
				appState.set(initialState);

				wsClient.handleStateUpdate(null);

				let currentState: AppState;
				appState.subscribe((state) => (currentState = state))();
				expect(currentState!.id).toBe('initial');
				expect(currentState!.name).toBe('Initial Control Set');
			});
		});

		describe('handleMetadataUpdate', () => {
			it('should update metadata and clear switching flag', () => {
				appState.update((state) => ({ ...state, isSwitchingControlSet: true }));

				const payload = {
					id: 'updated-control-set',
					name: 'Updated Control Set',
					description: 'Test description',
					version: '2.0.0'
				};

				wsClient.handleMetadataUpdate(payload);

				let currentState: AppState;
				appState.subscribe((state) => (currentState = state))();
				expect(currentState!.id).toBe('updated-control-set');
				expect(currentState!.name).toBe('Updated Control Set');
				expect(currentState!.description).toBe('Test description');
				expect(currentState!.version).toBe('2.0.0');
				expect(currentState!.isConnected).toBe(true);
				expect(currentState!.isSwitchingControlSet).toBe(false);
			});

			it('should not update if payload is null', () => {
				const initialState = {
					id: 'initial',
					name: 'Initial Control Set',
					currentPath: '',
					controls: [],
					mappings: [],
					families: [],
					totalControls: 0,
					totalMappings: 0,
					isConnected: false
				};
				appState.set(initialState);

				wsClient.handleMetadataUpdate(null);

				let currentState: AppState;
				appState.subscribe((state) => (currentState = state))();
				expect(currentState!.id).toBe('initial');
			});
		});

		describe('handleControlsUpdate', () => {
			it('should update controls array', () => {
				const controls = [
					{ id: 'test-1', title: 'Test Control 1', family: 'access-control' },
					{ id: 'test-2', title: 'Test Control 2', family: 'audit' },
					{ id: 'test-3', title: 'Test Control 3', family: 'system-information' }
				];

				wsClient.handleControlsUpdate(controls);

				let currentState: AppState;
				appState.subscribe((state) => (currentState = state))();
				expect(currentState!.controls).toEqual(controls);
				expect(currentState!.controls).toHaveLength(3);
			});

			it('should not update if payload is null', () => {
				const initialControls = [{ id: 'initial', title: 'Initial Control', family: 'test' }];
				appState.update((state) => ({ ...state, controls: initialControls }));

				wsClient.handleControlsUpdate(null);

				let currentState: AppState;
				appState.subscribe((state) => (currentState = state))();
				expect(currentState!.controls).toEqual(initialControls);
			});
		});

		describe('handleMappingsUpdate', () => {
			it('should update mappings array', () => {
				const mappings = [
					{
						uuid: 'mapping-1',
						control_id: 'test-1',
						justification: 'Test justification 1',
						source_entries: [{ location: 'test/location1' }] as SourceEntry[],
						status: 'implemented'
					},
					{
						uuid: 'mapping-2',
						control_id: 'test-2',
						justification: 'Test justification 2',
						source_entries: [{ location: 'test/location2' }] as SourceEntry[],
						status: 'planned'
					}
				];

				wsClient.handleMappingsUpdate(mappings);

				let currentState: AppState;
				appState.subscribe((state) => (currentState = state))();
				expect(currentState!.mappings).toEqual(mappings);
				expect(currentState!.mappings).toHaveLength(2);
			});

			it('should not update if payload is null', () => {
				const initialMappings = [
					{
						uuid: 'initial',
						control_id: 'test',
						justification: 'Initial',
						source_entries: [],
						status: 'implemented' as const
					}
				];
				appState.update((state) => ({ ...state, mappings: initialMappings }));

				wsClient.handleMappingsUpdate(null);

				let currentState: AppState;
				appState.subscribe((state) => (currentState = state))();
				expect(currentState!.mappings).toEqual(initialMappings);
			});
		});

		describe('handleControlDetails', () => {
			it('should emit control-details custom event', () => {
				const payload = {
					id: 'test-1',
					title: 'Test Control',
					description: 'Test description',
					implementations: []
				};
				let receivedDetail: any = null;

				const eventListener = (event: any) => {
					receivedDetail = event.detail;
				};
				window.addEventListener('control-details', eventListener);

				wsClient.handleControlDetails(payload);

				expect(receivedDetail).toEqual(payload);

				// Cleanup
				window.removeEventListener('control-details', eventListener);
			});

			it('should not emit event if payload is null', () => {
				let eventEmitted = false;

				const eventListener = () => {
					eventEmitted = true;
				};
				window.addEventListener('control-details', eventListener);

				wsClient.handleControlDetails(null);

				expect(eventEmitted).toBe(false);

				// Cleanup
				window.removeEventListener('control-details', eventListener);
			});
		});

		describe('handleControlSetsList', () => {
			it('should emit control-sets-list custom event', () => {
				const payload = [
					{ id: 'set-1', name: 'Control Set 1', path: '/path/to/set1' },
					{ id: 'set-2', name: 'Control Set 2', path: '/path/to/set2' }
				];
				let receivedDetail: any = null;

				const eventListener = (event: any) => {
					receivedDetail = event.detail;
				};
				window.addEventListener('control-sets-list', eventListener);

				wsClient.handleControlSetsList(payload);

				expect(receivedDetail).toEqual(payload);

				// Cleanup
				window.removeEventListener('control-sets-list', eventListener);
			});

			it('should not emit event if payload is null', () => {
				let eventEmitted = false;

				const eventListener = () => {
					eventEmitted = true;
				};
				window.addEventListener('control-sets-list', eventListener);

				wsClient.handleControlSetsList(null);

				expect(eventEmitted).toBe(false);

				// Cleanup
				window.removeEventListener('control-sets-list', eventListener);
			});
		});

		describe('handleControlUpdated', () => {
			it('should log success message', () => {
				const consoleSpy = vi.spyOn(console, 'log');
				const payload = { id: 'test-1', status: 'success' };

				wsClient.handleControlUpdated(payload);

				expect(consoleSpy).toHaveBeenCalledWith('Control updated successfully:', payload);
			});

			it('should handle null payload', () => {
				const consoleSpy = vi.spyOn(console, 'log');

				wsClient.handleControlUpdated(null);

				expect(consoleSpy).toHaveBeenCalledWith('Control updated successfully:', null);
			});
		});

		describe('handleMappingOperation', () => {
			it('should emit mappings-changed custom event for mapping-created', () => {
				const payload = { uuid: 'new-mapping', control_id: 'test-1' };
				let receivedDetail: any = null;

				const eventListener = (event: any) => {
					receivedDetail = event.detail;
				};
				window.addEventListener('mappings-changed', eventListener);

				wsClient.handleMappingOperation('mapping-created', payload);

				expect(receivedDetail).toEqual(payload);

				// Cleanup
				window.removeEventListener('mappings-changed', eventListener);
			});

			it('should emit mappings-changed custom event for mapping-updated', () => {
				const payload = { uuid: 'updated-mapping', control_id: 'test-1' };
				let receivedDetail: any = null;

				const eventListener = (event: any) => {
					receivedDetail = event.detail;
				};
				window.addEventListener('mappings-changed', eventListener);

				wsClient.handleMappingOperation('mapping-updated', payload);

				expect(receivedDetail).toEqual(payload);

				// Cleanup
				window.removeEventListener('mappings-changed', eventListener);
			});

			it('should emit mappings-changed custom event for mapping-deleted', () => {
				const payload = { uuid: 'deleted-mapping' };
				let receivedDetail: any = null;

				const eventListener = (event: any) => {
					receivedDetail = event.detail;
				};
				window.addEventListener('mappings-changed', eventListener);

				wsClient.handleMappingOperation('mapping-deleted', payload);

				expect(receivedDetail).toEqual(payload);

				// Cleanup
				window.removeEventListener('mappings-changed', eventListener);
			});

			it('should log the operation type and payload', () => {
				const consoleSpy = vi.spyOn(console, 'log');
				const payload = { uuid: 'test-mapping' };

				wsClient.handleMappingOperation('mapping-created', payload);

				expect(consoleSpy).toHaveBeenCalledWith(
					'Mapping operation successful: mapping-created',
					payload
				);
			});
		});

		describe('handleError', () => {
			it('should log error message', () => {
				const consoleErrorSpy = vi.spyOn(console, 'error');
				const payload = { message: 'Test error', code: 500 };

				wsClient.handleError(payload);

				expect(consoleErrorSpy).toHaveBeenCalledWith('WebSocket error:', payload);
			});

			it('should handle null payload', () => {
				const consoleErrorSpy = vi.spyOn(console, 'error');

				wsClient.handleError(null);

				expect(consoleErrorSpy).toHaveBeenCalledWith('WebSocket error:', null);
			});
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

		it('should send updateMapping command when connected', async () => {
			const mapping: Mapping = {
				uuid: 'mapping-1',
				control_id: 'test-1',
				justification: 'Updated justification',
				source_entries: [{ location: 'test/location' }],
				status: 'implemented',
				hash: 'new-hash'
			};

			const oldCompositeKey = 'test-1:old-hash';

			await wsClient.updateMapping(oldCompositeKey, mapping);

			expect(mockInstance?.send).toHaveBeenCalledWith(
				JSON.stringify({
					type: 'update-mapping',
					payload: {
						old_composite_key: oldCompositeKey,
						mapping
					}
				})
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
