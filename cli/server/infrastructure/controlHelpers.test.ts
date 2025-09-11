// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Control } from '../types';
import {
	clearMetadataCache,
	getCachedMetadata,
	getControlId,
	getControlIdField,
	loadControlSetMetadata,
	setControlId
} from './controlHelpers';

describe('controlHelpers', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(process.cwd(), 'test-temp', `controlhelpers-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
		clearMetadataCache();
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}

		clearMetadataCache();
	});

	describe('loadControlSetMetadata', () => {
		it('should load metadata from lula.yaml', () => {
			const metadata = {
				name: 'Test Control Set',
				control_id_field: 'ap-acronym',
				version: '1.0.0'
			};
			writeFileSync(join(tempDir, 'lula.yaml'), JSON.stringify(metadata));

			const result = loadControlSetMetadata(tempDir);

			expect(result.name).toBe('Test Control Set');
			expect(result.control_id_field).toBe('ap-acronym');
			expect(result.version).toBe('1.0.0');
		});

		it('should handle YAML format files', () => {
			const yamlContent = `
name: Test Control Set
control_id_field: ap-acronym
version: 1.0.0
description: A test control set
`;
			writeFileSync(join(tempDir, 'lula.yaml'), yamlContent);

			const result = loadControlSetMetadata(tempDir);

			expect(result.name).toBe('Test Control Set');
			expect(result.control_id_field).toBe('ap-acronym');
			expect(result.description).toBe('A test control set');
		});

		it('should return empty metadata when file does not exist', () => {
			const result = loadControlSetMetadata(tempDir);
			expect(result).toEqual({});
		});

		it('should handle malformed YAML gracefully', () => {
			writeFileSync(join(tempDir, 'lula.yaml'), 'invalid: yaml: content: [[[');

			const result = loadControlSetMetadata(tempDir);
			expect(result).toEqual({});
		});

		it('should cache metadata and not reload on subsequent calls', () => {
			const metadata = { name: 'Original', control_id_field: 'id' };
			writeFileSync(join(tempDir, 'lula.yaml'), JSON.stringify(metadata));

			const result1 = loadControlSetMetadata(tempDir);
			expect(result1.name).toBe('Original');

			const newMetadata = { name: 'Modified', control_id_field: 'ap-acronym' };
			writeFileSync(join(tempDir, 'lula.yaml'), JSON.stringify(newMetadata));

			const result2 = loadControlSetMetadata(tempDir);
			expect(result2.name).toBe('Original');

			clearMetadataCache();
			const result3 = loadControlSetMetadata(tempDir);
			expect(result3.name).toBe('Modified');
		});

		it('should reload metadata when called with different path', () => {
			const metadata1 = { name: 'Control Set 1', control_id_field: 'id' };
			writeFileSync(join(tempDir, 'lula.yaml'), JSON.stringify(metadata1));

			const tempDir2 = join(process.cwd(), 'test-temp', `controlhelpers2-${Date.now()}`);
			mkdirSync(tempDir2, { recursive: true });
			const metadata2 = { name: 'Control Set 2', control_id_field: 'ap-acronym' };
			writeFileSync(join(tempDir2, 'lula.yaml'), JSON.stringify(metadata2));

			const result1 = loadControlSetMetadata(tempDir);
			const result2 = loadControlSetMetadata(tempDir2);

			expect(result1.name).toBe('Control Set 1');
			expect(result2.name).toBe('Control Set 2');

			rmSync(tempDir2, { recursive: true, force: true });
		});
	});

	describe('getControlIdField', () => {
		it('should return configured control ID field', () => {
			const metadata = { control_id_field: 'ap-acronym' };
			writeFileSync(join(tempDir, 'lula.yaml'), JSON.stringify(metadata));

			const field = getControlIdField(tempDir);
			expect(field).toBe('ap-acronym');
		});

		it('should return "id" as default when no field configured', () => {
			const metadata = { name: 'Test Control Set' };
			writeFileSync(join(tempDir, 'lula.yaml'), JSON.stringify(metadata));

			const field = getControlIdField(tempDir);
			expect(field).toBe('id');
		});

		it('should return "id" when no metadata file exists', () => {
			const field = getControlIdField(tempDir);
			expect(field).toBe('id');
		});

		it('should use cached metadata when baseDir not provided', () => {
			const metadata = { control_id_field: 'control-id' };
			writeFileSync(join(tempDir, 'lula.yaml'), JSON.stringify(metadata));

			loadControlSetMetadata(tempDir);

			const field = getControlIdField();
			expect(field).toBe('control-id');
		});
	});

	describe('getControlId', () => {
		beforeEach(() => {
			const metadata = { control_id_field: 'ap-acronym' };
			writeFileSync(join(tempDir, 'lula.yaml'), JSON.stringify(metadata));
		});

		it('should extract ID from configured field', () => {
			const control = {
				'ap-acronym': 'AC-1',
				title: 'Access Control Policy'
			};

			const id = getControlId(control, tempDir);
			expect(id).toBe('AC-1');
		});

		it('should fall back to "id" field when configured field not present', () => {
			const control = {
				id: 'AC-1',
				title: 'Access Control Policy'
			};

			const id = getControlId(control, tempDir);
			expect(id).toBe('AC-1');
		});

		it('should try alternative field names as last resort', () => {
			clearMetadataCache();

			const control = {
				'control-id': 'AC-1',
				title: 'Access Control Policy'
			};

			const id = getControlId(control);
			expect(id).toBe('AC-1');
		});

		it('should handle control_id field', () => {
			clearMetadataCache();

			const control = {
				control_id: 'AC-1',
				title: 'Access Control Policy'
			};

			const id = getControlId(control);
			expect(id).toBe('AC-1');
		});

		it('should handle controlId field', () => {
			clearMetadataCache();

			const control = {
				controlId: 'AC-1',
				title: 'Access Control Policy'
			};

			const id = getControlId(control);
			expect(id).toBe('AC-1');
		});

		it('should throw error when no control ID found', () => {
			const control = {
				title: 'Access Control Policy',
				description: 'No ID field'
			};

			expect(() => getControlId(control, tempDir)).toThrow(
				'No control ID found in control object. Available fields: title, description'
			);
		});

		it('should throw error for invalid control object', () => {
			expect(() => getControlId(null as unknown as Control)).toThrow(
				'Invalid control object provided'
			);
			expect(() => getControlId(undefined as unknown as Control)).toThrow(
				'Invalid control object provided'
			);
			expect(() => getControlId('string' as unknown as Control)).toThrow(
				'Invalid control object provided'
			);
		});

		it('should ignore non-string ID values', () => {
			const control: Partial<Control> & { 'ap-acronym': number } = {
				'ap-acronym': 123,
				id: 'AC-1',
				title: 'Access Control Policy'
			};

			const id = getControlId(control as Control, tempDir);
			expect(id).toBe('AC-1');
		});

		it('should work without baseDir using cached metadata', () => {
			loadControlSetMetadata(tempDir);

			const control = {
				'ap-acronym': 'AC-1',
				title: 'Access Control Policy'
			};

			const id = getControlId(control);
			expect(id).toBe('AC-1');
		});
	});

	describe('setControlId', () => {
		beforeEach(() => {
			const metadata = { control_id_field: 'ap-acronym' };
			writeFileSync(join(tempDir, 'lula.yaml'), JSON.stringify(metadata));
		});

		it('should set ID in configured field', () => {
			const control: Partial<Control> = {
				title: 'Access Control Policy'
			};

			setControlId(control as Control, 'AC-1', tempDir);

			expect(control['ap-acronym']).toBe('AC-1');
			expect(control.id).toBe('AC-1');
		});

		it('should set only id field when configured field is "id"', () => {
			const metadata = { control_id_field: 'id' };
			writeFileSync(join(tempDir, 'lula.yaml'), JSON.stringify(metadata));
			clearMetadataCache(); // Force reload

			const control: Partial<Control> = {
				title: 'Access Control Policy'
			};

			setControlId(control as Control, 'AC-1', tempDir);

			expect(control.id).toBe('AC-1');
			expect(control['ap-acronym']).toBeUndefined();
		});

		it('should throw error for invalid control object', () => {
			expect(() => setControlId(null as unknown as Control, 'AC-1')).toThrow(
				'Invalid control object provided'
			);
			expect(() => setControlId(undefined as unknown as Control, 'AC-1')).toThrow(
				'Invalid control object provided'
			);
		});

		it('should throw error for invalid ID', () => {
			const control = { title: 'Test' };

			expect(() => setControlId(control, null as unknown as string)).toThrow(
				'Invalid control ID provided'
			);
			expect(() => setControlId(control, undefined as unknown as string)).toThrow(
				'Invalid control ID provided'
			);
			expect(() => setControlId(control, 123 as unknown as string)).toThrow(
				'Invalid control ID provided'
			);
		});

		it('should work without baseDir using cached metadata', () => {
			loadControlSetMetadata(tempDir);

			const control: Partial<Control> = {
				title: 'Access Control Policy'
			};

			setControlId(control as Control, 'AC-1');

			expect((control as Record<string, unknown>)['ap-acronym']).toBe('AC-1');
			expect(control.id).toBe('AC-1');
		});
	});

	describe('clearMetadataCache', () => {
		it('should clear cached metadata', () => {
			const metadata = { control_id_field: 'ap-acronym' };
			writeFileSync(join(tempDir, 'lula.yaml'), JSON.stringify(metadata));

			loadControlSetMetadata(tempDir);
			expect(getCachedMetadata()).not.toBeNull();

			clearMetadataCache();
			expect(getCachedMetadata()).toBeNull();
		});
	});

	describe('getCachedMetadata', () => {
		it('should return null when no metadata cached', () => {
			expect(getCachedMetadata()).toBeNull();
		});

		it('should return cached metadata after loading', () => {
			const metadata = {
				name: 'Test Control Set',
				control_id_field: 'ap-acronym'
			};
			writeFileSync(join(tempDir, 'lula.yaml'), JSON.stringify(metadata));

			loadControlSetMetadata(tempDir);

			const cached = getCachedMetadata();
			expect(cached).not.toBeNull();
			expect(cached?.name).toBe('Test Control Set');
			expect(cached?.control_id_field).toBe('ap-acronym');
		});
	});

	describe('edge cases and error handling', () => {
		it('should handle empty control object', () => {
			const control = {};

			expect(() => getControlId(control)).toThrow('No control ID found in control object');
		});

		it('should handle control with empty string ID', () => {
			const control = {
				id: '',
				'ap-acronym': 'AC-1'
			};

			const id = getControlId(control, tempDir);
			expect(id).toBe('AC-1'); // Should skip empty string and use alternative
		});

		it('should handle metadata with non-string control_id_field', () => {
			const metadata = { control_id_field: 123 }; // Invalid type
			writeFileSync(join(tempDir, 'lula.yaml'), JSON.stringify(metadata));

			const field = getControlIdField(tempDir);
			expect(field).toBe(123);
		});

		it('should preserve existing control properties when setting ID', () => {
			const metadata = { control_id_field: 'ap-acronym' };
			writeFileSync(join(tempDir, 'lula.yaml'), JSON.stringify(metadata));
			clearMetadataCache();

			const control: Partial<Control> & { existingProp: string } = {
				title: 'Test Control',
				description: 'Test description',
				existingProp: 'should remain'
			};

			setControlId(control as Control, 'AC-1', tempDir);

			expect(control.title).toBe('Test Control');
			expect(control.description).toBe('Test description');
			expect(control.existingProp).toBe('should remain');
			expect(control['ap-acronym']).toBe('AC-1');
			expect(control.id).toBe('AC-1');
		});
	});
});
