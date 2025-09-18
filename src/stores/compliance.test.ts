// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import type { Control, Mapping } from '$lib/types';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	activeFilters,
	complianceStore,
	controls,
	controlsWithMappings,
	filteredControls,
	mappings,
	searchTerm,
	selectedControl
} from './compliance';

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
		}
	];

	beforeEach(() => {
		controls.set([]);
		mappings.set([]);
		searchTerm.set('');
		activeFilters.set([]);
		selectedControl.set(null);
	});

	describe('filteredControls derived store', () => {
		beforeEach(() => {
			controls.set(mockControls);
		});

		it('should return all controls when no filters are applied', () => {
			const filtered = get(filteredControls);
			expect(filtered).toEqual(mockControls);
		});

		// Test data for filter operator tests
		const testControls = [
			{
				id: 'TEST-1',
				title: 'Test Control One',
				status: 'Open',
				description: 'This is a test control with status Open',
				family: 'TEST'
			},
			{
				id: 'TEST-2',
				title: 'Test Control Two',
				status: 'Closed',
				description: 'This is a test control with status Closed',
				family: 'TEST'
			},
			{
				id: 'TEST-3',
				title: 'Test Control Three',
				// No status field
				description: 'This is a test control with no status',
				family: 'TEST'
			},
			{
				id: 'TEST-4',
				title: 'Test Control Four',
				status: 'In Progress',
				description: 'This control contains the word Open in description but status is different',
				family: 'TEST'
			}
		] as Control[];

		it('should filter with equals operator', () => {
			controls.set(testControls);
			activeFilters.set([
				{
					fieldName: 'status',
					operator: 'equals',
					value: 'Open'
				}
			]);

			const filtered = get(filteredControls);
			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe('TEST-1');
		});

		it('should filter with equals operator on multi-line text', () => {
			// Create controls with multi-line text
			controls.set([
				{
					id: 'ML-1',
					title: 'Multi-line Test Control 1',
					family: 'ML',
					'test-results': 'This is a test\nwith multiple lines\nspanning across newlines'
				},
				{
					id: 'ML-2',
					title: 'Multi-line Test Control 2',
					family: 'ML',
					'test-results': 'This is a test with multiple lines spanning across newlines'
				}
			]);

			// Filter for exact match ignoring newlines
			activeFilters.set([
				{
					fieldName: 'test-results',
					operator: 'equals',
					value: 'This is a test with multiple lines spanning across newlines'
				}
			]);

			const filtered = get(filteredControls);
			expect(filtered).toHaveLength(2); // Both should match after normalization
			expect(filtered.some(c => c.id === 'ML-1')).toBe(true);
			expect(filtered.some(c => c.id === 'ML-2')).toBe(true);
		});

		it('should filter with not_equals operator', () => {
			controls.set(testControls);
			activeFilters.set([
				{
					fieldName: 'status',
					operator: 'not_equals',
					value: 'Open'
				}
			]);

			const filtered = get(filteredControls);
			// Should return controls with status != 'Open' and those without status
			// The expected behavior should include TEST-2, TEST-3, and TEST-4
			expect(filtered).toHaveLength(3);
			expect(filtered.some((c) => c.id === 'TEST-1')).toBe(false);
			expect(filtered.some((c) => c.id === 'TEST-2')).toBe(true);
			expect(filtered.some((c) => c.id === 'TEST-3')).toBe(true);
			expect(filtered.some((c) => c.id === 'TEST-4')).toBe(true);
		});

		it('should filter with exists operator', () => {
			controls.set(testControls);
			activeFilters.set([
				{
					fieldName: 'status',
					operator: 'exists'
				}
			]);

			const filtered = get(filteredControls);
			// Should return controls that have a status field
			expect(filtered).toHaveLength(3);
			expect(filtered.some((c) => c.id === 'TEST-3')).toBe(false);
		});

		it('should filter with not_exists operator', () => {
			controls.set(testControls);
			activeFilters.set([
				{
					fieldName: 'status',
					operator: 'not_exists'
				}
			]);

			const filtered = get(filteredControls);
			// Should return controls that don't have a status field
			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe('TEST-3');
		});

		it('should filter with includes operator', () => {
			controls.set(testControls);
			activeFilters.set([
				{
					fieldName: 'description',
					operator: 'includes',
					value: 'Open'
				}
			]);

			const filtered = get(filteredControls);
			// Should return controls with 'Open' in the description
			expect(filtered).toHaveLength(2);
			expect(filtered.some((c) => c.id === 'TEST-1')).toBe(true);
			expect(filtered.some((c) => c.id === 'TEST-4')).toBe(true);
		});

		it('should filter with includes operator across newlines', () => {
			// Create a control with multi-line text
			controls.set([
				{
					id: 'ML-1',
					title: 'Multi-line Test Control',
					family: 'ML',
					'test-results': 'This is a test\nwith multiple lines\nspanning across newlines'
				}
			]);

			// Filter for text that spans a newline
			activeFilters.set([
				{
					fieldName: 'test-results',
					operator: 'includes',
					value: 'test with multiple'
				}
			]);

			const filtered = get(filteredControls);
			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe('ML-1');
		});

		it('should filter with not_includes operator', () => {
			controls.set(testControls);
			activeFilters.set([
				{
					fieldName: 'description',
					operator: 'not_includes',
					value: 'Open'
				}
			]);

			const filtered = get(filteredControls);
			// Should return controls without 'Open' in the description
			expect(filtered).toHaveLength(2);
			expect(filtered.some((c) => c.id === 'TEST-2')).toBe(true);
			expect(filtered.some((c) => c.id === 'TEST-3')).toBe(true);
		});

		it('should filter by family using activeFilters', () => {
			activeFilters.set([
				{
					fieldName: 'family',
					operator: 'equals',
					value: 'AC'
				}
			]);

			const filtered = get(filteredControls);
			expect(filtered).toHaveLength(2);
			expect(filtered.every((c) => c.family === 'AC')).toBe(true);
		});

		it('should filter by search term', () => {
			searchTerm.set('management');

			const filtered = get(filteredControls);
			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe('AC-2');
		});

		it('should apply both family filter and search term', () => {
			activeFilters.set([
				{
					fieldName: 'family',
					operator: 'equals',
					value: 'AC'
				}
			]);
			searchTerm.set('policy');

			const filtered = get(filteredControls);
			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe('AC-1');
		});

		it('should be case insensitive for search', () => {
			searchTerm.set('AUDIT');

			const filtered = get(filteredControls);
			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe('AU-1');
		});

		it('should return empty array when no matches found', () => {
			searchTerm.set('nonexistent');

			const filtered = get(filteredControls);
			expect(filtered).toHaveLength(0);
		});

		it('should filter out controls with no family when family filter is applied', () => {
			const controlsWithMissingFamily: Control[] = [
				...mockControls,
				{
					id: 'INVALID-1',
					title: 'Invalid Control',
					family: ''
				}
			];

			controls.set(controlsWithMissingFamily);
			activeFilters.set([
				{
					fieldName: 'family',
					operator: 'equals',
					value: 'AC'
				}
			]);

			const filtered = get(filteredControls);
			expect(filtered).toHaveLength(2);
			expect(filtered.every((c) => c.family === 'AC')).toBe(true);
		});

		it('should use family property when filtering and _metadata.family is missing', () => {
			const controlsWithFamilyProperty: Control[] = [
				{
					id: 'FAMILY-PROP-1',
					title: 'Control using family property',
					family: 'TESTFAM',
					'control-acronym': 'TESTFAM-1',
					_metadata: {}
				}
			];

			controls.set(controlsWithFamilyProperty);
			activeFilters.set([
				{
					fieldName: 'family',
					operator: 'equals',
					value: 'TESTFAM'
				}
			]);

			const filtered = get(filteredControls);
			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe('FAMILY-PROP-1');
		});
	});

	describe('controlsWithMappings derived store', () => {
		beforeEach(() => {
			controls.set(mockControls);
			mappings.set(mockMappings);
		});

		it('should combine controls with their mappings', () => {
			const controlsWithMaps = get(controlsWithMappings);

			expect(controlsWithMaps).toHaveLength(3);

			const ac1Control = controlsWithMaps.find((c) => c.id === 'AC-1');
			expect(ac1Control?.mappings).toHaveLength(1);
			expect(ac1Control?.mappings[0].uuid).toBe('mapping-1');

			const au1Control = controlsWithMaps.find((c) => c.id === 'AU-1');
			expect(au1Control?.mappings).toHaveLength(0);
		});

		it('should handle controls with no mappings', () => {
			mappings.set([]);

			const controlsWithMaps = get(controlsWithMappings);

			expect(controlsWithMaps).toHaveLength(3);
			controlsWithMaps.forEach((control) => {
				expect(control.mappings).toHaveLength(0);
			});
		});
	});

	describe('complianceStore actions', () => {
		describe('setSearchTerm', () => {
			it('should update search term', () => {
				complianceStore.setSearchTerm('test search');

				expect(get(searchTerm)).toBe('test search');
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
		});
	});
});
