// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
	families, 
	filteredControls, 
	controlsWithMappings, 
	complianceStore,
	controls,
	mappings,
	searchTerm,
	selectedFamily,
	selectedControl
} from './compliance';
import { get } from 'svelte/store';
import type { Control, Mapping } from '$lib/types';

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
		selectedFamily.set(null);
		selectedControl.set(null);
	});

	describe('families derived store', () => {
		it('should extract unique families from controls', () => {
			controls.set(mockControls);
			
			const familiesValue = get(families);
			expect(familiesValue).toEqual(['AC', 'AU']);
		});

		it('should handle empty controls array', () => {
			controls.set([]);
			
			const familiesValue = get(families);
			expect(familiesValue).toEqual([]);
		});

		it('should fallback to control-acronym when _metadata.family is not available', () => {
			const controlsWithoutMetadata: Control[] = [
				{
					id: 'SC-1',
					title: 'System and Communications Protection Policy',
					family: 'SC',
					'control-acronym': 'SC-1'
				}
			];
			
			controls.set(controlsWithoutMetadata);
			
			const familiesValue = get(families);
			expect(familiesValue).toEqual(['SC']);
		});

		it('should sort families alphabetically', () => {
			const unsortedControls: Control[] = [
				{
					id: 'ZZ-1',
					title: 'Test Control Z',
					family: 'ZZ',
					'control-acronym': 'ZZ-1',
					_metadata: { family: 'ZZ' }
				},
				{
					id: 'AA-1',
					title: 'Test Control A',
					family: 'AA',
					'control-acronym': 'AA-1',
					_metadata: { family: 'AA' }
				}
			];
			
			controls.set(unsortedControls);
			
			const familiesValue = get(families);
			expect(familiesValue).toEqual(['AA', 'ZZ']);
		});

		it('should filter out controls with no family information', () => {
			const controlsWithMissingFamily: Control[] = [
				{
					id: 'VALID-1',
					title: 'Valid Control',
					family: 'VALID',
					'control-acronym': 'VALID-1',
					_metadata: { family: 'VALID' }
				},
				{
					id: 'INVALID-1',
					title: 'Invalid Control',
					family: '',
				}
			];
			
			controls.set(controlsWithMissingFamily);
			
			const familiesValue = get(families);
			expect(familiesValue).toEqual(['VALID']);
		});

		it('should handle controls with completely missing family data', () => {
			const controlsWithNoFamilyData: Control[] = [
				{
					id: 'NO-FAMILY-1',
					title: 'Control with no family data',
					family: '',
				},
				{
					id: 'NULL-FIELDS',
					title: 'Control with null/undefined fields',
					family: '',
					'control-acronym': '',
					_metadata: {}
				},
				{
					id: 'VALID-1',
					title: 'Valid Control',
					family: 'VALID',
					'control-acronym': 'VALID-1',
					_metadata: { family: 'VALID' }
				}
			];
			
			controls.set(controlsWithNoFamilyData);
			
			const familiesValue = get(families);
			expect(familiesValue).toEqual(['VALID']);
		});

		it('should use family property when _metadata.family is missing', () => {
			const controlsWithFamilyProperty: Control[] = [
				{
					id: 'FAMILY-PROP-1',
					title: 'Control using family property',
					family: 'FAMILYPROP',
					'control-acronym': 'FAMILYPROP-1',
					_metadata: {}
				}
			];
			
			controls.set(controlsWithFamilyProperty);
			
			const familiesValue = get(families);
			expect(familiesValue).toEqual(['FAMILYPROP']);
		});

		it('should extract family from control-acronym when both _metadata.family and family are missing', () => {
			const controlsWithAcronymOnly: Control[] = [
				{
					id: 'ACRONYM-1',
					title: 'Control using control-acronym only',
					family: '',
					'control-acronym': 'ACRONYM-1'
				}
			];
			
			controls.set(controlsWithAcronymOnly);
			
			const familiesValue = get(families);
			expect(familiesValue).toEqual(['ACRONYM']);
		});
	});

	describe('filteredControls derived store', () => {
		beforeEach(() => {
			controls.set(mockControls);
		});

		it('should return all controls when no filters are applied', () => {
			const filtered = get(filteredControls);
			expect(filtered).toEqual(mockControls);
		});

		it('should filter by selected family', () => {
			selectedFamily.set('AC');
			
			const filtered = get(filteredControls);
			expect(filtered).toHaveLength(2);
			expect(filtered.every(c => c.family === 'AC')).toBe(true);
		});

		it('should filter by search term', () => {
			searchTerm.set('management');
			
			const filtered = get(filteredControls);
			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe('AC-2');
		});

		it('should apply both family and search filters', () => {
			selectedFamily.set('AC');
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
					family: '',
				}
			];
			
			controls.set(controlsWithMissingFamily);
			selectedFamily.set('AC');
			
			const filtered = get(filteredControls);
			expect(filtered).toHaveLength(2);
			expect(filtered.every(c => c.family === 'AC')).toBe(true);
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
			selectedFamily.set('TESTFAM');
			
			const filtered = get(filteredControls);
			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe('FAMILY-PROP-1');
		});

		it('should extract family from control-acronym when filtering and other family fields are missing', () => {
			const controlsWithAcronymOnly: Control[] = [
				{
					id: 'ACRO-1',
					title: 'Control using control-acronym only',
					family: '',
					'control-acronym': 'ACRO-1'
				}
			];
			
			controls.set(controlsWithAcronymOnly);
			selectedFamily.set('ACRO');
			
			const filtered = get(filteredControls);
			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe('ACRO-1');
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
			
			const ac1Control = controlsWithMaps.find(c => c.id === 'AC-1');
			expect(ac1Control?.mappings).toHaveLength(1);
			expect(ac1Control?.mappings[0].uuid).toBe('mapping-1');
			
			const au1Control = controlsWithMaps.find(c => c.id === 'AU-1');
			expect(au1Control?.mappings).toHaveLength(0);
		});

		it('should handle controls with no mappings', () => {
			mappings.set([]);
			
			const controlsWithMaps = get(controlsWithMappings);
			
			expect(controlsWithMaps).toHaveLength(3);
			controlsWithMaps.forEach(control => {
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

		describe('setSelectedFamily', () => {
			it('should update selected family', () => {
				complianceStore.setSelectedFamily('AC');
				
				expect(get(selectedFamily)).toBe('AC');
			});

			it('should handle null family', () => {
				complianceStore.setSelectedFamily(null);
				
				expect(get(selectedFamily)).toBeNull();
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
			it('should reset search term and selected family', () => {
				searchTerm.set('test');
				selectedFamily.set('AC');
				
				complianceStore.clearFilters();
				
				expect(get(searchTerm)).toBe('');
				expect(get(selectedFamily)).toBeNull();
			});
		});
	});
})
