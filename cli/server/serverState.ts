// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { join } from 'path';
import { FileStore } from './infrastructure/fileStore';
import { GitHistoryUtil } from './infrastructure/gitHistory';
import { debug } from '../utils/debug';
import type { Control, Mapping } from './types';

/**
 * Server state management for the CLI server
 */
export interface CLIServerState {
	CONTROL_SET_DIR: string; // Base directory (root)
	currentSubdir: string; // Current subdirectory (e.g., 'new-fancy' or '.')
	fileStore: FileStore;
	gitHistory: GitHistoryUtil;
	controlsCache: Map<string, Control>;
	mappingsCache: Map<string, Mapping>;
	controlsByFamily: Map<string, Set<string>>;
	mappingsByFamily: Map<string, Set<string>>;
	mappingsByControl: Map<string, Set<string>>;
}

let serverState: CLIServerState | undefined = undefined;

export function initializeServerState(controlSetDir: string, subdir: string = '.'): CLIServerState {
	const fullPath = subdir === '.' ? controlSetDir : join(controlSetDir, subdir);

	serverState = {
		CONTROL_SET_DIR: controlSetDir,
		currentSubdir: subdir,
		fileStore: new FileStore({ baseDir: fullPath }),
		gitHistory: new GitHistoryUtil(fullPath),
		controlsCache: new Map<string, Control>(),
		mappingsCache: new Map<string, Mapping>(),
		controlsByFamily: new Map<string, Set<string>>(),
		mappingsByFamily: new Map<string, Set<string>>(),
		mappingsByControl: new Map<string, Set<string>>()
	};

	return serverState;
}

export function getServerState(): CLIServerState {
	if (!serverState) {
		throw new Error('Server state not initialized. Call initializeServerState() first.');
	}
	return serverState;
}

export function getCurrentControlSetPath(): string {
	const state = getServerState();
	return state.currentSubdir === '.'
		? state.CONTROL_SET_DIR
		: join(state.CONTROL_SET_DIR, state.currentSubdir);
}

export function addControlToIndexes(control: Control): void {
	const state = getServerState();
	const family = control.family;

	if (!family) {
		return;
	}

	// Add to family index
	if (!state.controlsByFamily.has(family)) {
		state.controlsByFamily.set(family, new Set());
	}
	state.controlsByFamily.get(family)!.add(control.id);
}

export function addMappingToIndexes(mapping: Mapping): void {
	const state = getServerState();
	const family = mapping.control_id.split('-')[0];

	// Add to family index
	if (!state.mappingsByFamily.has(family)) {
		state.mappingsByFamily.set(family, new Set());
	}
	state.mappingsByFamily.get(family)!.add(mapping.uuid);

	// Add to control index
	if (!state.mappingsByControl.has(mapping.control_id)) {
		state.mappingsByControl.set(mapping.control_id, new Set());
	}
	state.mappingsByControl.get(mapping.control_id)!.add(mapping.uuid);
}

export async function loadAllData(): Promise<void> {
	const state = getServerState();
	debug('Loading data into memory...');

	try {
		// Load controls from individual files
		const controls = await state.fileStore.loadAllControls();
		for (const control of controls) {
			state.controlsCache.set(control.id, control);
			addControlToIndexes(control);
		}
		debug(`Loaded ${controls.length} controls from individual files`);

		// Load mappings from mappings file
		const mappings = await state.fileStore.loadMappings();
		for (const mapping of mappings) {
			state.mappingsCache.set(mapping.uuid, mapping);
			addMappingToIndexes(mapping);
		}
		debug(`Loaded ${mappings.length} mappings`);
	} catch (error) {
		console.error('Error loading data:', error);
	}
}

export async function saveMappingsToFile(): Promise<void> {
	const state = getServerState();
	try {
		const allMappings = Array.from(state.mappingsCache.values());
		await state.fileStore.saveMappings(allMappings);
		debug(`Saved ${allMappings.length} mappings`);
	} catch (error) {
		console.error('Error saving mappings:', error);
	}
}
