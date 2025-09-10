// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'path';
import type { Control, Mapping } from './types';

import {
	initializeServerState,
	getServerState,
	getCurrentControlSetPath,
	addControlToIndexes,
	addMappingToIndexes,
	loadAllData,
	saveMappingsToFile
} from './serverState';

const h = vi.hoisted(() => {
	return {
		debugSpy: vi.fn<(msg: string) => void>(),
		fileStoreCtorArgs: [] as Array<{ baseDir: string }>,
		gitHistoryCtorArgs: [] as string[],
		loadAllControlsSpy: vi.fn<() => Promise<Control[]>>(),
		loadMappingsSpy: vi.fn<() => Promise<Mapping[]>>(),
		saveMappingsSpy: vi.fn<(m: Mapping[]) => Promise<void>>()
	};
});

vi.mock('../utils/debug', () => ({
	debug: h.debugSpy
}));

vi.mock('./infrastructure/fileStore', () => {
	class MockFileStore {
		public readonly baseDir: string;

		public loadAllControls = h.loadAllControlsSpy;
		public loadMappings = h.loadMappingsSpy;
		public saveMappings = h.saveMappingsSpy;

		constructor(opts: { baseDir: string }) {
			this.baseDir = opts.baseDir;
			h.fileStoreCtorArgs.push(opts);
		}
	}
	return { FileStore: MockFileStore };
});

vi.mock('./infrastructure/gitHistory', () => {
	class MockGitHistoryUtil {
		public readonly dir: string;
		constructor(dir: string) {
			this.dir = dir;
			h.gitHistoryCtorArgs.push(dir);
		}
	}
	return { GitHistoryUtil: MockGitHistoryUtil };
});

const makeControl = (id: string, family: string): Control => ({
	id,
	title: id,
	family
});

const makeMapping = (uuid: string, control_id: string): Mapping => ({
	uuid,
	control_id,
	justification: '',
	source_entries: [],
	status: 'planned'
});

