// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * WebSocket server for real-time communication with clients
 * Handles control updates, state synchronization, and control set switching
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { getServerState, getCurrentControlSetPath } from './serverState';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';
import { getControlId } from './infrastructure/controlHelpers';
import type { Control, Mapping } from './types';

/**
 * WebSocket message types for client-server communication
 */
export type WSMessageType =
	| 'state-update'
	| 'connected'
	| 'error'
	| 'metadata-update'
	| 'controls-update'
	| 'mappings-update'
	| 'control-details'
	| 'control-sets-list';

/**
 * WebSocket message structure
 */
export interface WSMessage {
	type: WSMessageType;
	payload?: unknown;
}

/**
 * Incoming command message from clients
 */
interface CommandMessage {
	type: string;
	payload?: Record<string, unknown>;
}

/**
 * Control set metadata structure
 */
interface ControlSetMetadata {
	id?: string;
	name?: string;
	field_schema?: {
		fields?: Record<string, unknown>;
	};
	[key: string]: unknown;
}

/**
 * WebSocket manager class for handling real-time connections
 * Manages client connections and broadcasts state updates
 */
class WebSocketManager {
	private wss: WebSocketServer | null = null;
	private clients: Set<WebSocket> = new Set();

	/**
	 * Handle incoming commands from WebSocket clients
	 * @param message - The command message from the client
	 * @param ws - The WebSocket connection that sent the message
	 */
	private async handleCommand(message: CommandMessage, ws: WebSocket): Promise<void> {
		const { type, payload } = message;

		try {
			switch (type) {
				case 'update-control': {
					// Update control in backend
					const state = getServerState();
					if (payload && payload.id) {
						// Get existing control to merge with
						const existingControl = state.controlsCache.get(payload.id);
						if (!existingControl) {
							console.error('Control not found:', payload.id);
							return;
						}
						
						// Merge partial update with existing control (payload contains only changed fields)
						const updatedControl = { ...existingControl, ...payload } as Control;
						
						// Save the merged control
						await state.fileStore.saveControl(updatedControl);

						// Update just this control in the cache
						state.controlsCache.set(updatedControl.id, updatedControl);
						
						// Update the family grouping if needed
						const family = updatedControl.family || updatedControl.id.split('-')[0];
						if (!state.controlsByFamily.has(family)) {
							state.controlsByFamily.set(family, new Set<string>());
						}
						const familyControlIds = state.controlsByFamily.get(family);
						if (familyControlIds) {
							// Ensure the control ID is in the family set
							familyControlIds.add(updatedControl.id);
						}

						// Send success response 
						ws.send(
							JSON.stringify({
								type: 'control-updated',
								payload: { id: payload.id, success: true }
							})
						);

						// Don't broadcast full state - it causes unnecessary re-renders
						// The client already has the updated data
					}
					break;
				}

				case 'refresh-controls': {
					// Clear the controls cache and reload from disk
					const state = getServerState();
					state.controlsCache.clear();
					state.controlsByFamily.clear();

					// Reload all controls from disk
					const { loadAllData } = await import('./serverState');
					await loadAllData();

					// Broadcast updated state to all clients
					this.broadcastState();
					break;
				}

				case 'switch-control-set': {
					if (payload && payload.path) {
						// Import the necessary functions
						const { initializeServerState, loadAllData } = await import('./serverState');
						const currentState = getServerState();

						// Switch to new control set
						initializeServerState(currentState.CONTROL_SET_DIR, payload.path as string);
						await loadAllData();

						// Broadcast new state to all clients
						this.broadcastState();
					}
					break;
				}

				case 'create-mapping': {
					// Create a new mapping
					const state = getServerState();
					if (payload && payload.control_id) {
						const mapping = payload as unknown as Mapping;
						
						// Generate a UUID if not provided
						if (!mapping.uuid) {
							const crypto = await import('crypto');
							mapping.uuid = crypto.randomUUID();
						}
						
						// Save the mapping
						await state.fileStore.saveMapping(mapping);
						
						// Update the cache
						state.mappingsCache.set(mapping.uuid, mapping);
						
						// Update indexes
						const family = mapping.control_id.split('-')[0];
						if (!state.mappingsByFamily.has(family)) {
							state.mappingsByFamily.set(family, new Set<string>());
						}
						state.mappingsByFamily.get(family)?.add(mapping.uuid);
						
						if (!state.mappingsByControl.has(mapping.control_id)) {
							state.mappingsByControl.set(mapping.control_id, new Set<string>());
						}
						state.mappingsByControl.get(mapping.control_id)?.add(mapping.uuid);
						
						// Send success response
						ws.send(
							JSON.stringify({
								type: 'mapping-created',
								payload: { uuid: mapping.uuid, success: true }
							})
						);
						
						// Broadcast the updated state to all clients
						this.broadcastState();
					}
					break;
				}

				case 'update-mapping': {
					// Update an existing mapping
					const state = getServerState();
					if (payload && payload.uuid) {
						const mapping = payload as unknown as Mapping;
						
						// Save the mapping
						await state.fileStore.saveMapping(mapping);
						
						// Update the cache
						state.mappingsCache.set(mapping.uuid, mapping);
						
						// Send success response
						ws.send(
							JSON.stringify({
								type: 'mapping-updated',
								payload: { uuid: mapping.uuid, success: true }
							})
						);
						
						// Broadcast the updated state to all clients
						this.broadcastState();
					}
					break;
				}

				case 'delete-mapping': {
					// Delete a mapping
					const state = getServerState();
					if (payload && payload.uuid) {
						const uuid = payload.uuid as string;
						const mapping = state.mappingsCache.get(uuid);
						
						if (mapping) {
							// Delete the mapping file
							await state.fileStore.deleteMapping(uuid);
							
							// Remove from cache
							state.mappingsCache.delete(uuid);
							
							// Remove from indexes
							const family = mapping.control_id.split('-')[0];
							state.mappingsByFamily.get(family)?.delete(uuid);
							state.mappingsByControl.get(mapping.control_id)?.delete(uuid);
							
							// Send success response
							ws.send(
								JSON.stringify({
									type: 'mapping-deleted',
									payload: { uuid, success: true }
								})
							);
							
							// Broadcast the updated state to all clients
							this.broadcastState();
						}
					}
					break;
				}

				case 'scan-control-sets': {
					// Scan for available control sets
					const { scanControlSets } = await import('./spreadsheetRoutes');
					try {
						const controlSets = await scanControlSets();
						ws.send(
							JSON.stringify({
								type: 'control-sets-list',
								payload: controlSets
							})
						);
					} catch (error) {
						console.error('Error scanning control sets:', error);
						ws.send(
							JSON.stringify({
								type: 'error',
								payload: { message: `Failed to scan control sets: ${(error as Error).message}` }
							})
						);
					}
					break;
				}

				case 'get-control': {
					if (payload && payload.id) {
						// Always read fresh from disk instead of using cache
						const { FileStore } = await import('./infrastructure/fileStore');
						const currentPath = getCurrentControlSetPath();
						const fileStore = new FileStore({ baseDir: currentPath });

						// Load the control fresh from disk
						const controlId = payload.id as string;
						const control = await fileStore.loadControl(controlId);

						if (control) {
							// Ensure control has id field for frontend
							if (!control.id) {
								control.id = controlId;
							}
							// Get timeline data for this control
							const { GitHistoryUtil } = await import('./infrastructure/gitHistory');
							const { execSync } = await import('child_process');
							let timeline: any = null;

							try {
								const currentPath = getCurrentControlSetPath();
								const { existsSync } = await import('fs');

								// Try to find the actual file path - it might be in different formats
								const family = control.family || control.id.split('-')[0];
								const familyDir = join(currentPath, 'controls', family);

								// Try different filename formats
								const possibleFilenames = [
									`${control.id}.yaml`,
									`${control.id.replace(/\./g, '_')}.yaml`, // AC-1.1 -> AC-1_1.yaml
									`${control.id.replace(/[^\w\-]/g, '_')}.yaml` // General sanitization
								];

								let controlPath = '';
								for (const filename of possibleFilenames) {
									const testPath = join(familyDir, filename);
									if (existsSync(testPath)) {
										controlPath = testPath;
										break;
									}
								}

								// If not found in family dir, try flat structure
								if (!controlPath) {
									for (const filename of possibleFilenames) {
										const testPath = join(currentPath, 'controls', filename);
										if (existsSync(testPath)) {
											controlPath = testPath;
											break;
										}
									}
								}

								console.log(`Getting timeline for control ${control.id}:`);
								console.log(`  Current path: ${currentPath}`);
								console.log(`  Control path found: ${controlPath}`);
								console.log(`  File exists: ${existsSync(controlPath)}`);

								if (!controlPath) {
									console.error(`Could not find file for control ${control.id}`);
									timeline = null;
								} else {
									// Create GitHistoryUtil instance and get file history
									const gitUtil = new GitHistoryUtil(currentPath);
									const history = await gitUtil.getFileHistory(controlPath);

									console.log(`Git history for ${control.id}:`, {
										path: controlPath,
										totalCommits: history.totalCommits,
										commits: history.commits?.length || 0
									});

									// Check git status for uncommitted changes
									let hasPendingChanges = false;
									try {
										// File exists since we found it above
										const fileExists = true;

										if (fileExists) {
											// Check if file is tracked by git
											try {
												// This will throw if file is not tracked
												// cspell:ignore unmatch
												execSync(`git ls-files --error-unmatch "${controlPath}"`, {
													encoding: 'utf8',
													cwd: process.cwd(),
													stdio: 'pipe'
												});

												// File is tracked, check for modifications
												const gitStatus = execSync(`git status --porcelain "${controlPath}"`, {
													encoding: 'utf8',
													cwd: process.cwd()
												}).trim();

												// Git status codes: M = modified, A = added (staged)
												hasPendingChanges = gitStatus.length > 0;
												if (hasPendingChanges) {
													console.log(
														`Control ${payload.id} has pending changes: ${gitStatus.substring(0, 2)}`
													);
												}
											} catch {
												// File is not tracked - it's new/untracked
												hasPendingChanges = true;
												console.log(`Control ${payload.id} is untracked (new file)`);
											}
										}
									} catch {
										// Error checking file/git status - silently continue
									}

									// Convert to the format expected by frontend
									timeline = {
										commits: history.commits || [],
										totalCommits: history.totalCommits || 0,
										controlCommits: history.totalCommits || 0,
										mappingCommits: 0,
										hasPendingChanges
									};

									// If no history but file exists, create a pending entry
									if (timeline.totalCommits === 0 && hasPendingChanges) {
										console.log(`No git history for control ${payload.id} - showing as pending`);
										timeline.commits = [
											{
												hash: 'pending',
												shortHash: 'pending',
												author: 'Current User',
												authorEmail: '',
												date: new Date().toISOString(),
												message: 'Pending changes (uncommitted)',
												isPending: true, // Add this flag for the frontend
												changes: {
													insertions: 0,
													deletions: 0,
													files: 1
												}
											}
										];
										timeline.totalCommits = 1; // Show we have one "pending" commit
									}
									// Also add pending entry if there are uncommitted changes on top of history
									else if (hasPendingChanges && timeline.totalCommits > 0) {
										timeline.commits.unshift({
											hash: 'pending',
											shortHash: 'pending',
											author: 'Current User',
											authorEmail: '',
											date: new Date().toISOString(),
											message: 'Pending changes (uncommitted)',
											isPending: true,
											changes: {
												insertions: 0,
												deletions: 0,
												files: 1
											}
										});
										timeline.totalCommits += 1;
									}

									console.log(`Final timeline for ${control.id}:`, {
										totalCommits: timeline.totalCommits,
										commits: timeline.commits?.length || 0,
										hasPending: timeline.hasPendingChanges
									});
								}
							} catch (error) {
								console.error('Error fetching timeline:', error);
								// Don't fail the whole request, just set timeline to null
								timeline = null;
							}

							// Send full control details with timeline
							ws.send(
								JSON.stringify({
									type: 'control-details',
									payload: { ...control, timeline }
								})
							);
						} else {
							ws.send(
								JSON.stringify({
									type: 'error',
									payload: { message: `Control not found: ${payload.id}` }
								})
							);
						}
					}
					break;
				}

				default:
					console.warn('Unknown command type:', type);
					ws.send(
						JSON.stringify({
							type: 'error',
							payload: { message: `Unknown command: ${type}` }
						})
					);
			}
		} catch (error) {
			console.error('Error handling command:', error);
			ws.send(
				JSON.stringify({
					type: 'error',
					payload: { message: (error as Error).message }
				})
			);
		}
	}

