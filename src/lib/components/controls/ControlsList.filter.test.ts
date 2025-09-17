// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { describe, it, expect } from 'vitest';
import type { Control } from '$lib/types';

// Mock control data that matches the fake-controls structure
const mockControls: Control[] = [
	{
		id: 'AC-1.3',
		family: 'AC',
		'control-acronym': 'AC-1',
		'test-results': 'example test result',
		title: 'Access Control Policy and Procedures',
		'control-information': 'Description: The organization develops...',
		mappings: []
	} as any,
	{
		id: 'AC-1.2',
		family: 'AC',
		'control-acronym': 'AC-1',
		'test-results': 'failed test result',
		title: 'Access Control Policy Dissemination',
		'control-information': 'Description: The organization disseminates...',
		mappings: []
	} as any,
	{
		id: 'AC-1.4',
		family: 'AC',
		'control-acronym': 'AC-1',
		'test-results': 'example passed',
		title: 'Access Control Policy Review',
		'control-information': 'Description: The organization reviews...',
		mappings: []
	} as any,
	{
		id: 'AC-1.5',
		family: 'AC',
		'control-acronym': 'AC-1',
		title: 'Access Control Procedures',
		'control-information': 'Description: The organization establishes...',
		mappings: []
	} as any
];

// Filter evaluation function - extracted from ControlsList.svelte filtering logic
function evaluateFilter(
	filter: { fieldName: string; operator: string; value: any },
	fieldValue: any
): boolean {
	switch (filter.operator) {
		case 'equals':
			return fieldValue === filter.value;
			
		case 'not_equals':
			return fieldValue !== filter.value;
			
		case 'exists':
			return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
			
		case 'not_exists':
			return fieldValue === undefined || fieldValue === null || fieldValue === '';
			
		case 'includes':
			if (typeof fieldValue === 'string') {
				return fieldValue.toLowerCase().includes(String(filter.value).toLowerCase());
			} else if (Array.isArray(fieldValue)) {
				return fieldValue.some(item => 
					String(item).toLowerCase().includes(String(filter.value).toLowerCase())
				);
			}
			return false;
			
		case 'not_includes':
			if (typeof fieldValue === 'string') {
				return !fieldValue.toLowerCase().includes(String(filter.value).toLowerCase());
			} else if (Array.isArray(fieldValue)) {
				return !fieldValue.some(item => 
					String(item).toLowerCase().includes(String(filter.value).toLowerCase())
				);
			}
			return true;
			
		default:
			return true;
	}
}

// Apply filters function - extracted from ControlsList.svelte filtering logic
function applyFilters(
	controls: Control[],
	filters: Array<{ fieldName: string; operator: string; value: any }>
): Control[] {
	if (filters.length === 0) {
		return controls;
	}

	return controls.filter((control) => {
		// Control must match all filters
		return filters.every(filter => {
			// Handle special case for family field which might be in different locations
			let fieldValue;
			if (filter.fieldName === 'family') {
				// Cast to ControlWithDynamicFields for dynamic field access
				const dynamicControl = control as ControlWithDynamicFields;
				// Enhanced controls have family in _metadata.family, fallback to extracting from control-acronym
				fieldValue = dynamicControl._metadata?.family ||
					dynamicControl.family ||
					(dynamicControl['control-acronym'] ? dynamicControl['control-acronym'].split('-')[0] : '') ||
					'';
			} else {
				// Cast to ControlWithDynamicFields for dynamic field access
				const dynamicControl = control as ControlWithDynamicFields;
				fieldValue = dynamicControl[filter.fieldName];
			}
			
			return evaluateFilter(filter, fieldValue);
		});
	});
}

describe('ControlsList Filter Tests', () => {
	it('should filter controls by test-results field using includes operator', () => {
		const filter = {
			fieldName: 'test-results',
			operator: 'includes',
			value: 'example'
		};

		const result = applyFilters(mockControls, [filter]);
		
		// Should match AC-1.3 (has "example test result") and AC-1.4 (has "example passed")
		expect(result).toHaveLength(2);
		expect(result.map(c => c.id)).toEqual(['AC-1.3', 'AC-1.4']);
	});

	it('should filter controls by test-results field using equals operator', () => {
		const filter = {
			fieldName: 'test-results',
			operator: 'equals',
			value: 'failed test result'
		};

		const result = applyFilters(mockControls, [filter]);
		
		// Should match only AC-1.2
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('AC-1.2');
	});

	it('should filter controls by test-results field using exists operator', () => {
		const filter = {
			fieldName: 'test-results',
			operator: 'exists',
			value: undefined
		};

		const result = applyFilters(mockControls, [filter]);
		
		// Should match AC-1.3, AC-1.2, and AC-1.4 (all have test-results field)
		expect(result).toHaveLength(3);
		expect(result.map(c => c.id)).toEqual(['AC-1.3', 'AC-1.2', 'AC-1.4']);
	});

	it('should filter controls by test-results field using not_exists operator', () => {
		const filter = {
			fieldName: 'test-results',
			operator: 'not_exists',
			value: undefined
		};

		const result = applyFilters(mockControls, [filter]);
		
		// Should match only AC-1.5 (does not have test-results field)
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('AC-1.5');
	});

	it('should show available keys for debugging', () => {
		const control = mockControls[0] as ControlWithDynamicFields;
		const availableKeys = Object.keys(control);
		
		console.log('Available keys in mock control:', availableKeys);
		console.log('Test-related keys:', availableKeys.filter(k => k.toLowerCase().includes('test')));
		console.log('test-results value:', control['test-results']);
		
		// Verify that test-results field is present
		expect(availableKeys).toContain('test-results');
		expect(control['test-results']).toBe('example test result');
	});

	it('should handle case-insensitive filtering correctly', () => {
		const filter = {
			fieldName: 'test-results',
			operator: 'includes',
			value: 'EXAMPLE'
		};

		const result = applyFilters(mockControls, [filter]);
		
		// Should still match AC-1.3 and AC-1.4 despite case difference
		expect(result).toHaveLength(2);
		expect(result.map(c => c.id)).toEqual(['AC-1.3', 'AC-1.4']);
	});

	it('should handle multiple filters correctly', () => {
		const filters = [
			{
				fieldName: 'test-results',
				operator: 'exists',
				value: undefined
			},
			{
				fieldName: 'family',
				operator: 'equals',
				value: 'AC'
			}
		];

		const result = applyFilters(mockControls, filters);
		
		// Should match AC-1.3, AC-1.2, and AC-1.4 (all have test-results AND are in AC family)
		expect(result).toHaveLength(3);
		expect(result.map(c => c.id)).toEqual(['AC-1.3', 'AC-1.2', 'AC-1.4']);
	});
});
