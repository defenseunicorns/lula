// cli/server/websocketServer.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';

// --- Mocks ------------------------------------------------------------------

vi.mock('ws', () => {
	// bare constructors; we’ll augment OPEN/CLOSED later in beforeEach
	return {
		WebSocket: vi.fn(),
		WebSocketServer: vi.fn()
	};
});

vi.mock('fs');
vi.mock('child_process');
vi.mock('./infrastructure/fileStore');
vi.mock('./infrastructure/gitHistory');
vi.mock('./infrastructure/controlHelpers');
vi.mock('./spreadsheetRoutes', () => ({
	scanControlSets: vi.fn().mockResolvedValue({
		controlSets: [{ name: 'Test Control Set' }]
	})
}));
vi.mock('../utils/debug');

vi.mock('./serverState', () => ({
	getServerState: vi.fn(),
	getCurrentControlSetPath: vi.fn(() => '/test/controls'),
	initializeServerState: vi.fn(),
	loadAllData: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('crypto', () => ({
	randomUUID: () => 'test-uuid-123'
}));

// --- Imports after mocks ----------------------------------------------------

import { wsManager } from './websocketServer';
import type { WSMessage, WSMessageType } from './websocketServer';
import { getServerState, loadAllData } from './serverState';
import { scanControlSets } from './spreadsheetRoutes';
import type { CLIServerState } from './serverState';
import type { Control, Mapping } from './types';

// --- Local helper types -----------------------------------------------------

interface MockWebSocket {
	send: ReturnType<typeof vi.fn>;
	on: ReturnType<typeof vi.fn>;
	readyState: number;
	close: ReturnType<typeof vi.fn>;
}

interface MockWebSocketServer {
	on: ReturnType<typeof vi.fn>;
	close: ReturnType<typeof vi.fn>;
	clients: Set<WebSocket>;
}

interface MockFileStore {
	saveControl: ReturnType<typeof vi.fn>;
	saveMapping: ReturnType<typeof vi.fn>;
	deleteMapping: ReturnType<typeof vi.fn>;
	loadControl: ReturnType<typeof vi.fn>;
}

interface MockCLIServerState {
	CONTROL_SET_DIR: string;
	currentSubdir: string;
	fileStore: MockFileStore;
	gitHistory: Record<string, unknown>;
	controlsCache: Map<string, Control>;
	mappingsCache: Map<string, Mapping>;
	controlsByFamily: Map<string, Set<string>>;
	mappingsByFamily: Map<string, Set<string>>;
	mappingsByControl: Map<string, Set<string>>;
}

interface OriginalConsole {
	error: typeof console.error;
	log: typeof console.log;
	warn: typeof console.warn;
	info: typeof console.info;
}

// --- Mocked symbols ---------------------------------------------------------

const mockWebSocketServer = vi.mocked(WebSocketServer);
const mockGetServerState = vi.mocked(getServerState);
const mockLoadAllData = vi.mocked(loadAllData);
const mockScanControlSets = vi.mocked(scanControlSets);

// We’ll attach these constants onto the mocked WebSocket constructor:
const WS_OPEN = 1;
const WS_CLOSED = 3;

// --- Tests ------------------------------------------------------------------

describe('websocketServer', () => {
	let mockServer: Server;
	let mockWss: MockWebSocketServer;
	let mockWs: MockWebSocket;
	let mockClients: Set<WebSocket>;
	let mockState: MockCLIServerState;
	let originalConsole: OriginalConsole;

	beforeEach(() => {
		vi.clearAllMocks();

		// Ensure the mocked WebSocket has OPEN/CLOSED like real ws
		(WebSocket as unknown as { OPEN?: number; CLOSED?: number }).OPEN = WS_OPEN;
		(WebSocket as unknown as { OPEN?: number; CLOSED?: number }).CLOSED = WS_CLOSED;

		originalConsole = {
			error: console.error,
			log: console.log,
			warn: console.warn,
			info: console.info
		};
		console.error = vi.fn();
		console.log = vi.fn();
		console.warn = vi.fn();
		console.info = vi.fn();

		mockState = {
			CONTROL_SET_DIR: '/test/controls',
			currentSubdir: '.',
			fileStore: {
				saveControl: vi.fn().mockResolvedValue(undefined),
				saveMapping: vi.fn().mockResolvedValue(undefined),
				deleteMapping: vi.fn().mockResolvedValue(undefined),
				loadControl: vi.fn().mockResolvedValue(undefined)
			},
			gitHistory: {},
			controlsCache: new Map(),
			mappingsCache: new Map(),
			controlsByFamily: new Map(),
			mappingsByFamily: new Map(),
			mappingsByControl: new Map()
		};

		mockGetServerState.mockReturnValue(mockState as unknown as CLIServerState);

		mockServer = {
			listen: vi.fn(),
			close: vi.fn()
		} as unknown as Server;

		mockWs = {
			send: vi.fn(),
			on: vi.fn(),
			readyState: WS_OPEN,
			close: vi.fn()
		};

		mockClients = new Set();

		mockWss = {
			on: vi.fn(),
			close: vi.fn(),
			clients: new Set()
		};

		// Make WebSocketServer constructible and return our mock instance
		mockWebSocketServer.mockImplementation(function (this: unknown, _opts: unknown) {
			return mockWss as unknown as WebSocketServer;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();

		console.error = originalConsole.error;
		console.log = originalConsole.log;
		console.warn = originalConsole.warn;
		console.info = originalConsole.info;

		// reset singleton internals between tests
		const internal = wsManager as unknown as {
			wss?: MockWebSocketServer | null;
			clients?: Set<WebSocket>;
		};
		if (internal.wss) internal.wss = null;
		if (internal.clients) internal.clients.clear();
	});

	describe('WebSocketManager', () => {
		describe('initialize', () => {
			it('should create WebSocketServer with correct configuration', () => {
				wsManager.initialize(mockServer);
				expect(mockWebSocketServer).toHaveBeenCalledWith({
					server: mockServer,
					path: '/ws'
				});
			});

			it('should set up connection event handler', () => {
				wsManager.initialize(mockServer);
				expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
			});

			it('should handle new client connections', () => {
				wsManager.initialize(mockServer);

				const connectionHandler = mockWss.on.mock.calls.find(
					(call: unknown[]) => call[0] === 'connection'
				)?.[1] as Function;

				expect(connectionHandler).toBeDefined();
				if (connectionHandler) {
					connectionHandler(mockWs);
				}

				expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
				expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
				expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
			});

			it('should send initial connected message to new clients', () => {
				wsManager.initialize(mockServer);

				const connectionHandler = mockWss.on.mock.calls.find(
					(call: unknown[]) => call[0] === 'connection'
				)?.[1] as Function;

				if (connectionHandler) {
					connectionHandler(mockWs);
				}

				expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: 'connected' }));
			});
		});

		describe('broadcast', () => {
			beforeEach(() => {
				wsManager.initialize(mockServer);
				// Attach our client set to BOTH sources the manager might iterate
				const internal = wsManager as unknown as {
					wss: MockWebSocketServer;
					clients?: Set<WebSocket>;
				};
				internal.wss.clients = mockClients;
				if (!internal.clients) {
					Object.defineProperty(internal, 'clients', {
						value: mockClients,
						writable: true,
						configurable: true,
						enumerable: false
					});
				} else {
					internal.clients = mockClients;
				}
			});

			it('should send message to all connected clients', () => {
				const mockClient1 = { send: vi.fn(), readyState: WS_OPEN };
				const mockClient2 = { send: vi.fn(), readyState: WS_OPEN };
				const mockClient3 = { send: vi.fn(), readyState: WS_CLOSED }; // CLOSED

				mockClients.add(mockClient1 as unknown as WebSocket);
				mockClients.add(mockClient2 as unknown as WebSocket);
				mockClients.add(mockClient3 as unknown as WebSocket);

				const message: WSMessage = {
					type: 'state-update',
					payload: { test: 'data' }
				};

				wsManager.broadcast(message);

				expect(mockClient1.send).toHaveBeenCalledWith(JSON.stringify(message));
				expect(mockClient2.send).toHaveBeenCalledWith(JSON.stringify(message));
				expect(mockClient3.send).not.toHaveBeenCalled();
			});

			it('should handle empty client list', () => {
				const message: WSMessage = { type: 'connected' };
				expect(() => wsManager.broadcast(message)).not.toThrow();
			});
		});

		describe('broadcastState', () => {
			beforeEach(() => {
				wsManager.initialize(mockServer);
				const internal = wsManager as unknown as {
					wss: MockWebSocketServer;
					clients?: Set<WebSocket>;
				};
				internal.wss.clients = mockClients;
				if (!internal.clients) {
					Object.defineProperty(internal, 'clients', {
						value: mockClients,
						writable: true,
						configurable: true,
						enumerable: false
					});
				} else {
					internal.clients = mockClients;
				}
			});

			it('should broadcast state update to all clients', () => {
				const mockClient = { ...mockWs, readyState: WS_OPEN };
				mockClients.add(mockClient as unknown as WebSocket);

				vi.spyOn(
					wsManager as unknown as { getCompleteState: () => unknown },
					'getCompleteState'
				).mockReturnValue(null);

				wsManager.broadcastState();

				// Should not send anything when state is null
				expect(mockClient.send).not.toHaveBeenCalled();
			});

			it('should send state when available', () => {
				const mockClient = { ...mockWs, send: vi.fn(), readyState: WS_OPEN };
				mockClients.add(mockClient as unknown as WebSocket);

				vi.spyOn(
					wsManager as unknown as { getCompleteState: () => unknown },
					'getCompleteState'
				).mockReturnValue({ hello: 'world' });

				wsManager.broadcastState();

				expect(mockClient.send).toHaveBeenCalledWith(
					JSON.stringify({
						type: 'state-update',
						payload: { hello: 'world' }
					})
				);
			});
		});

		describe('notification methods', () => {
			beforeEach(() => {
				wsManager.initialize(mockServer);
				vi.spyOn(wsManager, 'broadcastState').mockImplementation(() => {});
			});

			it('should call broadcastState when notifyControlUpdate is called', () => {
				wsManager.notifyControlUpdate('AC-1');
				expect(wsManager.broadcastState).toHaveBeenCalled();
			});

			it('should call broadcastState when notifyMappingCreated is called', () => {
				wsManager.notifyMappingCreated({ uuid: 'test-mapping' } as unknown as Mapping);
				expect(wsManager.broadcastState).toHaveBeenCalled();
			});

			it('should call broadcastState when notifyMappingUpdated is called', () => {
				wsManager.notifyMappingUpdated({ uuid: 'test-mapping' } as unknown as Mapping);
				expect(wsManager.broadcastState).toHaveBeenCalled();
			});

			it('should call broadcastState when notifyMappingDeleted is called', () => {
				wsManager.notifyMappingDeleted('test-uuid');
				expect(wsManager.broadcastState).toHaveBeenCalled();
			});

			it('should call broadcastState when notifyDataRefresh is called', () => {
				wsManager.notifyDataRefresh();
				expect(wsManager.broadcastState).toHaveBeenCalled();
			});
		});

		describe('message handling', () => {
			let messageHandler: Function;

			beforeEach(async () => {
				wsManager.initialize(mockServer);

				const connectionHandler = mockWss.on.mock.calls.find(
					(call: unknown[]) => call[0] === 'connection'
				)?.[1] as Function;

				if (connectionHandler) {
					connectionHandler(mockWs);
				}

				messageHandler = mockWs.on.mock.calls.find(
					(call: unknown[]) => call[0] === 'message'
				)?.[1] as Function;
			});

			it('should handle valid JSON messages', async () => {
				const message = { type: 'refresh-controls' };
				const messageStr = JSON.stringify(message);

				if (messageHandler) {
					await messageHandler(messageStr);
				}

				expect(mockWs.send).not.toHaveBeenCalledWith(
					expect.stringContaining('Invalid message format')
				);
			});

			it('should handle invalid JSON messages', async () => {
				const invalidMessage = 'invalid json {';

				if (messageHandler) {
					await messageHandler(invalidMessage);
				}

				expect(mockWs.send).toHaveBeenCalledWith(
					JSON.stringify({
						type: 'error',
						payload: { message: 'Invalid message format' }
					})
				);
			});

			it('should handle refresh-controls command', async () => {
				const message = { type: 'refresh-controls' };
				const messageStr = JSON.stringify(message);

				if (messageHandler) {
					await messageHandler(messageStr);
				}

				expect(mockLoadAllData).toHaveBeenCalled();
			});

			it('should handle scan-control-sets command', async () => {
				const message = { type: 'scan-control-sets' };
				const messageStr = JSON.stringify(message);

				if (messageHandler) {
					await messageHandler(messageStr);
				}

				expect(mockScanControlSets).toHaveBeenCalled();
				expect(mockWs.send).toHaveBeenCalled();
			});

			it('should handle update-control command', async () => {
				const message = {
					type: 'update-control',
					payload: { id: 'AC-1', name: 'Updated Control' }
				};
				const messageStr = JSON.stringify(message);

				mockState.controlsCache.set('AC-1', {
					id: 'AC-1',
					title: 'Original Control',
					family: 'AC'
				} as Control);
				mockState.controlsByFamily.set('AC', new Set(['AC-1']));

				if (messageHandler) {
					await messageHandler(messageStr);
				}

				expect(mockState.fileStore.saveControl).toHaveBeenCalledWith({
					id: 'AC-1',
					name: 'Updated Control',
					title: 'Original Control',
					family: 'AC'
				});
			});

			it('should handle create-mapping command', async () => {
				const message = {
					type: 'create-mapping',
					payload: { control_id: 'AC-1', justification: 'Test mapping' }
				};
				const messageStr = JSON.stringify(message);

				if (messageHandler) {
					await messageHandler(messageStr);
				}

				expect(mockState.fileStore.saveMapping).toHaveBeenCalled();
				expect(mockWs.send).toHaveBeenCalledWith(
					JSON.stringify({
						type: 'mapping-created',
						payload: { uuid: 'test-uuid-123', success: true }
					})
				);
			});
		});

		describe('client connection lifecycle', () => {
			let connectionHandler: Function;
			let closeHandler: Function;
			let errorHandler: Function;

			beforeEach(() => {
				wsManager.initialize(mockServer);

				connectionHandler = mockWss.on.mock.calls.find(
					(call: unknown[]) => call[0] === 'connection'
				)?.[1] as Function;

				if (connectionHandler) {
					connectionHandler(mockWs);
				}

				closeHandler = mockWs.on.mock.calls.find(
					(call: unknown[]) => call[0] === 'close'
				)?.[1] as Function;

				errorHandler = mockWs.on.mock.calls.find(
					(call: unknown[]) => call[0] === 'error'
				)?.[1] as Function;
			});

			it('should remove client on close', () => {
				const internal = wsManager as unknown as {
					wss: MockWebSocketServer;
					clients?: Set<WebSocket>;
				};
				if (!internal.clients) {
					Object.defineProperty(internal, 'clients', {
						value: new Set<WebSocket>(),
						writable: true,
						configurable: true,
						enumerable: false
					});
				}
				internal.clients!.add(mockWs as unknown as WebSocket);
				internal.wss.clients.add(mockWs as unknown as WebSocket);

				expect(internal.clients!.has(mockWs as unknown as WebSocket)).toBe(true);

				if (closeHandler) {
					closeHandler();
				}

				expect(internal.clients!.has(mockWs as unknown as WebSocket)).toBe(false);
			});

			it('should remove client on error', () => {
				const internal = wsManager as unknown as {
					wss: MockWebSocketServer;
					clients?: Set<WebSocket>;
				};
				if (!internal.clients) {
					Object.defineProperty(internal, 'clients', {
						value: new Set<WebSocket>(),
						writable: true,
						configurable: true,
						enumerable: false
					});
				}
				internal.clients!.add(mockWs as unknown as WebSocket);
				internal.wss.clients.add(mockWs as unknown as WebSocket);

				expect(internal.clients!.has(mockWs as unknown as WebSocket)).toBe(true);

				if (errorHandler) {
					errorHandler(new Error('Connection error'));
				}

				expect(internal.clients!.has(mockWs as unknown as WebSocket)).toBe(false);
			});
		});

		describe('getCompleteState', () => {
			it('should return null when server state is not available', () => {
				mockGetServerState.mockImplementationOnce(() => {
					throw new Error('State not initialized');
				});

				const result = (
					wsManager as unknown as { getCompleteState: () => unknown }
				).getCompleteState();
				expect(result).toBeNull();
			});

			it('should return state when available', () => {
				mockState.controlsCache.set('AC-1', {
					id: 'AC-1',
					title: 'Test Control',
					family: 'AC'
				} as Control);
				mockState.mappingsCache.set('uuid-1', {
					uuid: 'uuid-1',
					control_id: 'AC-1',
					justification: 'Test justification',
					source_entries: [],
					status: 'planned'
				} as Mapping);

				const result = (
					wsManager as unknown as { getCompleteState: () => unknown }
				).getCompleteState();

				expect(result).toBeDefined();
				expect(result).toHaveProperty('controls');
				expect(result).toHaveProperty('mappings');
			});
		});
	});

	describe('exported types and interfaces', () => {
		it('should export WSMessageType', () => {
			const messageTypes: WSMessageType[] = [
				'state-update',
				'connected',
				'error',
				'metadata-update',
				'controls-update',
				'mappings-update',
				'control-details',
				'control-sets-list'
			];

			expect(messageTypes).toBeDefined();
		});

		it('should export WSMessage interface', () => {
			const message: WSMessage = {
				type: 'connected',
				payload: { test: 'data' }
			};

			expect(message.type).toBe('connected');
			expect(message.payload).toEqual({ test: 'data' });
		});
	});

	describe('singleton wsManager', () => {
		it('should export wsManager instance', () => {
			expect(wsManager).toBeDefined();
			expect(typeof wsManager.initialize).toBe('function');
			expect(typeof wsManager.broadcast).toBe('function');
			expect(typeof wsManager.broadcastState).toBe('function');
		});

		it('should maintain singleton behavior', async () => {
			const module1 = await import('./websocketServer');
			const module2 = await import('./websocketServer');

			expect(module1.wsManager).toBe(module2.wsManager);
		});
	});
});
