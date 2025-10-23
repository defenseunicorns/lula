// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

// Mock SvelteKit environment before any other imports
vi.mock('$app/environment', () => ({
	browser: true,
	dev: true,
	building: false,
	version: 'test'
}));

import type { Control, Mapping } from '$lib/types';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import {
	activeFilters,
	complianceStore,
	controls,
	mappings,
	searchTerm,
	selectedControl
} from './compliance';

// Mock console methods to avoid log output during tests
let consoleSpies: {
	log: ReturnType<typeof vi.fn>;
	error: ReturnType<typeof vi.fn>;
	warn: ReturnType<typeof vi.fn>;
	info: ReturnType<typeof vi.fn>;
	debug: ReturnType<typeof vi.fn>;
};

describe('complianceStore', () => {
	const mockControls: Control[] = [
		{
			id: 'AC-1',
			title: 'Access Control Policy and Procedures',
			family: 'AC',
			'control-acronym': 'AC-1',
			_metadata: { family: 'AC' }
		},
		{
			id: 'AU-1',
			title: 'Audit and Accountability Policy and Procedures',
			family: 'AU',
			'control-acronym': 'AU-1',
			_metadata: { family: 'AU' }
		},
		{
			id: 'AC-2',
			title: 'Account Management',
			family: 'AC',
			'control-acronym': 'AC-2',
			_metadata: { family: 'AC' }
		}
	];

	const mockMappings: Mapping[] = [
		{
			uuid: 'mapping-1',
			control_id: 'AC-1',
			justification: 'Test justification',
			source_entries: [{ location: 'test.yaml' }],
			status: 'implemented'
		},
		{
			uuid: 'mapping-2',
			control_id: 'AC-2',
			justification: 'Another test justification',
			source_entries: [{ location: 'test2.yaml' }],
			status: 'planned'
		},
		{
			uuid: 'mapping-3',
			control_id: 'AU-1',
			justification: 'Audit justification',
			source_entries: [{ location: 'audit.yaml' }],
			status: 'verified'
		}
	];

	beforeEach(() => {
		consoleSpies = {
			log: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
			info: vi.fn(),
			debug: vi.fn()
		};

		vi.spyOn(console, 'log').mockImplementation(consoleSpies.log);
		vi.spyOn(console, 'error').mockImplementation(consoleSpies.error);
		vi.spyOn(console, 'warn').mockImplementation(consoleSpies.warn);
		vi.spyOn(console, 'info').mockImplementation(consoleSpies.info);
		vi.spyOn(console, 'debug').mockImplementation(consoleSpies.debug);

		controls.set([]);
		mappings.set([]);
		searchTerm.set('');
		activeFilters.set([]);
		selectedControl.set(null);
	});

	afterEach(() => {
		Object.values(consoleSpies).forEach((spy) => spy.mockRestore());
	});

	describe('complianceStore actions', () => {
		describe('setSearchTerm', () => {
			it('should update search term', () => {
				complianceStore.setSearchTerm('test search');

				expect(get(searchTerm)).toBe('test search');
			});

			it('should handle empty search term', () => {
				complianceStore.setSearchTerm('');

				expect(get(searchTerm)).toBe('');
			});

			it('should handle null/undefined search term', () => {
				// @ts-expect-error - Testing invalid input handling
				complianceStore.setSearchTerm(null);
				expect(get(searchTerm)).toBe('');

				// @ts-expect-error - Testing invalid input handling
				complianceStore.setSearchTerm(undefined);
				expect(get(searchTerm)).toBe('');
			});
		});

		describe('addFilter', () => {
			it('should add a filter condition', () => {
				complianceStore.addFilter('status', 'equals', 'Open');

				const filters = get(activeFilters);
				expect(filters).toHaveLength(1);
				expect(filters[0].fieldName).toBe('status');
				expect(filters[0].operator).toBe('equals');
				expect(filters[0].value).toBe('Open');
			});

			it('should add multiple filter conditions', () => {
				complianceStore.addFilter('status', 'equals', 'Open');
				complianceStore.addFilter('family', 'equals', 'AC');

				const filters = get(activeFilters);
				expect(filters).toHaveLength(2);
				expect(filters[0].fieldName).toBe('status');
				expect(filters[1].fieldName).toBe('family');
			});

			it('should handle different filter operators', () => {
				complianceStore.addFilter('title', 'includes', 'Access');
				complianceStore.addFilter('status', 'not_equals', 'Closed');

				const filters = get(activeFilters);
				expect(filters).toHaveLength(2);
				expect(filters[0].operator).toBe('includes');
				expect(filters[1].operator).toBe('not_equals');
			});

			it('should handle exists and not_exists operators', () => {
				complianceStore.addFilter('title', 'exists');
				complianceStore.addFilter('description', 'not_exists');

				const filters = get(activeFilters);
				expect(filters).toHaveLength(2);
				expect(filters[0].operator).toBe('exists');
				expect(filters[1].operator).toBe('not_exists');
			});

			it('should handle mapping_status with equals and not_equals operators', () => {
				complianceStore.addFilter('mapping_status', 'equals', 'implemented');
				complianceStore.addFilter('mapping_status', 'not_equals', 'planned');

				const filters = get(activeFilters);
				expect(filters).toHaveLength(2);
				expect(filters[0].operator).toBe('equals');
				expect(filters[0].value).toBe('implemented');
				expect(filters[1].operator).toBe('not_equals');
				expect(filters[1].value).toBe('planned');
			});
		});

		describe('removeFilter', () => {
			it('should remove a specific filter by index', () => {
				complianceStore.addFilter('status', 'equals', 'Open');
				complianceStore.addFilter('family', 'equals', 'AC');

				complianceStore.removeFilter(0);

				const filters = get(activeFilters);
				expect(filters).toHaveLength(1);
				expect(filters[0].fieldName).toBe('family');
			});

			it('should handle removing non-existent filter index', () => {
				complianceStore.addFilter('status', 'equals', 'Open');

				complianceStore.removeFilter(5); // Out of bounds index

				const filters = get(activeFilters);
				expect(filters).toHaveLength(1); // Should still have the original filter
			});

			it('should handle removing from empty filters', () => {
				complianceStore.removeFilter(0);

				const filters = get(activeFilters);
				expect(filters).toHaveLength(0);
			});
		});

		describe('updateFilter', () => {
			it('should update an existing filter', () => {
				complianceStore.addFilter('status', 'equals', 'Open');
				complianceStore.updateFilter(0, { operator: 'not_equals', value: 'Closed' });

				const filters = get(activeFilters);
				expect(filters).toHaveLength(1);
				expect(filters[0].operator).toBe('not_equals');
				expect(filters[0].value).toBe('Closed');
				expect(filters[0].fieldName).toBe('status'); // Should preserve original fieldName
			});

			it('should handle updating non-existent filter index', () => {
				complianceStore.addFilter('status', 'equals', 'Open');
				complianceStore.updateFilter(5, { operator: 'not_equals' });

				const filters = get(activeFilters);
				expect(filters).toHaveLength(1);
				expect(filters[0].operator).toBe('equals');
			});

			it('should handle negative filter index', () => {
				complianceStore.addFilter('status', 'equals', 'Open');
				complianceStore.updateFilter(-1, { operator: 'not_equals' });

				const filters = get(activeFilters);
				expect(filters).toHaveLength(1);
				expect(filters[0].operator).toBe('equals');
			});
		});

		describe('setSelectedControl', () => {
			it('should update selected control', () => {
				const control = mockControls[0];
				complianceStore.setSelectedControl(control);

				expect(get(selectedControl)).toEqual(control);
			});

			it('should handle null control', () => {
				complianceStore.setSelectedControl(null);

				expect(get(selectedControl)).toBeNull();
			});

			it('should strip mappings property from control', () => {
				const controlWithMappings: Control & { mappings: Mapping[] } = {
					...mockControls[0],
					mappings: mockMappings
				};

				complianceStore.setSelectedControl(controlWithMappings);

				const selected = get(selectedControl);
				expect(selected).toBeDefined();
				expect('mappings' in selected!).toBe(false);
				expect(selected!.id).toBe(mockControls[0].id);
			});

			it('should handle control with extra properties', () => {
				const controlWithExtras: Control & { extraProp: string; mappings: Mapping[] } = {
					...mockControls[0],
					extraProp: 'should be preserved',
					mappings: mockMappings
				};

				complianceStore.setSelectedControl(controlWithExtras);

				const selected = get(selectedControl) as Control & { extraProp: string };
				expect(selected).toBeDefined();
				expect('mappings' in selected).toBe(false);
				expect(selected.extraProp).toBe('should be preserved');
			});
		});

		describe('clearFilters', () => {
			it('should reset search term and active filters', () => {
				searchTerm.set('test');
				activeFilters.set([
					{
						fieldName: 'status',
						operator: 'equals',
						value: 'Open'
					}
				]);

				complianceStore.clearFilters();

				expect(get(searchTerm)).toBe('');
				expect(get(activeFilters)).toEqual([]);
			});

			it('should work when filters are already empty', () => {
				complianceStore.clearFilters();

				expect(get(searchTerm)).toBe('');
				expect(get(activeFilters)).toEqual([]);
			});
		});

		describe('getAvailableFields', () => {
			it('should return available fields from controls', () => {
				controls.set(mockControls);

				const fields = complianceStore.getAvailableFields();

				expect(fields).toContain('id');
				expect(fields).toContain('title');
				expect(fields).toContain('family');
				expect(fields).toContain('control-acronym');
				expect(fields).not.toContain('_metadata'); // Should exclude internal fields
			});

			it('should return only mappings when no controls are loaded', () => {
				controls.set([]);

				const fields = complianceStore.getAvailableFields();

				expect(fields).toEqual(['has_mappings', 'mapping_status']);
			});

			it('should return unique sorted fields', () => {
				controls.set(mockControls);

				const fields = complianceStore.getAvailableFields();

				// Check that fields are sorted
				const sortedFields = [...fields].sort();
				expect(fields).toEqual(sortedFields);

				// Check that fields are unique (no duplicates)
				const uniqueFields = [...new Set(fields)];
				expect(fields).toEqual(uniqueFields);
			});
		});
	});

	describe('store integration', () => {
		beforeEach(() => {
			controls.set(mockControls);
			mappings.set(mockMappings);
		});

		it('should work with direct store manipulation', () => {
			// Test that we can directly manipulate the stores
			controls.set([mockControls[0]]);
			mappings.set([mockMappings[0]]);

			expect(get(controls)).toEqual([mockControls[0]]);
			expect(get(mappings)).toEqual([mockMappings[0]]);
		});

		it('should handle store updates after adding filters', () => {
			complianceStore.addFilter('family', 'equals', 'AC');

			// Update controls after adding filter
			controls.set([
				...mockControls,
				{
					id: 'AC-3',
					title: 'Access Control Monitoring',
					family: 'AC',
					'control-acronym': 'AC-3',
					_metadata: { family: 'AC' }
				}
			]);

			const filters = get(activeFilters);
			expect(filters).toHaveLength(1);
			expect(get(controls)).toHaveLength(4);
		});
	});

	describe('edge cases and error handling', () => {
		it('should handle malformed control data', () => {
			const malformedControls = [
				{ id: 'AC-1' }, // Missing required fields
				{ id: 'AC-2', title: 'Valid Control', family: 'AC' }
			];

			controls.set(malformedControls as Control[]);
			const stored = get(controls);
			expect(stored).toHaveLength(2);
		});

		it('should handle malformed mapping data', () => {
			const malformedMappings = [
				{ uuid: 'mapping-1', control_id: 'AC-1' }, // Missing other fields
				mockMappings[0] // Valid mapping
			];

			mappings.set(malformedMappings as Mapping[]);
			const stored = get(mappings);
			expect(stored).toHaveLength(2);
		});

		it('should handle filter operations with undefined values', () => {
			complianceStore.addFilter('status', 'equals'); // No value provided

			const filters = get(activeFilters);
			expect(filters).toHaveLength(1);
			expect(filters[0].value).toBeUndefined();
		});

		it('should handle multiple rapid filter updates', () => {
			for (let i = 0; i < 10; i++) {
				complianceStore.addFilter(`field${i}`, 'equals', `value${i}`);
			}

			const filters = get(activeFilters);
			expect(filters).toHaveLength(10);
		});

		it('should handle special characters in filter values', () => {
			const specialValues = ['test@example.com', 'AC-1/2', 'value with spaces', '日本語'];

			specialValues.forEach((value, index) => {
				complianceStore.addFilter(`field${index}`, 'equals', value);
			});

			const filters = get(activeFilters);
			expect(filters).toHaveLength(4);
			filters.forEach((filter, index) => {
				expect(filter.value).toBe(specialValues[index]);
			});
		});
	});
});