	/**
	 * Get the complete application state for broadcasting
	 * @returns The complete state object or null if error
	 */
	private getCompleteState(): Record<string, unknown> | null {
		try {
			const state = getServerState();
			const currentPath = getCurrentControlSetPath();

			// Load control set metadata and merge it with the state
			let controlSetData: ControlSetMetadata = {};
			try {
				const controlSetFile = join(currentPath, 'lula.yaml');
				const content = readFileSync(controlSetFile, 'utf8');
				controlSetData = yaml.parse(content) as ControlSetMetadata;
			} catch {
				// No control set file - use defaults
				controlSetData = {
					id: 'unknown',
					name: 'Unknown Control Set'
				};
			}

			// Build complete state object - merge control set data at top level
			// Ensure all controls have an id field
			const controlsWithId = Array.from(state.controlsCache.values()).map((control) => {
				if (!control.id) {
					control.id = getControlId(control, currentPath);
				}
				return control;
			});

			return {
				...controlSetData, // Spread control set properties at root level
				currentPath: currentPath,
				controls: controlsWithId,
				mappings: Array.from(state.mappingsCache.values()),
				families: Array.from(state.controlsByFamily.keys()).sort(),
				totalControls: state.controlsCache.size,
				totalMappings: state.mappingsCache.size
			};
		} catch (error) {
			console.error('Error getting complete state:', error);
			return null;
		}
	}