describe('serverState', () => {
	beforeEach(() => {
		h.debugSpy.mockReset();
		h.fileStoreCtorArgs.length = 0;
		h.gitHistoryCtorArgs.length = 0;
		h.loadAllControlsSpy.mockReset();
		h.loadMappingsSpy.mockReset();
		h.saveMappingsSpy.mockReset();
	});

	it('getServerState throws if not initialized', () => {
		expect(() => getServerState()).toThrowError(
			'Server state not initialized. Call initializeServerState() first.'
		);
	});

	it('initializeServerState creates state for base dir (.) and wires FileStore/GitHistory', () => {
		const state = initializeServerState('/root');

		expect(state.CONTROL_SET_DIR).toBe('/root');
		expect(state.currentSubdir).toBe('.');

		expect(h.fileStoreCtorArgs).toEqual([{ baseDir: '/root' }]);
		expect(h.gitHistoryCtorArgs).toEqual(['/root']);

		expect(state.controlsCache.size).toBe(0);
		expect(state.mappingsCache.size).toBe(0);
		expect(state.controlsByFamily.size).toBe(0);
		expect(state.mappingsByFamily.size).toBe(0);
		expect(state.mappingsByControl.size).toBe(0);

		expect(getCurrentControlSetPath()).toBe('/root');
	});

	it('initializeServerState can target a subdirectory and getCurrentControlSetPath reflects it', () => {
		const state = initializeServerState('/root', 'new-fancy');

		expect(state.CONTROL_SET_DIR).toBe('/root');
		expect(state.currentSubdir).toBe('new-fancy');

		const expectedFull = join('/root', 'new-fancy');
		expect(h.fileStoreCtorArgs).toEqual([{ baseDir: expectedFull }]);
		expect(h.gitHistoryCtorArgs).toEqual([expectedFull]);
		expect(getCurrentControlSetPath()).toBe(expectedFull);
	});

	it('addControlToIndexes: ignores empty family, indexes valid family', () => {
		initializeServerState('/root');

		const state = getServerState();

		const cEmpty = makeControl('AC-Empty', '');
		addControlToIndexes(cEmpty);
		expect(state.controlsByFamily.size).toBe(0);

		const c = makeControl('AC-1', 'AC');
		addControlToIndexes(c);

		expect(state.controlsByFamily.has('AC')).toBe(true);
		const set = state.controlsByFamily.get('AC');
		expect(set).toBeDefined();
		expect(set?.has('AC-1')).toBe(true);
	});

	it('addMappingToIndexes populates family and control indexes', () => {
		initializeServerState('/root');
		const state = getServerState();

		const m = makeMapping('uuid-1', 'CM-2');
		addMappingToIndexes(m);

		expect(state.mappingsByFamily.has('CM')).toBe(true);
		const fam = state.mappingsByFamily.get('CM');
		expect(fam).toBeDefined();
		expect(fam?.has('uuid-1')).toBe(true);

		expect(state.mappingsByControl.has('CM-2')).toBe(true);
		const ctrl = state.mappingsByControl.get('CM-2');
		expect(ctrl).toBeDefined();
		expect(ctrl?.has('uuid-1')).toBe(true);
	});

	it('loadAllData loads controls & mappings into caches and logs debug (success path)', async () => {
		initializeServerState('/root');
		const state = getServerState();

		const controls: Control[] = [makeControl('AC-1', 'AC')];
		const mappings: Mapping[] = [makeMapping('m-1', 'AC-1'), makeMapping('m-2', 'CM-2')];

		h.loadAllControlsSpy.mockResolvedValueOnce(controls);
		h.loadMappingsSpy.mockResolvedValueOnce(mappings);

		await loadAllData();

		expect(state.controlsCache.size).toBe(1);
		expect(state.controlsCache.get('AC-1')).toEqual(controls[0]);

		expect(state.mappingsCache.size).toBe(2);
		expect(state.mappingsCache.get('m-1')).toEqual(mappings[0]);
		expect(state.mappingsCache.get('m-2')).toEqual(mappings[1]);

		expect(state.controlsByFamily.get('AC')?.has('AC-1')).toBe(true);
		expect(state.mappingsByControl.get('AC-1')?.has('m-1')).toBe(true);
		expect(state.mappingsByFamily.get('AC')?.has('m-1')).toBe(true);
		expect(state.mappingsByFamily.get('CM')?.has('m-2')).toBe(true);

		const messages = h.debugSpy.mock.calls.map((c) => c[0]);
		expect(messages).toContain('Loading data into memory...');
		expect(messages).toContain('Loaded 1 controls from individual files');
		expect(messages).toContain('Loaded 2 mappings');
	});

	it('loadAllData logs error and does not crash on failure', async () => {
		initializeServerState('/root');

		const err = new Error('boom');
		h.loadAllControlsSpy.mockRejectedValueOnce(err);

		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await loadAllData();

		expect(errorSpy).toHaveBeenCalledWith('Error loading data:', err);
		errorSpy.mockRestore();
	});

	it('saveMappingsToFile writes all cached mappings and logs debug (success path)', async () => {
		initializeServerState('/root');
		const state = getServerState();

		const m1 = makeMapping('u-1', 'AC-1');
		const m2 = makeMapping('u-2', 'CM-2');
		state.mappingsCache.set(m1.uuid, m1);
		state.mappingsCache.set(m2.uuid, m2);

		h.saveMappingsSpy.mockResolvedValueOnce(undefined);

		await saveMappingsToFile();

		const arg = h.saveMappingsSpy.mock.calls[0]?.[0] as Mapping[];
		const uuids = arg.map((m) => m.uuid).sort();
		expect(uuids).toEqual(['u-1', 'u-2']);

		const messages = h.debugSpy.mock.calls.map((c) => c[0]);
		expect(messages).toContain('Saved 2 mappings');
	});

	it('saveMappingsToFile logs error on failure', async () => {
		initializeServerState('/root');

		const err = new Error('write-fail');
		h.saveMappingsSpy.mockRejectedValueOnce(err);

		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		await saveMappingsToFile();

		expect(errorSpy).toHaveBeenCalledWith('Error saving mappings:', err);
		errorSpy.mockRestore();
	});
});
