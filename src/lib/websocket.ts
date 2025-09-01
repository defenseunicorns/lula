// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { Control, Mapping } from './types';

export interface WSMessage {
	type:
		| 'state-update'
		| 'connected'
		| 'error'
		| 'metadata-update'
		| 'controls-update'
		| 'mappings-update'
		| 'control-details'
		| 'control-sets-list';
	payload?: any;
}

export interface AppState {
	// Control set properties are spread at root level
	id?: string;
	name?: string;
	version?: string;
	description?: string;
	fieldSchema?: any;
	field_schema?: any;
	// State properties
	currentPath: string;
	controls: Control[];
	mappings: Mapping[];
	families: string[];
	totalControls: number;
	totalMappings: number;
	isConnected: boolean;
	isSwitchingControlSet?: boolean;
}

// Create a writable store for the complete app state
export const appState = writable<AppState>({
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

class WebSocketClient {
	private ws: WebSocket | null = null;
	private reconnectTimer: number | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000; // Start with 1 second

	connect() {
		if (!browser) return;

		// Don't create a new connection if one already exists
		if (
			this.ws &&
			(this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)
		) {
			console.log('WebSocket already connected or connecting');
			return;
		}

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		// In development, WebSocket is on port 3000, not the dev server port
		const host =
			browser && window.location.hostname === 'localhost' ? 'localhost:3000' : window.location.host;
		const wsUrl = `${protocol}//${host}/ws`;

		console.log('Connecting to WebSocket:', wsUrl);

		try {
			this.ws = new WebSocket(wsUrl);

			this.ws.onopen = () => {
				console.log('WebSocket connected');
				this.reconnectAttempts = 0;
				this.reconnectDelay = 1000;
			};

			this.ws.onmessage = (event) => {
				try {
					const message: WSMessage = JSON.parse(event.data);
					this.handleMessage(message);
				} catch (error) {
					console.error('Failed to parse WebSocket message:', error);
				}
			};

			this.ws.onerror = (error) => {
				console.error('WebSocket error:', error);
			};

			this.ws.onclose = () => {
				console.log('WebSocket disconnected');
				appState.update((state) => ({ ...state, isConnected: false }));
				this.ws = null;
				this.scheduleReconnect();
			};
		} catch (error) {
			console.error('Failed to create WebSocket:', error);
			this.scheduleReconnect();
		}
	}

	private handleMessage(message: WSMessage) {
		console.log('WebSocket message received:', message);

		switch (message.type) {
			case 'connected':
				console.log('WebSocket connection confirmed');
				appState.update((state) => ({ ...state, isConnected: true }));
				break;

			case 'state-update':
				console.log('State update received');
				// Update the entire app state with the payload
				if (message.payload) {
					appState.set({
						...message.payload,
						isConnected: true
					});
				}
				break;

			case 'metadata-update':
				console.log('Metadata update received');
				// Update metadata and control set info
				if (message.payload) {
					appState.update((state) => ({
						...state,
						...message.payload,
						isConnected: true,
						isSwitchingControlSet: false // Clear switching flag
					}));
				}
				break;

			case 'controls-update':
				console.log('Controls update received');
				// Update just the controls array
				if (message.payload) {
					appState.update((state) => ({
						...state,
						controls: message.payload
					}));
				}
				break;

			case 'mappings-update':
				console.log('Mappings update received');
				// Update just the mappings array
				if (message.payload) {
					appState.update((state) => ({
						...state,
						mappings: message.payload
					}));
				}
				break;

			case 'control-details':
				console.log('Control details received:', message.payload);
				// Emit a custom event for control details
				if (message.payload) {
					window.dispatchEvent(
						new CustomEvent('control-details', {
							detail: message.payload
						})
					);
				}
				break;

			case 'control-sets-list':
				console.log('Control sets list received');
				// Emit a custom event for control sets list
				if (message.payload) {
					window.dispatchEvent(
						new CustomEvent('control-sets-list', {
							detail: message.payload
						})
					);
				}
				break;

			case 'error':
				console.error('WebSocket error:', message.payload);
				break;

			default:
				console.warn('Unknown WebSocket message type:', message.type);
		}
	}

	private scheduleReconnect() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
		}

		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error('Max reconnection attempts reached');
			return;
		}

		this.reconnectAttempts++;
		console.log(
			`Scheduling reconnect attempt ${this.reconnectAttempts} in ${this.reconnectDelay}ms`
		);

		this.reconnectTimer = window.setTimeout(() => {
			this.connect();
		}, this.reconnectDelay);

		// Exponential backoff
		this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
	}

	disconnect() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}

		appState.update((state) => ({ ...state, isConnected: false }));
	}

	// Send a command to the backend
	async sendCommand(type: string, payload?: any) {
		console.log(`Sending WebSocket command: ${type}`, payload);

		// Wait for connection if not ready
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.log('WebSocket not ready, waiting for connection...');
			try {
				await this.waitForConnection();
			} catch (error) {
				console.error('Failed to connect:', error);
				throw error;
			}
		}

		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			const message = JSON.stringify({ type, payload });
			console.log('Sending message:', message);
			this.ws.send(message);
		} else {
			const error = new Error('WebSocket not connected after waiting');
			console.error(error);
			throw error;
		}
	}

	// Wait for WebSocket to be connected
	private waitForConnection(timeout = 5000): Promise<void> {
		return new Promise((resolve, reject) => {
			const startTime = Date.now();

			const checkConnection = () => {
				if (this.ws && this.ws.readyState === WebSocket.OPEN) {
					resolve();
				} else if (Date.now() - startTime > timeout) {
					reject(new Error('WebSocket connection timeout'));
				} else {
					setTimeout(checkConnection, 100);
				}
			};

			checkConnection();
		});
	}

	// High-level command methods
	async updateControl(control: Control) {
		return this.sendCommand('update-control', control);
	}

	async createMapping(mapping: Mapping) {
		return this.sendCommand('create-mapping', mapping);
	}

	async updateMapping(mapping: Mapping) {
		return this.sendCommand('update-mapping', mapping);
	}

	async deleteMapping(uuid: string) {
		return this.sendCommand('delete-mapping', { uuid });
	}

	async switchControlSet(path: string) {
		// Set switching flag to prevent redirect
		appState.update((state) => ({ ...state, isSwitchingControlSet: true }));
		return this.sendCommand('switch-control-set', { path });
	}

	async getControlDetails(id: string) {
		return this.sendCommand('get-control', { id });
	}

	async scanControlSets() {
		return this.sendCommand('scan-control-sets');
	}

	send(message: any) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		} else {
			console.warn('WebSocket not connected, cannot send message');
		}
	}
}

export const wsClient = new WebSocketClient();
