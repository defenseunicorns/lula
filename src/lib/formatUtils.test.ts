// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { describe, expect, it } from 'vitest';
import { formatValue } from './formatUtils';

describe('formatUtils', () => {
	describe('formatValue', () => {
		it('should format null values', () => {
			expect(formatValue(null)).toBe('null');
		});

		it('should format undefined values', () => {
			expect(formatValue(undefined)).toBe('undefined');
		});

		it('should format string values with quotes', () => {
			expect(formatValue('hello')).toBe('"hello"');
			expect(formatValue('')).toBe('""');
			expect(formatValue('hello "world"')).toBe('"hello "world""');
		});

		it('should format numbers as strings', () => {
			expect(formatValue(42)).toBe('42');
			expect(formatValue(3.14)).toBe('3.14');
			expect(formatValue(0)).toBe('0');
			expect(formatValue(-10)).toBe('-10');
		});

		it('should format booleans as strings', () => {
			expect(formatValue(true)).toBe('true');
			expect(formatValue(false)).toBe('false');
		});

		it('should format simple objects as YAML', () => {
			const obj = { name: 'test', value: 42 };
			const result = formatValue(obj);

			expect(result).toContain('name: test');
			expect(result).toContain('value: 42');
			expect(result).not.toContain('\n\n'); // Should be trimmed
		});

		it('should format arrays as YAML', () => {
			const arr = ['item1', 'item2', 'item3'];
			const result = formatValue(arr);

			expect(result).toContain('- item1');
			expect(result).toContain('- item2');
			expect(result).toContain('- item3');
		});

		it('should format nested objects as YAML', () => {
			const obj = {
				level1: {
					level2: {
						value: 'deep'
					}
				},
				array: [1, 2, 3]
			};
			const result = formatValue(obj);

			expect(result).toContain('level1:');
			expect(result).toContain('level2:');
			expect(result).toContain('value: deep');
			expect(result).toContain('array:');
			expect(result).toContain('- 1');
		});

		it('should handle complex data types', () => {
			const date = new Date('2023-01-01T00:00:00Z');
			const result = formatValue(date);

			// Date should be formatted as YAML (likely as a string representation)
			expect(typeof result).toBe('string');
			expect(result.length).toBeGreaterThan(0);
		});

		it('should handle special string values', () => {
			expect(formatValue('true')).toBe('"true"');
			expect(formatValue('false')).toBe('"false"');
			expect(formatValue('null')).toBe('"null"');
			expect(formatValue('123')).toBe('"123"');
		});

		it('should handle empty objects and arrays', () => {
			expect(formatValue({})).toBe('{}');
			expect(formatValue([])).toBe('[]');
		});

		it('should handle objects with special characters', () => {
			const obj = {
				'key-with-dashes': 'value',
				'key with spaces': 'another value',
				'key.with.dots': 123
			};
			const result = formatValue(obj);

			expect(result).toContain('key-with-dashes: value');
			expect(result).toContain('key with spaces: another value');
			expect(result).toContain('key.with.dots: 123');
		});

		it('should handle arrays with mixed types', () => {
			const arr = ['string', 42, true, null, { nested: 'object' }];
			const result = formatValue(arr);

			expect(result).toContain('- string');
			expect(result).toContain('- 42');
			expect(result).toContain('- true');
			expect(result).toContain('- null');
			expect(result).toContain('nested: object');
		});

		it('should handle circular references gracefully', () => {
			const obj: Record<string, unknown> = { name: 'test' };
			obj.self = obj;

			const result = formatValue(obj);
			expect(typeof result).toBe('string');
		});

		it('should handle very large numbers', () => {
			expect(formatValue(Number.MAX_SAFE_INTEGER)).toBe(String(Number.MAX_SAFE_INTEGER));
			expect(formatValue(Number.MIN_SAFE_INTEGER)).toBe(String(Number.MIN_SAFE_INTEGER));
			expect(formatValue(Infinity)).toBe('Infinity');
			expect(formatValue(-Infinity)).toBe('-Infinity');
			expect(formatValue(NaN)).toBe('NaN');
		});

		it('should handle symbols', () => {
			const sym = Symbol('test');
			const result = formatValue(sym);

			expect(result).toContain('Symbol(test)');
		});

		it('should handle functions', () => {
			const fn = function testFunction() {
				return 'test';
			};
			const result = formatValue(fn);

			expect(typeof result).toBe('string');
			expect(result.length).toBeGreaterThan(0);
		});

		it('should handle Map and Set objects', () => {
			const map = new Map([
				['key1', 'value1'],
				['key2', 'value2']
			]);
			const set = new Set(['item1', 'item2', 'item3']);

			const mapResult = formatValue(map);
			const setResult = formatValue(set);

			expect(typeof mapResult).toBe('string');
			expect(typeof setResult).toBe('string');
		});

		it('should trim whitespace from YAML output', () => {
			const obj = {
				multiline: 'line1\nline2\nline3',
				simple: 'value'
			};
			const result = formatValue(obj);

			expect(result).toBe(result.trim());
		});

		it('should preserve special YAML characters in strings', () => {
			const specialChars = [':', '[', ']', '{', '}', '|', '>', '&', '*', '#', '!'];

			for (const char of specialChars) {
				const result = formatValue(char);
				expect(result).toBe(`"${char}"`);
			}
		});

		it('should handle Unicode characters', () => {
			const unicode = '🎉 Unicode test: αβγ ∑∞';
			const result = formatValue(unicode);

			expect(result).toBe(`"${unicode}"`);
		});
	});
});
