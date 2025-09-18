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
