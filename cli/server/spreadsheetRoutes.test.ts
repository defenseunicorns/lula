// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	scanControlSets,
	processImportParameters,
	parseUploadedFile,
	processSpreadsheetData,
	buildFieldSchema,
	createOutputStructure,
	applyNamingConvention,
	toCamelCase,
	toSnakeCase,
	toKebabCase,
	detectValueType,
	parseCSV,
	extractFamilyFromControlId
} from './spreadsheetRoutes';
import type { ImportParameters } from './spreadsheetRoutes';
import { getServerState } from './serverState';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { glob } from 'glob';
import * as yaml from 'js-yaml';
import * as XLSX from 'xlsx-republish';

vi.mock('fs');
vi.mock('glob');
vi.mock('js-yaml');
vi.mock('./serverState');
vi.mock('xlsx-republish', () => ({
	read: vi.fn(),
	utils: {
		sheet_to_json: vi.fn()
	}
}));
vi.mock('crypto', () => ({
	default: {
		randomUUID: vi.fn(() => 'test-uuid-123')
	}
}));

const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockExistsSync = vi.mocked(existsSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockGlob = vi.mocked(glob);
const mockYamlLoad = vi.mocked(yaml.load);
const mockYamlDump = vi.mocked(yaml.dump);
const mockGetServerState = vi.mocked(getServerState);
const mockXLSXRead = vi.mocked(XLSX.read);
const mockXLSXSheetToJson = vi.mocked(XLSX.utils.sheet_to_json);

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

	describe('processImportParameters', () => {
		it('should extract basic parameters with defaults', () => {
			const reqBody = {
				controlIdField: 'ID',
				startRow: '2',
				controlSetName: 'Test Control Set',
				controlSetDescription: 'Test Description'
			};

			const result = processImportParameters(reqBody);

			expect(result).toEqual({
				controlIdField: 'ID',
				startRow: '2',
				controlSetName: 'Test Control Set',
				controlSetDescription: 'Test Description',
				justificationFields: [],
				namingConvention: 'kebab-case',
				skipEmpty: true,
				skipEmptyRows: true,
				frontendFieldSchema: null
			});
		});

		it('should use default values when parameters are missing', () => {
			const reqBody = {};

			const result = processImportParameters(reqBody);

			expect(result).toEqual({
				controlIdField: 'Control ID',
				startRow: '1',
				controlSetName: 'Imported Control Set',
				controlSetDescription: 'Imported from spreadsheet',
				justificationFields: [],
				namingConvention: 'kebab-case',
				skipEmpty: true,
				skipEmptyRows: true,
				frontendFieldSchema: null
			});
		});

		it('should parse justification fields from JSON', () => {
			const reqBody = {
				justificationFields: '["field1", "field2", "field3"]'
			};

			const result = processImportParameters(reqBody);

			expect(result.justificationFields).toEqual(['field1', 'field2', 'field3']);
		});

		it('should handle invalid justification fields JSON gracefully', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const reqBody = {
				justificationFields: 'invalid json'
			};

			const result = processImportParameters(reqBody);

			expect(result.justificationFields).toEqual([]);
			expect(consoleSpy).toHaveBeenCalledWith(
				'Failed to parse justification fields:',
				expect.any(Error)
			);

			consoleSpy.mockRestore();
		});

		it('should parse frontend field schema from JSON', () => {
			const fieldSchema = [{ fieldName: 'test-field', tab: 'overview', required: true }];
			const reqBody = {
				fieldSchema: JSON.stringify(fieldSchema)
			};

			const result = processImportParameters(reqBody);

			expect(result.frontendFieldSchema).toEqual(fieldSchema);
		});

		it('should handle invalid field schema JSON gracefully', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const reqBody = {
				fieldSchema: 'invalid json'
			};

			const result = processImportParameters(reqBody);

			expect(result.frontendFieldSchema).toBeNull();
			expect(consoleSpy).toHaveBeenCalledWith('Failed to parse fieldSchema:', expect.any(Error));

			consoleSpy.mockRestore();
		});
	});

	describe('parseUploadedFile', () => {
		it('should parse CSV files correctly', async () => {
			const mockFile = {
				originalname: 'test.csv',
				buffer: Buffer.from('Name,Age,City\nJohn,30,NYC\nJane,25,LA')
			};

			const result = await parseUploadedFile(mockFile);

			expect(result).toEqual([
				['Name', 'Age', 'City'],
				['John', '30', 'NYC'],
				['Jane', '25', 'LA']
			]);
		});

		it('should parse Excel files correctly', async () => {
			const mockWorkbook = {
				SheetNames: ['Sheet1'],
				Sheets: {
					Sheet1: {}
				}
			};

			const mockSheetData = [
				['Name', 'Age', 'City'],
				['John', 30, 'NYC']
			];

			mockXLSXRead.mockReturnValue(mockWorkbook as any);
			mockXLSXSheetToJson.mockReturnValue(mockSheetData as any);

			const mockFile = {
				originalname: 'test.xlsx',
				buffer: Buffer.from('mock excel data')
			};

			const result = await parseUploadedFile(mockFile);

			expect(result).toEqual([
				['Name', 'Age', 'City'],
				['John', 30, 'NYC']
			]);
		});

		it('should throw error when Excel file has no worksheets', async () => {
			const mockWorkbook = {
				SheetNames: [],
				Sheets: {}
			};

			mockXLSXRead.mockReturnValue(mockWorkbook as any);

			const mockFile = {
				originalname: 'test.xlsx',
				buffer: Buffer.from('mock excel data')
			};

			await expect(parseUploadedFile(mockFile)).rejects.toThrow('No worksheet found in file');
		});
	});

	describe('processSpreadsheetData', () => {
		const mockParams: ImportParameters = {
			controlIdField: 'Control ID',
			startRow: '1',
			controlSetName: 'Test Set',
			controlSetDescription: 'Test Description',
			justificationFields: [],
			namingConvention: 'kebab-case',
			skipEmpty: true,
			skipEmptyRows: true,
			frontendFieldSchema: null
		};

		it('should process spreadsheet data correctly', () => {
			const rawData = [
				['Control ID', 'Title', 'Description'], // headers at index 0
				['AC-1', 'Access Control Policy', 'Develop access control policy'], // data starts at index 1
				['AC-2', 'Account Management', 'Manage user accounts']
			];
			const headers = rawData[0] as string[];
			const startRowIndex = 0;

			const result = processSpreadsheetData(rawData, headers, startRowIndex, mockParams);

			expect(result.controls).toHaveLength(2);
			expect(result.controls[0]).toMatchObject({
				'control-id': 'AC-1',
				title: 'Access Control Policy',
				description: 'Develop access control policy',
				family: 'AC'
			});
			expect(result.controls[1]).toMatchObject({
				'control-id': 'AC-2',
				title: 'Account Management',
				description: 'Manage user accounts',
				family: 'AC'
			});

			expect(result.families.has('AC')).toBe(true);
			expect(result.families.get('AC')).toHaveLength(2);
		});

		it('should skip rows without control ID', () => {
			const rawData = [
				['Control ID', 'Title'],
				['AC-1', 'Valid Control'],
				['', 'Invalid - No ID'],
				[null, 'Invalid - Null ID'],
				['AC-2', 'Another Valid Control']
			];
			const headers = rawData[0] as string[];
			const startRowIndex = 0;

			const result = processSpreadsheetData(rawData, headers, startRowIndex, mockParams);

			expect(result.controls).toHaveLength(2);
			expect(result.controls[0]['control-id']).toBe('AC-1');
			expect(result.controls[1]['control-id']).toBe('AC-2');
		});

		it('should handle empty rows correctly when skipEmptyRows is true', () => {
			const rawData = [
				['Control ID', 'Title'],
				['AC-1', 'Valid Control'],
				[], // Empty row
				['AC-2', 'Another Valid Control']
			];
			const headers = rawData[0] as string[];
			const startRowIndex = 0;

			const result = processSpreadsheetData(rawData, headers, startRowIndex, mockParams);

			expect(result.controls).toHaveLength(2);
		});

		it('should collect field metadata correctly', () => {
			const rawData = [
				['Control ID', 'Title', 'Priority'],
				['AC-1', 'Short Title', 'High'],
				['AC-2', 'This is a much longer title that exceeds normal length', 'Low'],
				['AC-3', 'Medium Title', 'Medium']
			];
			const headers = rawData[0] as string[];
			const startRowIndex = 0;

			const result = processSpreadsheetData(rawData, headers, startRowIndex, mockParams);

			const titleMetadata = result.fieldMetadata.get('title');
			expect(titleMetadata).toBeDefined();
			expect(titleMetadata!.maxLength).toBeGreaterThan(50); // Should capture the long title length
			expect(titleMetadata!.uniqueValues.size).toBe(3);
			expect(titleMetadata!.totalCount).toBe(3);
		});

		it('should detect different value types correctly', () => {
			const rawData = [
				['Control ID', 'Number Field', 'Boolean Field', 'Date Field'],
				['AC-1', '123', 'true', '2023-01-01'],
				['AC-2', '456.78', 'false', '12/31/2023'],
				['AC-3', '0', 'yes', '01/15/2024']
			];
			const headers = rawData[0] as string[];
			const startRowIndex = 0;

			const result = processSpreadsheetData(rawData, headers, startRowIndex, mockParams);

			const numberMetadata = result.fieldMetadata.get('number-field');
			const booleanMetadata = result.fieldMetadata.get('boolean-field');
			const dateMetadata = result.fieldMetadata.get('date-field');

			expect(numberMetadata!.type).toBe('number');
			expect(booleanMetadata!.type).toBe('boolean');
			expect(dateMetadata!.type).toBe('date');
		});
	});

	describe('buildFieldSchema', () => {
		it('should build field schema correctly with family field', () => {
			const mockFieldMetadata = new Map();
			mockFieldMetadata.set('control-id', {
				originalName: 'Control ID',
				type: 'string',
				maxLength: 10,
				hasMultipleLines: false,
				uniqueValues: new Set(['AC-1', 'AC-2']),
				emptyCount: 0,
				totalCount: 2,
				examples: ['AC-1', 'AC-2']
			});

			const mockControls = [
				{ 'control-id': 'AC-1', family: 'AC' },
				{ 'control-id': 'AC-2', family: 'AC' }
			];

			const mockFamilies = new Map();
			mockFamilies.set('AC', mockControls);

			const mockParams: ImportParameters = {
				controlIdField: 'Control ID',
				startRow: '1',
				controlSetName: 'Test Set',
				controlSetDescription: 'Test Description',
				justificationFields: [],
				namingConvention: 'kebab-case',
				skipEmpty: true,
				skipEmptyRows: true,
				frontendFieldSchema: null
			};

			const result = buildFieldSchema(mockFieldMetadata, mockControls, mockParams, mockFamilies);

			expect(result.fields.family).toBeDefined();
			expect(result.fields.family).toMatchObject({
				type: 'string',
				ui_type: 'select',
				usage_count: 2,
				usage_percentage: 100,
				required: true,
				category: 'core'
			});

			expect(result.fields['control-id']).toBeDefined();
			expect(result.fields['control-id']).toMatchObject({
				type: 'string',
				required: true,
				editable: false,
				category: 'core'
			});
		});

		it('should handle frontend field schema configuration', () => {
			const mockFieldMetadata = new Map();
			mockFieldMetadata.set('custom-field', {
				originalName: 'Custom Field',
				type: 'string',
				maxLength: 20,
				hasMultipleLines: false,
				uniqueValues: new Set(['value1', 'value2']),
				emptyCount: 0,
				totalCount: 2,
				examples: ['value1']
			});

			const mockControls = [{ 'custom-field': 'value1' }];
			const mockFamilies = new Map();

			const mockParams: ImportParameters = {
				controlIdField: 'Control ID',
				startRow: '1',
				controlSetName: 'Test Set',
				controlSetDescription: 'Test Description',
				justificationFields: [],
				namingConvention: 'kebab-case',
				skipEmpty: true,
				skipEmptyRows: true,
				frontendFieldSchema: [
					{
						fieldName: 'custom-field',
						tab: 'custom',
						category: 'custom',
						required: false,
						displayOrder: 5
					}
				]
			};

			const result = buildFieldSchema(mockFieldMetadata, mockControls, mockParams, mockFamilies);

			expect(result.fields['custom-field']).toMatchObject({
				category: 'custom',
				tab: 'custom',
				display_order: 5,
				required: false
			});
		});

		it('should determine appropriate UI types based on metadata', () => {
			const mockFieldMetadata = new Map();

			// Textarea field (long text)
			mockFieldMetadata.set('long-description', {
				originalName: 'Long Description',
				type: 'string',
				maxLength: 1000,
				hasMultipleLines: true,
				uniqueValues: new Set(['long text']),
				emptyCount: 0,
				totalCount: 1,
				examples: ['long text']
			});

			// Select field (few unique values)
			mockFieldMetadata.set('status', {
				originalName: 'Status',
				type: 'string',
				maxLength: 10,
				hasMultipleLines: false,
				uniqueValues: new Set(['active', 'inactive']),
				emptyCount: 0,
				totalCount: 10,
				examples: ['active']
			});

			const mockControls = [{}];
			const mockFamilies = new Map();
			const mockParams: ImportParameters = {
				controlIdField: 'Control ID',
				startRow: '1',
				controlSetName: 'Test Set',
				controlSetDescription: 'Test Description',
				justificationFields: [],
				namingConvention: 'kebab-case',
				skipEmpty: true,
				skipEmptyRows: true,
				frontendFieldSchema: null
			};

			const result = buildFieldSchema(mockFieldMetadata, mockControls, mockParams, mockFamilies);

			expect(result.fields['long-description']).toMatchObject({
				ui_type: 'textarea'
			});

			expect(result.fields['status']).toMatchObject({
				ui_type: 'select',
				options: ['active', 'inactive']
			});
		});
	});

	describe('createOutputStructure', () => {
		beforeEach(() => {
			mockExistsSync.mockReturnValue(false);
			mockYamlDump.mockReturnValue('mocked yaml content');
		});

		it('should create directory structure and files correctly', async () => {
			const mockProcessedData = {
				controls: [{ 'control-id': 'AC-1', title: 'Test Control', family: 'AC' }],
				families: new Map([['AC', [{ 'control-id': 'AC-1', title: 'Test Control', family: 'AC' }]]])
			};

			const mockFieldSchema = {
				fields: {
					'control-id': { type: 'string' },
					title: { type: 'string' }
				}
			};

			const mockParams: ImportParameters = {
				controlIdField: 'Control ID',
				startRow: '1',
				controlSetName: 'Test Control Set',
				controlSetDescription: 'Test Description',
				justificationFields: [],
				namingConvention: 'kebab-case',
				skipEmpty: true,
				skipEmptyRows: true,
				frontendFieldSchema: null
			};

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

			const result = await createOutputStructure(mockProcessedData, mockFieldSchema, mockParams);

			expect(result.folderName).toBe('test-control-set');
			expect(mockMkdirSync).toHaveBeenCalledWith('/test/control-sets/test-control-set', {
				recursive: true
			});
			expect(mockMkdirSync).toHaveBeenCalledWith(
				'/test/control-sets/test-control-set/controls/AC',
				{ recursive: true }
			);
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				'/test/control-sets/test-control-set/lula.yaml',
				'mocked yaml content'
			);
		});

		it('should handle justification fields correctly', async () => {
			const mockProcessedData = {
				controls: [
					{
						'control-id': 'AC-1',
						title: 'Test Control',
						family: 'AC',
						'justification-field': 'This is justification text'
					}
				],
				families: new Map([
					[
						'AC',
						[
							{
								'control-id': 'AC-1',
								title: 'Test Control',
								family: 'AC',
								'justification-field': 'This is justification text'
							}
						]
					]
				])
			};

			const mockFieldSchema = {
				fields: {
					'control-id': { type: 'string' },
					title: { type: 'string' },
					'justification-field': { type: 'string' }
				}
			};

			const mockParams: ImportParameters = {
				controlIdField: 'Control ID',
				startRow: '1',
				controlSetName: 'Test Control Set',
				controlSetDescription: 'Test Description',
				justificationFields: ['justification-field'],
				namingConvention: 'kebab-case',
				skipEmpty: true,
				skipEmptyRows: true,
				frontendFieldSchema: null
			};

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

			await createOutputStructure(mockProcessedData, mockFieldSchema, mockParams);

			// Should create a mapping file with justification
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				'/test/control-sets/test-control-set/mappings/AC/AC-1-mappings.yaml',
				'mocked yaml content'
			);
		});

		it('should skip directory creation if it already exists', async () => {
			mockExistsSync.mockReturnValue(true); // Directory already exists

			const mockProcessedData = {
				controls: [],
				families: new Map()
			};

			const mockFieldSchema = { fields: {} };

			const mockParams: ImportParameters = {
				controlIdField: 'Control ID',
				startRow: '1',
				controlSetName: 'Test Control Set',
				controlSetDescription: 'Test Description',
				justificationFields: [],
				namingConvention: 'kebab-case',
				skipEmpty: true,
				skipEmptyRows: true,
				frontendFieldSchema: null
			};

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

			await createOutputStructure(mockProcessedData, mockFieldSchema, mockParams);

			expect(mockMkdirSync).not.toHaveBeenCalled();
		});
	});

	describe('applyNamingConvention', () => {
		it('should return empty string for empty input', () => {
			expect(applyNamingConvention('', 'kebab-case')).toBe('');
			expect(applyNamingConvention(null as any, 'kebab-case')).toBe(null);
			expect(applyNamingConvention(undefined as any, 'kebab-case')).toBe(undefined);
		});

		it('should apply camelCase convention', () => {
			expect(applyNamingConvention('control id', 'camelCase')).toBe('controlId');
			expect(applyNamingConvention('Control ID Field', 'camelCase')).toBe('controlIDField');
			expect(applyNamingConvention('UPPER CASE', 'camelCase')).toBe('uPPERCASE');
		});

		it('should apply snake_case convention', () => {
			expect(applyNamingConvention('Control ID', 'snake_case')).toBe('control_id');
			expect(applyNamingConvention('Field Name', 'snake_case')).toBe('field_name');
			expect(applyNamingConvention('Multi Word Field', 'snake_case')).toBe('multi_word_field');
		});

		it('should apply kebab-case convention', () => {
			expect(applyNamingConvention('Control ID', 'kebab-case')).toBe('control-id');
			expect(applyNamingConvention('Field Name', 'kebab-case')).toBe('field-name');
			expect(applyNamingConvention('Multi Word Field', 'kebab-case')).toBe('multi-word-field');
		});

		it('should apply lowercase convention', () => {
			expect(applyNamingConvention('Control ID', 'lowercase')).toBe('controlid');
			expect(applyNamingConvention('Field Name!@#', 'lowercase')).toBe('fieldname');
		});

		it('should return original for original convention', () => {
			expect(applyNamingConvention('Control ID', 'original')).toBe('Control ID');
			expect(applyNamingConvention('  Trimmed  ', 'original')).toBe('Trimmed');
		});

		it('should default to camelCase for unknown convention', () => {
			expect(applyNamingConvention('Control ID', 'unknown')).toBe('controlID');
		});
	});

	describe('toCamelCase', () => {
		it('should convert simple words to camelCase', () => {
			expect(toCamelCase('control id')).toBe('controlId');
			expect(toCamelCase('field name')).toBe('fieldName');
		});

		it('should handle multiple words', () => {
			expect(toCamelCase('control id field name')).toBe('controlIdFieldName');
			expect(toCamelCase('this is a test')).toBe('thisIsATest');
		});

		it('should handle already camelCase strings', () => {
			expect(toCamelCase('controlId')).toBe('controlId');
			expect(toCamelCase('alreadyCamelCase')).toBe('alreadyCamelCase');
		});

		it('should handle strings with special characters', () => {
			expect(toCamelCase('control-id-field')).toBe('control-Id-Field');
			expect(toCamelCase('field_name_test')).toBe('field_name_test');
		});

		it('should handle single words', () => {
			expect(toCamelCase('control')).toBe('control');
			expect(toCamelCase('ID')).toBe('iD');
		});

		it('should handle empty strings', () => {
			expect(toCamelCase('')).toBe('');
		});
	});

	describe('toSnakeCase', () => {
		it('should convert simple words to snake_case', () => {
			expect(toSnakeCase('Control ID')).toBe('control_id');
			expect(toSnakeCase('Field Name')).toBe('field_name');
		});

		it('should handle multiple words', () => {
			expect(toSnakeCase('Control ID Field Name')).toBe('control_id_field_name');
		});

		it('should handle special characters', () => {
			expect(toSnakeCase('Control-ID@Field#Name')).toBe('control_id_field_name');
		});

		it('should handle already snake_case strings', () => {
			expect(toSnakeCase('control_id')).toBe('control_id');
		});

		it('should handle camelCase input', () => {
			expect(toSnakeCase('controlIdField')).toBe('controlidfield');
		});

		it('should handle empty strings', () => {
			expect(toSnakeCase('')).toBe('');
		});
	});

	describe('toKebabCase', () => {
		it('should convert simple words to kebab-case', () => {
			expect(toKebabCase('Control ID')).toBe('control-id');
			expect(toKebabCase('Field Name')).toBe('field-name');
		});

		it('should handle multiple words', () => {
			expect(toKebabCase('Control ID Field Name')).toBe('control-id-field-name');
		});

		it('should handle special characters', () => {
			expect(toKebabCase('Control@ID#Field%Name')).toBe('control-id-field-name');
		});

		it('should handle already kebab-case strings', () => {
			expect(toKebabCase('control-id')).toBe('control-id');
		});

		it('should handle camelCase input', () => {
			expect(toKebabCase('controlIdField')).toBe('controlidfield');
		});

		it('should handle empty strings', () => {
			expect(toKebabCase('')).toBe('');
		});
	});

	describe('detectValueType', () => {
		it('should detect boolean values', () => {
			expect(detectValueType(true)).toBe('boolean');
			expect(detectValueType(false)).toBe('boolean');
		});

		it('should detect number values', () => {
			expect(detectValueType(123)).toBe('number');
			expect(detectValueType(123.456)).toBe('number');
			expect(detectValueType(0)).toBe('number');
		});

		it('should detect boolean strings', () => {
			expect(detectValueType('true')).toBe('boolean');
			expect(detectValueType('false')).toBe('boolean');
			expect(detectValueType('TRUE')).toBe('boolean');
			expect(detectValueType('FALSE')).toBe('boolean');
			expect(detectValueType('yes')).toBe('boolean');
			expect(detectValueType('no')).toBe('boolean');
			expect(detectValueType('y')).toBe('boolean');
			expect(detectValueType('n')).toBe('boolean');
			expect(detectValueType('YES')).toBe('boolean');
			expect(detectValueType('NO')).toBe('boolean');
		});

		it('should detect number strings', () => {
			expect(detectValueType('123')).toBe('number');
			expect(detectValueType('123.456')).toBe('number');
			expect(detectValueType('-123')).toBe('number');
			expect(detectValueType('0')).toBe('number');
		});

		it('should detect date strings', () => {
			expect(detectValueType('2023-01-01')).toBe('date');
			expect(detectValueType('12/31/2023')).toBe('date');
			expect(detectValueType('1/1/23')).toBe('date');
			expect(detectValueType('01/01/2023')).toBe('date');
		});

		it('should detect regular strings', () => {
			expect(detectValueType('hello world')).toBe('string');
			expect(detectValueType('control description')).toBe('string');
			expect(detectValueType('AC-1')).toBe('string');
			expect(detectValueType('')).toBe('string');
		});

		it('should handle edge cases', () => {
			expect(detectValueType('   ')).toBe('string'); // Whitespace only
			expect(detectValueType('123abc')).toBe('string'); // Mixed alphanumeric
			expect(detectValueType('2023-13-01')).toBe('date'); // This matches date pattern even if invalid
			expect(detectValueType('maybe')).toBe('string'); // Non-boolean word
		});

		it('should handle null and undefined', () => {
			expect(detectValueType(null)).toBe('string');
			expect(detectValueType(undefined)).toBe('string');
		});
	});

	describe('parseCSV', () => {
		it('should parse simple CSV content', () => {
			const csvContent = 'Name,Age,City\nJohn,30,NYC\nJane,25,LA';
			const result = parseCSV(csvContent);

			expect(result).toEqual([
				['Name', 'Age', 'City'],
				['John', '30', 'NYC'],
				['Jane', '25', 'LA']
			]);
		});

		it('should handle CSV with quoted fields', () => {
			const csvContent =
				'Name,Description\n"John Doe","A person with, comma"\n"Jane Smith","Another ""quoted"" field"';
			const result = parseCSV(csvContent);

			expect(result).toHaveLength(3); // Header + 2 data rows
			expect(result[0]).toEqual(['Name', 'Description']);
		});

		it('should handle empty CSV content', () => {
			const result = parseCSV('');
			expect(result).toEqual([]);
		});

		it('should handle CSV with different line endings', () => {
			const csvContent = 'Name,Age\r\nJohn,30\r\nJane,25';
			const result = parseCSV(csvContent);

			expect(result).toHaveLength(3);
			expect(result[0]).toEqual(['Name', 'Age']);
		});

		it('should handle malformed CSV gracefully', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			// Simulate csv-parse throwing an error
			const mockParseCSVSync = vi.fn().mockImplementation(() => {
				throw new Error('Parse error');
			});

			// Mock the import to throw an error
			vi.doMock('csv-parse/sync', () => ({
				parse: mockParseCSVSync
			}));

			const csvContent = 'Name,Age\nJohn,30,"invalid';
			const result = parseCSV(csvContent);

			// Should fallback to simple split
			expect(result).toBeInstanceOf(Array);
			expect(consoleSpy).toHaveBeenCalledWith('CSV parsing error:', expect.any(Error));

			consoleSpy.mockRestore();
		});

		it('should skip empty lines when configured', () => {
			const csvContent = 'Name,Age\n\nJohn,30\n\nJane,25\n';
			const result = parseCSV(csvContent);

			// Should have header + 2 data rows (empty lines skipped)
			expect(result).toHaveLength(3);
			expect(result[1]).toEqual(['John', '30']);
		});
	});

	describe('extractFamilyFromControlId', () => {
		it('should extract family from standard control ID patterns', () => {
			expect(extractFamilyFromControlId('AC-1')).toBe('AC');
			expect(extractFamilyFromControlId('AU-2')).toBe('AU');
			expect(extractFamilyFromControlId('CM-3')).toBe('CM');
			expect(extractFamilyFromControlId('IA-4')).toBe('IA');
		});

		it('should handle different delimiters', () => {
			expect(extractFamilyFromControlId('AC.1')).toBe('AC');
			expect(extractFamilyFromControlId('AU_2')).toBe('AU');
			expect(extractFamilyFromControlId('CM 3')).toBe('CM');
		});

		it('should handle multi-character families', () => {
			expect(extractFamilyFromControlId('PL-1')).toBe('PL');
			expect(extractFamilyFromControlId('RA-2')).toBe('RA');
			expect(extractFamilyFromControlId('SC-3')).toBe('SC');
			expect(extractFamilyFromControlId('SI-4')).toBe('SI');
		});

		it('should handle lowercase input', () => {
			expect(extractFamilyFromControlId('ac-1')).toBe('AC');
			expect(extractFamilyFromControlId('au-2')).toBe('AU');
		});

		it('should handle IDs without numbers', () => {
			expect(extractFamilyFromControlId('ACCESS')).toBe('ACCESS');
			expect(extractFamilyFromControlId('AUDIT')).toBe('AUDIT');
		});

		it('should handle empty or invalid input', () => {
			expect(extractFamilyFromControlId('')).toBe('UNKNOWN');
			expect(extractFamilyFromControlId(null as any)).toBe('UNKNOWN');
			expect(extractFamilyFromControlId(undefined as any)).toBe('UNKNOWN');
		});

		it('should handle IDs starting with numbers', () => {
			expect(extractFamilyFromControlId('123-TEST')).toBe('12');
			expect(extractFamilyFromControlId('99')).toBe('99');
		});

		it('should handle whitespace', () => {
			expect(extractFamilyFromControlId('  AC-1  ')).toBe('AC');
			expect(extractFamilyFromControlId('\t\nAU-2\t\n')).toBe('AU');
		});

		it('should handle complex control IDs', () => {
			expect(extractFamilyFromControlId('AC-1(1)')).toBe('AC');
			expect(extractFamilyFromControlId('AU-2.a')).toBe('AU');
			expect(extractFamilyFromControlId('CM-3 (1) (a)')).toBe('CM');
		});

		it('should use first two characters as fallback', () => {
			expect(extractFamilyFromControlId('ABCDEFG')).toBe('ABCDEFG'); // Should get first letter match
			expect(extractFamilyFromControlId('##')).toBe('##');
			expect(extractFamilyFromControlId('!@')).toBe('!@');
		});
	});

	describe('git API endpoints', () => {
		let mockGitHistoryUtil: any;

		beforeEach(() => {
			mockGitHistoryUtil = {
				getGitStatus: vi.fn(),
				pullChanges: vi.fn()
			};

			mockGetServerState.mockReturnValue({
				CONTROL_SET_DIR: '/test/control-sets',
				currentSubdir: '.',
				fileStore: {} as any,
				gitHistory: mockGitHistoryUtil,
				controlsCache: new Map(),
				mappingsCache: new Map(),
				controlsByFamily: new Map(),
				mappingsByFamily: new Map(),
				mappingsByControl: new Map()
			});
		});

		describe('GET /api/git-status', () => {
			it('should return git status when successful', async () => {
				const mockGitStatus = {
					isGitRepository: true,
					currentBranch: 'main',
					branchInfo: {
						currentBranch: 'main',
						isAhead: false,
						isBehind: true,
						aheadCount: 0,
						behindCount: 2,
						lastCommitDate: '2023-01-01T00:00:00Z',
						lastCommitMessage: 'Test commit',
						hasUnpushedChanges: false
					},
					canPull: true,
					canPush: false
				};

				mockGitHistoryUtil.getGitStatus.mockResolvedValue(mockGitStatus);

				const result = await mockGitHistoryUtil.getGitStatus();
				expect(result).toEqual(mockGitStatus);
				expect(mockGitHistoryUtil.getGitStatus).toHaveBeenCalledTimes(1);
			});

			it('should handle git status errors', async () => {
				mockGitHistoryUtil.getGitStatus.mockRejectedValue(new Error('Git error'));

				try {
					await mockGitHistoryUtil.getGitStatus();
				} catch (error) {
					expect(error).toBeInstanceOf(Error);
					expect((error as Error).message).toBe('Git error');
				}
			});

			it('should return default status when not in git repository', async () => {
				const mockGitStatus = {
					isGitRepository: false,
					currentBranch: null,
					branchInfo: null,
					canPull: false,
					canPush: false
				};

				mockGitHistoryUtil.getGitStatus.mockResolvedValue(mockGitStatus);

				const result = await mockGitHistoryUtil.getGitStatus();
				expect(result).toEqual(mockGitStatus);
			});
		});

		describe('POST /api/git-pull', () => {
			it('should successfully pull changes', async () => {
				const mockPullResult = {
					success: true,
					message: 'Successfully pulled changes from origin/main'
				};

				mockGitHistoryUtil.pullChanges.mockResolvedValue(mockPullResult);

				const result = await mockGitHistoryUtil.pullChanges();
				expect(result).toEqual(mockPullResult);
				expect(mockGitHistoryUtil.pullChanges).toHaveBeenCalledTimes(1);
			});

			it('should handle pull errors', async () => {
				const mockPullResult = {
					success: false,
					message: 'Network error'
				};

				mockGitHistoryUtil.pullChanges.mockResolvedValue(mockPullResult);

				const result = await mockGitHistoryUtil.pullChanges();
				expect(result).toEqual(mockPullResult);
			});

			it('should handle pull when not in git repository', async () => {
				const mockPullResult = {
					success: false,
					message: 'Not in a git repository'
				};

				mockGitHistoryUtil.pullChanges.mockResolvedValue(mockPullResult);

				const result = await mockGitHistoryUtil.pullChanges();
				expect(result).toEqual(mockPullResult);
			});

			it('should handle missing current branch', async () => {
				const mockPullResult = {
					success: false,
					message: 'Could not determine current branch'
				};

				mockGitHistoryUtil.pullChanges.mockResolvedValue(mockPullResult);

				const result = await mockGitHistoryUtil.pullChanges();
				expect(result).toEqual(mockPullResult);
			});
		});

		describe('git service integration', () => {
			it('should use the correct git history instance from server state', () => {
				const serverState = getServerState();
				expect(serverState.gitHistory).toBe(mockGitHistoryUtil);
			});

			it('should handle rate limiting for git operations', async () => {
				const promises = Array(10)
					.fill(null)
					.map(() => mockGitHistoryUtil.getGitStatus());

				mockGitHistoryUtil.getGitStatus.mockResolvedValue({
					isGitRepository: true,
					currentBranch: 'main',
					branchInfo: null,
					canPull: false,
					canPush: false
				});

				await Promise.all(promises);
				expect(mockGitHistoryUtil.getGitStatus).toHaveBeenCalledTimes(10);
			});
		});
	});
});
