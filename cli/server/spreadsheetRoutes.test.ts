// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scanControlSets, parseMappingsFromCSV } from './spreadsheetRoutes';
import { getServerState } from './serverState';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import * as yaml from 'js-yaml';

vi.mock('fs');
vi.mock('glob');
vi.mock('js-yaml');
vi.mock('./serverState');
const mockReadFileSync = vi.mocked(readFileSync);
const mockGlob = vi.mocked(glob);
const mockYamlLoad = vi.mocked(yaml.load);
const mockGetServerState = vi.mocked(getServerState);
describe('parseMappingsFromCSV', () => {
	it('should return an empty array for empty input', () => {
		expect(parseMappingsFromCSV('')).toEqual([]);
		expect(parseMappingsFromCSV('   ')).toEqual([]);
	});

	it('should parse a single JSON mapping correctly', () => {
		const input =
			'{"uuid":"550e8400-e29b-41d4-a716-446655440000","status":"verified","description":"Test justification","source_entries":[]}';
		const expectedOutput = [
			{
				uuid: '550e8400-e29b-41d4-a716-446655440000',
				status: 'verified',
				justification: 'Test justification',
				source_entries: []
			}
		];
		expect(parseMappingsFromCSV(input)).toEqual(expectedOutput);
	});

	it('should parse multiple JSON mappings separated by ||', () => {
		const input =
			'{"uuid":"uuid-1","status":"verified","description":"Justification 1","source_entries":[]}||{"uuid":"uuid-2","description":"Justification 2","source_entries":[{"location":"test.ts","shasum":"abc"}]}';
		const expectedOutput = [
			{
				uuid: 'uuid-1',
				status: 'verified',
				justification: 'Justification 1',
				source_entries: []
			},
			{
				uuid: 'uuid-2',
				status: undefined,
				justification: 'Justification 2',
				source_entries: [{ location: 'test.ts', shasum: 'abc' }]
			}
		];
		expect(parseMappingsFromCSV(input)).toEqual(expectedOutput);
	});

	it('should handle mappings with undefined status correctly', () => {
		const input = '{"uuid":"uuid-1","description":"Test description","source_entries":[]}';
		const expectedOutput = [
			{
				uuid: 'uuid-1',
				status: undefined,
				justification: 'Test description',
				source_entries: []
			}
		];
		expect(parseMappingsFromCSV(input)).toEqual(expectedOutput);
	});

	it('should handle complex source entries', () => {
		const input =
			'{"uuid":"uuid-1","status":"implemented","description":"Complex mapping","source_entries":[{"location":"handler.ts","shasum":"asdf"},{"location":"config.yaml","shasum":"1234"}]}';
		const expectedOutput = [
			{
				uuid: 'uuid-1',
				status: 'implemented',
				justification: 'Complex mapping',
				source_entries: [
					{ location: 'handler.ts', shasum: 'asdf' },
					{ location: 'config.yaml', shasum: '1234' }
				]
			}
		];
		expect(parseMappingsFromCSV(input)).toEqual(expectedOutput);
	});

	it('should return empty array for malformed JSON', () => {
		const input = 'invalid json format';
		expect(parseMappingsFromCSV(input)).toEqual([]);
	});

	it('should generate UUID if not provided', () => {
		const input = '{"status":"verified","description":"Test","source_entries":[]}';
		const result = parseMappingsFromCSV(input);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			status: 'verified',
			justification: 'Test',
			source_entries: []
		});
		expect(result[0].uuid).toBeDefined();
		expect(typeof result[0].uuid).toBe('string');
	});
});
describe('spreadsheetRoutes', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mockGetServerState.mockReturnValue({
			CONTROL_SET_DIR: '/test/control-sets',
			currentSubdir: '.',
			fileStore: {} as any,
			gitHistory: {} as any,
			controlsCache: new Map(),
			mappingsCache: new Map(),
			controlsByFamily: new Map(),
			mappingsByFamily: new Map(),
			mappingsByControl: new Map()
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('scanControlSets', () => {
		it('should return empty control sets when no lula.yaml files found', async () => {
			mockGlob.mockResolvedValue([]);

			const result = await scanControlSets();

			expect(result).toEqual({ controlSets: [] });
			expect(mockGlob).toHaveBeenCalledWith('**/lula.yaml', {
				cwd: '/test/control-sets',
				ignore: ['node_modules/**', 'dist/**', 'build/**'],
				maxDepth: 5
			});
		});

		it('should scan and return valid control sets', async () => {
			const mockFiles = ['subfolder1/lula.yaml', 'subfolder2/lula.yaml'];
			mockGlob.mockResolvedValue(mockFiles);

			const mockYamlContent1 = {
				id: 'control-set-1',
				name: 'Test Control Set 1',
				description: 'First test control set',
				controlCount: 10
			};

			const mockYamlContent2 = {
				id: 'control-set-2',
				name: 'Test Control Set 2',
				description: 'Second test control set',
				controlCount: 15
			};

			mockReadFileSync
				.mockReturnValueOnce(yaml.dump(mockYamlContent1))
				.mockReturnValueOnce(yaml.dump(mockYamlContent2));

			mockYamlLoad.mockReturnValueOnce(mockYamlContent1).mockReturnValueOnce(mockYamlContent2);

			const result = await scanControlSets();

			expect(result.controlSets).toHaveLength(2);
			expect(result.controlSets[0]).toEqual({
				path: 'subfolder1',
				name: 'Test Control Set 1',
				description: 'First test control set',
				controlCount: 10,
				file: 'subfolder1/lula.yaml'
			});
			expect(result.controlSets[1]).toEqual({
				path: 'subfolder2',
				name: 'Test Control Set 2',
				description: 'Second test control set',
				controlCount: 15,
				file: 'subfolder2/lula.yaml'
			});
		});

		it('should skip default/placeholder control sets', async () => {
			const mockFiles = ['default/lula.yaml', 'valid/lula.yaml'];
			mockGlob.mockResolvedValue(mockFiles);

			const defaultYamlContent = {
				id: 'default',
				name: 'Default Control Set',
				description: 'Default placeholder'
			};

			const validYamlContent = {
				id: 'valid-set',
				name: 'Valid Control Set',
				description: 'Valid control set',
				controlCount: 5
			};

			mockReadFileSync
				.mockReturnValueOnce(yaml.dump(defaultYamlContent))
				.mockReturnValueOnce(yaml.dump(validYamlContent));

			mockYamlLoad.mockReturnValueOnce(defaultYamlContent).mockReturnValueOnce(validYamlContent);

			const result = await scanControlSets();

			expect(result.controlSets).toHaveLength(1);
			expect(result.controlSets[0]).toEqual({
				path: 'valid',
				name: 'Valid Control Set',
				description: 'Valid control set',
				controlCount: 5,
				file: 'valid/lula.yaml'
			});
		});

		it('should handle invalid yaml files gracefully', async () => {
			const mockFiles = ['invalid/lula.yaml'];
			mockGlob.mockResolvedValue(mockFiles);

			mockReadFileSync.mockReturnValue('invalid yaml content');
			mockYamlLoad.mockImplementation(() => {
				throw new Error('Invalid YAML');
			});

			const result = await scanControlSets();

			expect(result.controlSets).toHaveLength(1);
			expect(result.controlSets[0]).toEqual({
				path: 'invalid',
				name: 'Invalid lula.yaml',
				description: 'Could not parse file',
				controlCount: 0,
				file: 'invalid/lula.yaml'
			});
		});

		it('should handle files in base directory', async () => {
			const mockFiles = ['lula.yaml'];
			mockGlob.mockResolvedValue(mockFiles);

			const mockYamlContent = {
				id: 'base-control-set',
				name: 'Base Control Set',
				description: 'Control set in base directory',
				controlCount: 8
			};

			mockReadFileSync.mockReturnValue(yaml.dump(mockYamlContent));
			mockYamlLoad.mockReturnValue(mockYamlContent);

			const result = await scanControlSets();

			expect(result.controlSets).toHaveLength(1);
			expect(result.controlSets[0]).toEqual({
				path: '.',
				name: 'Base Control Set',
				description: 'Control set in base directory',
				controlCount: 8,
				file: 'lula.yaml'
			});
		});

		it('should provide default values for missing fields', async () => {
			const mockFiles = ['minimal/lula.yaml'];
			mockGlob.mockResolvedValue(mockFiles);

			const minimalYamlContent = {
				id: 'minimal-set'
				// Missing name, description, controlCount
			};

			mockReadFileSync.mockReturnValue(yaml.dump(minimalYamlContent));
			mockYamlLoad.mockReturnValue(minimalYamlContent);

			const result = await scanControlSets();

			expect(result.controlSets).toHaveLength(1);
			expect(result.controlSets[0]).toEqual({
				path: 'minimal',
				name: 'Unnamed Control Set',
				description: '',
				controlCount: 0,
				file: 'minimal/lula.yaml'
			});
		});

		it('should handle file read errors gracefully', async () => {
			const mockFiles = ['error/lula.yaml'];
			mockGlob.mockResolvedValue(mockFiles);

			mockReadFileSync.mockImplementation(() => {
				throw new Error('File read error');
			});

			const result = await scanControlSets();

			expect(result.controlSets).toHaveLength(1);
			expect(result.controlSets[0]).toEqual({
				path: 'error',
				name: 'Invalid lula.yaml',
				description: 'Could not parse file',
				controlCount: 0,
				file: 'error/lula.yaml'
			});
		});

		it('should use the correct base directory from server state', async () => {
			const customBaseDir = '/custom/control/path';
			mockGetServerState.mockReturnValue({
				CONTROL_SET_DIR: customBaseDir,
				currentSubdir: '.',
				fileStore: {} as any,
				gitHistory: {} as any,
				controlsCache: new Map(),
				mappingsCache: new Map(),
				controlsByFamily: new Map(),
				mappingsByFamily: new Map(),
				mappingsByControl: new Map()
			});

			mockGlob.mockResolvedValue([]);

			await scanControlSets();

			expect(mockGlob).toHaveBeenCalledWith('**/lula.yaml', {
				cwd: customBaseDir,
				ignore: ['node_modules/**', 'dist/**', 'build/**'],
				maxDepth: 5
			});
		});

		it('should handle deeply nested control sets', async () => {
			const mockFiles = ['level1/level2/level3/lula.yaml'];
			mockGlob.mockResolvedValue(mockFiles);

			const mockYamlContent = {
				id: 'nested-control-set',
				name: 'Deeply Nested Control Set',
				description: 'Control set in nested directory',
				controlCount: 3
			};

			mockReadFileSync.mockReturnValue(yaml.dump(mockYamlContent));
			mockYamlLoad.mockReturnValue(mockYamlContent);

			const result = await scanControlSets();

			expect(result.controlSets).toHaveLength(1);
			expect(result.controlSets[0]).toEqual({
				path: 'level1/level2/level3',
				name: 'Deeply Nested Control Set',
				description: 'Control set in nested directory',
				controlCount: 3,
				file: 'level1/level2/level3/lula.yaml'
			});
		});

		it('should handle multiple control sets with mixed valid and invalid files', async () => {
			const mockFiles = [
				'valid1/lula.yaml',
				'invalid/lula.yaml',
				'default/lula.yaml',
				'valid2/lula.yaml'
			];
			mockGlob.mockResolvedValue(mockFiles);

			const valid1Content = {
				id: 'valid-1',
				name: 'Valid Control Set 1',
				description: 'First valid control set',
				controlCount: 5
			};

			const defaultContent = {
				id: 'default',
				name: 'Default Control Set',
				description: 'Should be skipped'
			};

			const valid2Content = {
				id: 'valid-2',
				name: 'Valid Control Set 2',
				description: 'Second valid control set',
				controlCount: 7
			};

			mockReadFileSync
				.mockReturnValueOnce(yaml.dump(valid1Content))
				.mockReturnValueOnce('invalid yaml')
				.mockReturnValueOnce(yaml.dump(defaultContent))
				.mockReturnValueOnce(yaml.dump(valid2Content));

			mockYamlLoad
				.mockReturnValueOnce(valid1Content)
				.mockImplementationOnce(() => {
					throw new Error('Invalid YAML');
				})
				.mockReturnValueOnce(defaultContent)
				.mockReturnValueOnce(valid2Content);

			const result = await scanControlSets();

			expect(result.controlSets).toHaveLength(3);

			// Should include valid1
			expect(result.controlSets[0]).toEqual({
				path: 'valid1',
				name: 'Valid Control Set 1',
				description: 'First valid control set',
				controlCount: 5,
				file: 'valid1/lula.yaml'
			});

			// Should include invalid as error entry
			expect(result.controlSets[1]).toEqual({
				path: 'invalid',
				name: 'Invalid lula.yaml',
				description: 'Could not parse file',
				controlCount: 0,
				file: 'invalid/lula.yaml'
			});

			// Should include valid2 (default should be skipped)
			expect(result.controlSets[2]).toEqual({
				path: 'valid2',
				name: 'Valid Control Set 2',
				description: 'Second valid control set',
				controlCount: 7,
				file: 'valid2/lula.yaml'
			});
		});
	});

	describe('error handling', () => {
		it('should handle glob errors gracefully', async () => {
			mockGlob.mockRejectedValue(new Error('Glob error'));

			await expect(scanControlSets()).rejects.toThrow('Glob error');
		});

		it('should handle server state not initialized', () => {
			mockGetServerState.mockImplementation(() => {
				throw new Error('Server state not initialized');
			});

			expect(() => getServerState()).toThrow('Server state not initialized');
		});
	});
});