	/**
	 * Send state updates to client in chunks for better performance
	 * @param ws - The WebSocket connection to send to
	 * @param fullData - Whether to send full data or summaries
	 */
	private sendStateInChunks(ws: WebSocket, fullData = false): void {
		try {
			const state = getServerState();
			const currentPath = getCurrentControlSetPath();

			// Load control set metadata
			let controlSetData: ControlSetMetadata = {};
			try {
				const controlSetFile = join(currentPath, 'lula.yaml');
				const content = readFileSync(controlSetFile, 'utf8');
				controlSetData = yaml.parse(content) as ControlSetMetadata;
			} catch {
				controlSetData = {
					id: 'unknown',
					name: 'Unknown Control Set'
				};
			}

			// Send metadata first
			ws.send(
				JSON.stringify({
					type: 'metadata-update',
					payload: {
						...controlSetData,
						currentPath: currentPath,
						families: Array.from(state.controlsByFamily.keys()).sort(),
						totalControls: state.controlsCache.size,
						totalMappings: state.mappingsCache.size
					}
				})
			);

			// Prepare control summaries (lightweight version for table display)
			const controlSummaries = Array.from(state.controlsCache.values()).map((control) => {
				// Always include id and family as they're essential
				// Use getControlId to ensure we get the correct ID field
				const controlId = control.id || getControlId(control, currentPath);
				const summary: Record<string, unknown> = {
					id: controlId,
					family:
						control.family ||
						(control as Record<string, unknown>)['control-acronym']?.toString().split('-')[0] ||
						''
				};

				// Include all fields defined in the field schema
				if (controlSetData.field_schema?.fields) {
					for (const [fieldName] of Object.entries(controlSetData.field_schema.fields)) {
						// Include field if it exists in the control
						if ((control as Record<string, unknown>)[fieldName] !== undefined) {
							summary[fieldName] = (control as Record<string, unknown>)[fieldName];
						}
					}
				} else {
					// If no schema, include all fields from the control
					Object.assign(summary, control);
				}

				return summary;
			});

			// Send control summaries after a short delay
			setTimeout(() => {
				ws.send(
					JSON.stringify({
						type: 'controls-update',
						payload: fullData ? Array.from(state.controlsCache.values()) : controlSummaries
					})
				);
			}, 10);

			// Send mappings after controls
			setTimeout(() => {
				ws.send(
					JSON.stringify({
						type: 'mappings-update',
						payload: Array.from(state.mappingsCache.values())
					})
				);
			}, 20);
		} catch (error) {
			console.error('Error sending state in chunks:', error);
		}
	}

