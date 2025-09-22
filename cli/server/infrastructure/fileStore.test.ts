// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Control, Mapping } from '../types';
import { FileStore } from './fileStore';

vi.mock('./controlHelpers', () => ({
	getControlId: vi.fn((control: Partial<Control>) => {
		if (control.id) return control.id;
		if (control['ap-acronym']) return control['ap-acronym'];
		throw new Error(
			'No control ID found in control object. Available fields: ' + Object.keys(control).join(', ')
		);
	})
}));

describe('FileStore', () => {
	let tempDir: string;
	let fileStore: FileStore;

	beforeEach(() => {
		tempDir = join(process.cwd(), 'test-temp', `filestore-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });

		const lulaConfig = `id: test-control-set
name: Test Control Set
control_id_field: id`;
		writeFileSync(join(tempDir, 'lula.yaml'), lulaConfig);

		fileStore = new FileStore({ baseDir: tempDir });
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('constructor', () => {
		it('should initialize with correct directories', () => {
			expect(fileStore['baseDir']).toBe(tempDir);
			expect(fileStore['controlsDir']).toBe(join(tempDir, 'controls'));
			expect(fileStore['mappingsDir']).toBe(join(tempDir, 'mappings'));
		});

		it('should not create directories on construction', () => {
			const newTempDir = join(process.cwd(), 'test-temp', `filestore-nocreate-${Date.now()}`);

			expect(existsSync(join(newTempDir, 'controls'))).toBe(false);
			expect(existsSync(join(newTempDir, 'mappings'))).toBe(false);
		});
	});

	describe('getControlFilename', () => {
		it('should sanitize control ID for filename', () => {
			const filename = fileStore['getControlFilename']('AC-1.1');
			expect(filename).toBe('AC-1_1.yaml');
		});

		it('should handle complex control IDs', () => {
			const filename = fileStore['getControlFilename']('AC-10.3.2');
			expect(filename).toBe('AC-10_3_2.yaml');
		});

		it('should handle already sanitized IDs', () => {
			const filename = fileStore['getControlFilename']('AC-1_1');
			expect(filename).toBe('AC-1_1.yaml');
		});
	});

	describe('getControlFamily', () => {
		it('should extract family from control ID', () => {
			const family = fileStore['getControlFamily']('AC-1.1');
			expect(family).toBe('AC');
		});

		it('should handle single letter families', () => {
			const family = fileStore['getControlFamily']('A-1');
			expect(family).toBe('A');
		});

		it('should handle multi-letter families', () => {
			const family = fileStore['getControlFamily']('AU-1.1');
			expect(family).toBe('AU');
		});
	});

	describe('saveControl', () => {
		it('should save a control to the correct family directory', async () => {
			const control: Partial<Control> = {
				id: 'AC-1',
				title: 'Access Control Policy',
				description: 'Test control'
			};

			await fileStore.saveControl(control as Control);

			const expectedPath = join(tempDir, 'controls', 'AC', 'AC-1.yaml');
			expect(existsSync(expectedPath)).toBe(true);

			const content = readFileSync(expectedPath, 'utf8');
			expect(content).toContain('title: Access Control Policy');
			expect(content).toContain('description: Test control');
			expect(content).not.toContain('id:'); // ID should not be saved
		});

		it('should create family directory if it does not exist', async () => {
			const control: Partial<Control> = {
				id: 'NEW-1',
				title: 'New Control Family'
			};

			await fileStore.saveControl(control as Control);

			expect(existsSync(join(tempDir, 'controls', 'NEW'))).toBe(true);
		});

		it('should update control metadata cache', async () => {
			const control: Partial<Control> = {
				id: 'AC-1',
				title: 'Access Control Policy'
			};

			await fileStore.saveControl(control as Control);

			const metadata = fileStore.getControlMetadata('AC-1');
			expect(metadata).toEqual({
				controlId: 'AC-1',
				filename: 'AC-1.yaml',
				family: 'AC'
			});
		});

		it('should preserve existing file format when updating', async () => {
			const control: Partial<Control> = {
				id: 'AC-1',
				title: 'Access Control Policy',
				description: 'Original description'
			};
			await fileStore.saveControl(control as Control);
			const updatedControl: Partial<Control> = {
				id: 'AC-1',
				title: 'Access Control Policy',
				description: 'Updated description'
			};
			await fileStore.saveControl(updatedControl as Control);

			const expectedPath = join(tempDir, 'controls', 'AC', 'AC-1.yaml');
			const content = readFileSync(expectedPath, 'utf8');
			expect(content).toContain('Updated description');
			expect(content).toContain('title: Access Control Policy');
		});

		it('should remove runtime fields before saving', async () => {
			const control: Partial<Control> & {
				timeline?: string;
				unifiedHistory?: string;
				_metadata?: string;
			} = {
				id: 'AC-1',
				title: 'Access Control Policy',
				timeline: 'runtime-only',
				unifiedHistory: 'runtime-only',
				_metadata: 'runtime-only'
			};

			await fileStore.saveControl(control as Control);

			const expectedPath = join(tempDir, 'controls', 'AC', 'AC-1.yaml');
			const content = readFileSync(expectedPath, 'utf8');
			expect(content).not.toContain('timeline');
			expect(content).not.toContain('unifiedHistory');
			expect(content).not.toContain('_metadata');
			expect(content).not.toContain('id:');
		});
	});

	describe('loadControl', () => {
		beforeEach(async () => {
			// Set up test control
			const control: Partial<Control> = {
				id: 'AC-1',
				title: 'Access Control Policy',
				description: 'Test control'
			};
			await fileStore.saveControl(control as Control);
		});

		it('should load a control by ID', async () => {
			const control = await fileStore.loadControl('AC-1');

			expect(control).not.toBeNull();
			expect(control?.id).toBe('AC-1');
			expect(control?.title).toBe('Access Control Policy');
			expect(control?.description).toBe('Test control');
		});

		it('should return null for non-existent control', async () => {
			const control = await fileStore.loadControl('NONEXISTENT-1');
			expect(control).toBeNull();
		});

		it('should ensure control has ID field', async () => {
			const controlsDir = join(tempDir, 'controls', 'TEST');
			mkdirSync(controlsDir, { recursive: true });
			writeFileSync(
				join(controlsDir, 'TEST-1.yaml'),
				'title: Test Control\ndescription: No ID field'
			);

			const control = await fileStore.loadControl('TEST-1');
			expect(control?.id).toBe('TEST-1');
		});

		it('should handle file read errors gracefully', async () => {
			// Mock console.error to suppress stderr output during test
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const controlsDir = join(tempDir, 'controls', 'INVALID');
			mkdirSync(controlsDir, { recursive: true });
			writeFileSync(join(controlsDir, 'INVALID-1.yaml'), 'invalid_yaml: {\n  unclosed_bracket: [');

			await expect(fileStore.loadControl('INVALID-1')).rejects.toThrow();

			// Restore console.error
			consoleSpy.mockRestore();
		});
	});

	describe('deleteControl', () => {
		beforeEach(async () => {
			const control: Partial<Control> = {
				id: 'AC-1',
				title: 'Access Control Policy'
			};
			await fileStore.saveControl(control as Control);
		});

		it('should delete a control file', async () => {
			const expectedPath = join(tempDir, 'controls', 'AC', 'AC-1.yaml');
			expect(existsSync(expectedPath)).toBe(true);

			await fileStore.deleteControl('AC-1');

			expect(existsSync(expectedPath)).toBe(false);
		});

		it('should remove control from metadata cache', async () => {
			expect(fileStore.getControlMetadata('AC-1')).toBeDefined();

			await fileStore.deleteControl('AC-1');

			expect(fileStore.getControlMetadata('AC-1')).toBeUndefined();
		});

		it('should handle deletion of non-existent control gracefully', async () => {
			await expect(fileStore.deleteControl('NONEXISTENT-1')).resolves.not.toThrow();
		});
	});

	describe('loadAllControls', () => {
		beforeEach(async () => {
			// Set up multiple test controls
			const controls: Partial<Control>[] = [
				{ id: 'AC-1', title: 'Access Control Policy 1' },
				{ id: 'AC-2', title: 'Access Control Policy 2' },
				{ id: 'AU-1', title: 'Audit Policy 1' }
			];

			for (const control of controls) {
				await fileStore.saveControl(control as Control);
			}
		});

		it('should load all controls from family directories', async () => {
			const controls = await fileStore.loadAllControls();

			expect(controls).toHaveLength(3);
			expect(controls.map((c) => c.id).sort()).toEqual(['AC-1', 'AC-2', 'AU-1']);
		});

		it('should return empty array when no controls directory exists', async () => {
			const emptyDir = join(process.cwd(), 'test-temp', `empty-${Date.now()}`);
			mkdirSync(emptyDir, { recursive: true });
			const emptyFileStore = new FileStore({ baseDir: emptyDir });

			const controls = await emptyFileStore.loadAllControls();
			expect(controls).toEqual([]);

			rmSync(emptyDir, { recursive: true, force: true });
		});

		it('should handle flat structure (atomic controls)', async () => {
			const controlsDir = join(tempDir, 'controls');
			mkdirSync(controlsDir, { recursive: true });
			writeFileSync(join(controlsDir, 'FLAT-1.yaml'), 'id: FLAT-1\ntitle: Flat Control');

			const controls = await fileStore.loadAllControls();
			const flatControl = controls.find((c) => c.id === 'FLAT-1');
			expect(flatControl?.title).toBe('Flat Control');
		});

		it('should skip controls that fail to load', async () => {
			// Mock console.error to suppress stderr output during test
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const controlsDir = join(tempDir, 'controls', 'INVALID');
			mkdirSync(controlsDir, { recursive: true });
			writeFileSync(join(controlsDir, 'INVALID-1.yaml'), 'invalid_yaml: {\n  unclosed_bracket: [');

			const controls = await fileStore.loadAllControls();
			expect(controls.length).toBeGreaterThan(0);
			expect(controls.every((c) => c.id !== 'INVALID-1')).toBe(true);

			// Restore console.error
			consoleSpy.mockRestore();
		});
	});

	describe('saveMapping', () => {
		it('should save a mapping to the correct control file', async () => {
			const mapping: Partial<Mapping> = {
				uuid: 'test-uuid-1',
				control_id: 'AC-1',
				justification: 'Test mapping',
				source_entries: [],
				status: 'planned'
			};

			await fileStore.saveMapping(mapping as Mapping);

			const expectedPath = join(tempDir, 'mappings', 'AC', 'AC-1-mappings.yaml');
			expect(existsSync(expectedPath)).toBe(true);

			const content = readFileSync(expectedPath, 'utf8');
			expect(content).toContain('uuid: test-uuid-1');
			expect(content).toContain('control_id: AC-1');
		});

		it('should append to existing mappings file', async () => {
			const mapping1: Partial<Mapping> = {
				uuid: 'test-uuid-1',
				control_id: 'AC-1',
				justification: 'First mapping',
				source_entries: [],
				status: 'planned'
			};

			const mapping2: Partial<Mapping> = {
				uuid: 'test-uuid-2',
				control_id: 'AC-1',
				justification: 'Second mapping',
				source_entries: [],
				status: 'planned'
			};

			await fileStore.saveMapping(mapping1 as Mapping);
			await fileStore.saveMapping(mapping2 as Mapping);

			const expectedPath = join(tempDir, 'mappings', 'AC', 'AC-1-mappings.yaml');
			const content = readFileSync(expectedPath, 'utf8');
			expect(content).toContain('test-uuid-1');
			expect(content).toContain('test-uuid-2');
		});

		it('should update existing mapping with same UUID', async () => {
			const mapping: Partial<Mapping> = {
				uuid: 'test-uuid-1',
				control_id: 'AC-1',
				justification: 'Original mapping',
				source_entries: [],
				status: 'planned'
			};

			await fileStore.saveMapping(mapping as Mapping);

			const updatedMapping: Partial<Mapping> = {
				uuid: 'test-uuid-1',
				control_id: 'AC-1',
				justification: 'Updated mapping',
				source_entries: [],
				status: 'implemented'
			};

			await fileStore.saveMapping(updatedMapping as Mapping);

			const expectedPath = join(tempDir, 'mappings', 'AC', 'AC-1-mappings.yaml');
			const content = readFileSync(expectedPath, 'utf8');
			expect(content).toContain('Updated mapping');
			expect(content).toContain('implemented');
			expect(content).not.toContain('Original mapping');
		});
	});

	describe('loadMappings', () => {
		beforeEach(async () => {
			const mappings: Partial<Mapping>[] = [
				{
					uuid: 'uuid-1',
					control_id: 'AC-1',
					justification: 'Mapping 1',
					source_entries: [],
					status: 'planned'
				},
				{
					uuid: 'uuid-2',
					control_id: 'AC-1',
					justification: 'Mapping 2',
					source_entries: [],
					status: 'planned'
				},
				{
					uuid: 'uuid-3',
					control_id: 'AU-1',
					justification: 'Mapping 3',
					source_entries: [],
					status: 'planned'
				}
			];

			for (const mapping of mappings) {
				await fileStore.saveMapping(mapping as Mapping);
			}
		});

		it('should load all mappings from all families', async () => {
			const mappings = await fileStore.loadMappings();

			expect(mappings).toHaveLength(3);
			expect(mappings.map((m) => m.uuid).sort()).toEqual(['uuid-1', 'uuid-2', 'uuid-3']);
		});

		it('should return empty array when no mappings directory exists', async () => {
			const emptyDir = join(process.cwd(), 'test-temp', `empty-mappings-${Date.now()}`);
			mkdirSync(emptyDir, { recursive: true });
			const emptyFileStore = new FileStore({ baseDir: emptyDir });

			const mappings = await emptyFileStore.loadMappings();
			expect(mappings).toEqual([]);

			rmSync(emptyDir, { recursive: true, force: true });
		});

		it('should handle malformed mapping files gracefully', async () => {
			// Mock console.error to suppress stderr output during test
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const mappingsDir = join(tempDir, 'mappings', 'INVALID');
			mkdirSync(mappingsDir, { recursive: true });
			writeFileSync(
				join(mappingsDir, 'INVALID-1-mappings.yaml'),
				'invalid_yaml: {\n  unclosed_bracket: ['
			);

			const mappings = await fileStore.loadMappings();
			expect(mappings.length).toBeGreaterThan(0);

			// Restore console.error
			consoleSpy.mockRestore();
		});
	});

	describe('deleteMapping', () => {
		beforeEach(async () => {
			const mappings: Partial<Mapping>[] = [
				{
					uuid: 'uuid-1',
					control_id: 'AC-1',
					justification: 'Mapping 1',
					source_entries: [],
					status: 'planned'
				},
				{
					uuid: 'uuid-2',
					control_id: 'AC-1',
					justification: 'Mapping 2',
					source_entries: [],
					status: 'planned'
				}
			];

			for (const mapping of mappings) {
				await fileStore.saveMapping(mapping as Mapping);
			}
		});

		it('should delete a specific mapping by UUID', async () => {
			await fileStore.deleteMapping('uuid-1');

			const mappings = await fileStore.loadMappings();
			expect(mappings).toHaveLength(1);
			expect(mappings[0].uuid).toBe('uuid-2');
		});

		it('should delete the entire file when no mappings remain', async () => {
			await fileStore.deleteMapping('uuid-1');
			await fileStore.deleteMapping('uuid-2');

			const expectedPath = join(tempDir, 'mappings', 'AC', 'AC-1-mappings.yaml');
			expect(existsSync(expectedPath)).toBe(false);
		});

		it('should handle deletion of non-existent mapping gracefully', async () => {
			await expect(fileStore.deleteMapping('non-existent-uuid')).resolves.not.toThrow();
		});
	});

	describe('getStats', () => {
		beforeEach(async () => {
			const controls: Partial<Control>[] = [
				{ id: 'AC-1', title: 'Control 1' },
				{ id: 'AC-2', title: 'Control 2' },
				{ id: 'AU-1', title: 'Control 3' }
			];

			for (const control of controls) {
				await fileStore.saveControl(control as Control);
			}

			const mapping: Partial<Mapping> = {
				uuid: 'uuid-1',
				control_id: 'AC-1',
				justification: 'Test mapping',
				source_entries: [],
				status: 'planned'
			};
			await fileStore.saveMapping(mapping as Mapping);
		});

		it('should return correct statistics', () => {
			const stats = fileStore.getStats();

			expect(stats.controlCount).toBe(3);
			expect(stats.familyCount).toBe(2);
			expect(stats.mappingCount).toBeGreaterThanOrEqual(0);
		});
	});

	describe('clearCache', () => {
		beforeEach(async () => {
			const control: Partial<Control> = {
				id: 'AC-1',
				title: 'Access Control Policy'
			};
			await fileStore.saveControl(control as Control);
		});

		it('should clear and refresh the control metadata cache', () => {
			// Mock console.error to suppress stderr output during test
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			expect(fileStore.getControlMetadata('AC-1')).toBeDefined();

			fileStore.clearCache();

			const metadata = fileStore.getControlMetadata('AC-1');
			expect(metadata).toBeDefined();

			// Restore console.error
			consoleSpy.mockRestore();
		});
	});
});
