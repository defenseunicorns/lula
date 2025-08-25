// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { FileStore } from './fileStore.js';
import { GitHistoryUtil } from './gitHistory.js';
import type { Control, Mapping } from '../src/lib/types.js';

/**
 * Server state management for the CLI server
 */
export interface ServerState {
  CONTROL_SET_DIR: string;
  fileStore: FileStore;
  gitHistory: GitHistoryUtil;
  controlsCache: Map<string, Control>;
  mappingsCache: Map<string, Mapping>;
  controlsByFamily: Map<string, Set<string>>;
  mappingsByFamily: Map<string, Set<string>>;
  mappingsByControl: Map<string, Set<string>>;
}

let serverState: ServerState | undefined = undefined;

export function initializeServerState(controlSetDir: string): ServerState {
  serverState = {
    CONTROL_SET_DIR: controlSetDir,
    fileStore: new FileStore({ baseDir: controlSetDir }),
    gitHistory: new GitHistoryUtil(controlSetDir),
    controlsCache: new Map<string, Control>(),
    mappingsCache: new Map<string, Mapping>(),
    controlsByFamily: new Map<string, Set<string>>(),
    mappingsByFamily: new Map<string, Set<string>>(),
    mappingsByControl: new Map<string, Set<string>>()
  };
  
  return serverState;
}

export function getServerState(): ServerState {
  if (!serverState) {
    throw new Error('Server state not initialized. Call initializeServerState() first.');
  }
  return serverState;
}

export function addControlToIndexes(control: Control): void {
  const state = getServerState();
  const family = control.family;
  
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
  console.log('Loading data into memory...');
  
  try {
    // Load controls from individual files
    const controls = await state.fileStore.loadAllControls();
    for (const control of controls) {
      state.controlsCache.set(control.id, control);
      addControlToIndexes(control);
    }
    console.log(`Loaded ${controls.length} controls from individual files`);
    
    // Load mappings from mappings file
    const mappings = await state.fileStore.loadMappings();
    for (const mapping of mappings) {
      state.mappingsCache.set(mapping.uuid, mapping);
      addMappingToIndexes(mapping);
    }
    console.log(`Loaded ${mappings.length} mappings`);
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

export async function saveMappingsToFile(): Promise<void> {
  const state = getServerState();
  try {
    const allMappings = Array.from(state.mappingsCache.values());
    await state.fileStore.saveMappings(allMappings);
    console.log(`Saved ${allMappings.length} mappings`);
  } catch (error) {
    console.error('Error saving mappings:', error);
  }
}