	/**
	 * Initialize the WebSocket server
	 * @param server - The HTTP server to attach to
	 */
	initialize(server: Server): void {
		this.wss = new WebSocketServer({ server, path: '/ws' });

		this.wss.on('connection', (ws: WebSocket) => {
			console.log('New WebSocket client connected');
			this.clients.add(ws);

			ws.on('message', async (message: string) => {
				try {
					const data = JSON.parse(message.toString()) as CommandMessage;
					console.log('Received WebSocket message:', data);
					await this.handleCommand(data, ws);
				} catch (error) {
					console.error('Invalid WebSocket message:', error);
					ws.send(
						JSON.stringify({
							type: 'error',
							payload: { message: 'Invalid message format' }
						})
					);
				}
			});

			ws.on('close', () => {
				console.log('WebSocket client disconnected');
				this.clients.delete(ws);
			});

			ws.on('error', (error) => {
				console.error('WebSocket error:', error);
				this.clients.delete(ws);
			});

			// Send initial connected message
			ws.send(JSON.stringify({ type: 'connected' }));

			// Send initial state in chunks for better performance
			this.sendStateInChunks(ws);
		});
	}

	/**
	 * Broadcast a message to all connected clients
	 * @param message - The message to broadcast
	 */
	broadcast(message: WSMessage): void {
		const data = JSON.stringify(message);
		this.clients.forEach((client) => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(data);
			}
		});
	}

	/**
	 * Broadcast the complete state to all connected clients
	 */
	broadcastState(): void {
		const completeState = this.getCompleteState();
		if (completeState) {
			this.broadcast({
				type: 'state-update',
				payload: completeState
			});
		}
	}

	/**
	 * Notify all clients that a control was updated
	 * @param _controlId - The ID of the updated control (unused but kept for API compatibility)
	 */
	notifyControlUpdate(_controlId: string): void {
		this.broadcastState();
	}

	/**
	 * Notify all clients that a mapping was created
	 * @param _mapping - The created mapping (unused but kept for API compatibility)
	 */
	notifyMappingCreated(_mapping: unknown): void {
		this.broadcastState();
	}

	/**
	 * Notify all clients that a mapping was updated
	 * @param _mapping - The updated mapping (unused but kept for API compatibility)
	 */
	notifyMappingUpdated(_mapping: unknown): void {
		this.broadcastState();
	}

	/**
	 * Notify all clients that a mapping was deleted
	 * @param _uuid - The UUID of the deleted mapping (unused but kept for API compatibility)
	 */
	notifyMappingDeleted(_uuid: string): void {
		this.broadcastState();
	}

	/**
	 * Notify all clients to refresh their data
	 */
	notifyDataRefresh(): void {
		this.broadcastState();
	}
}

/**
 * Singleton instance of the WebSocket manager
 */
export const wsManager = new WebSocketManager();
