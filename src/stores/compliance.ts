// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import type { Control, ControlWithMappings, Mapping } from '$lib/types';
import { appState } from '$lib/websocket';
import { derived, get, writable } from 'svelte/store';

// Filter types
export type FilterOperator =
	| 'equals'
	| 'not_equals'
	| 'exists'
	| 'not_exists'
	| 'includes'
	| 'not_includes';

export interface FilterCondition {
	fieldName: string;
	operator: FilterOperator;
	value?: any;
	active: boolean;
}

// Base stores
export const controls = writable<Control[]>([]);
export const mappings = writable<Mapping[]>([]);
export const loading = writable(true);
export const saveStatus = writable<'saved' | 'saving' | 'error'>('saved');
export const searchTerm = writable('');
export const selectedControl = writable<Control | null>(null);
export const activeFilters = writable<FilterCondition[]>([]);

// Derived stores
export const families = derived(controls, ($controls) => {
	const familySet = new Set(
		$controls.map((c) => {
			// Enhanced controls have family in _metadata.family, fallback to extracting from control-acronym
			return (
				(c as any)?._metadata?.family ||
				(c as any)?.family ||
				(c as any)?.['control-acronym']?.split('-')[0] ||
				''
			);
		})
	);
	return Array.from(familySet)
		.filter((f) => f)
		.sort();
});

export const filteredControls = derived(
	[controls, searchTerm, activeFilters],
	([$controls, $searchTerm, $activeFilters]) => {
		let results = $controls;

		// Apply search term
		if ($searchTerm) {
			const term = $searchTerm.toLowerCase();
			results = results.filter((c) => JSON.stringify(c).toLowerCase().includes(term));
		}

		// Helper function to evaluate filter against a field value
		function evaluateFilter(filter: FilterCondition, fieldValue: any): boolean {
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
						return fieldValue.some((item) =>
							String(item).toLowerCase().includes(String(filter.value).toLowerCase())
						);
					}
					return false;

				case 'not_includes':
					if (typeof fieldValue === 'string') {
						return !fieldValue.toLowerCase().includes(String(filter.value).toLowerCase());
					} else if (Array.isArray(fieldValue)) {
						return !fieldValue.some((item) =>
							String(item).toLowerCase().includes(String(filter.value).toLowerCase())
						);
					}
					return true;

				default:
					return true;
			}
		}

		// Apply advanced filters
		if ($activeFilters.length > 0) {
			results = results.filter((control: any) => {
				// Control must match all active filters
				return $activeFilters.every((filter) => {
					if (!filter.active) return true;

					if (filter.fieldName === 'family') {
						// Handle special case for family field which might be in different locations
						const fieldValue = (control as any)?._metadata?.family ||
							(control as any)?.family ||
							(control as any)?.['control-acronym']?.split('-')[0] ||
							'';

						return evaluateFilter(filter, fieldValue);
					} else {
						// Regular control field
						const fieldValue = (control as any)[filter.fieldName];
						return evaluateFilter(filter, fieldValue);
					}
				});
			});
		}

		return results;
	}
);

export const controlsWithMappings = derived(
	[controls, mappings],
	([$controls, $mappings]): ControlWithMappings[] => {
		return $controls.map((control) => ({
			...control,
			mappings: $mappings.filter((m) => m.control_id === control.id)
		}));
	}
);

// Store actions - mostly for local state management
// All server operations now go through WebSocket
export const complianceStore = {
	setSearchTerm(term: string) {
		searchTerm.set(term);
	},

	setSelectedControl(control: Control | null) {
		// Strip mappings property if it exists to prevent it from being saved to control files
		if (control && 'mappings' in control) {
			const { mappings: _mappings, ...controlWithoutMappings } = control as any;
			selectedControl.set(controlWithoutMappings);
		} else {
			selectedControl.set(control);
		}
	},

	clearFilters() {
		searchTerm.set('');
		activeFilters.set([]);
	},

	// Helper to set family filter using the new filter system
	setFamilyFilter(family: string | null) {
		// Remove any existing family filters
		const filters = get(activeFilters).filter((f) => f.fieldName !== 'family');

		// Add new family filter if a family is selected
		if (family) {
			filters.push({
				fieldName: 'family',
				operator: 'equals',
				value: family,
				active: true
			});
		}

		activeFilters.set(filters);
	},

	// Advanced filter methods
	addFilter(fieldName: string, operator: FilterOperator, value?: any) {
		const filters = get(activeFilters);
		const newFilter: FilterCondition = {
			fieldName,
			operator,
			value,
			active: true
		};
		activeFilters.set([...filters, newFilter]);
		return newFilter;
	},

	updateFilter(index: number, updates: Partial<FilterCondition>) {
		const filters = get(activeFilters);
		if (index >= 0 && index < filters.length) {
			const updatedFilters = [...filters];
			updatedFilters[index] = { ...updatedFilters[index], ...updates };
			activeFilters.set(updatedFilters);
		}
	},

	removeFilter(index: number) {
		const filters = get(activeFilters);
		if (index >= 0 && index < filters.length) {
			const updatedFilters = filters.filter((_, i) => i !== index);
			activeFilters.set(updatedFilters);
		}
	},

	toggleFilter(index: number) {
		const filters = get(activeFilters);
		if (index >= 0 && index < filters.length) {
			this.updateFilter(index, { active: !filters[index].active });
		}
	},

	getAvailableFields() {
		// Get all unique field names from all controls and field schema
		const allControls = get(controls);
		const allMappings = get(mappings);
		const fieldSet = new Set<string>();

		// Add 'family' as a special field that's always available
		fieldSet.add('family');

		// Extract fields from controls
		allControls.forEach(control => {
			Object.keys(control).forEach(key => {
				// Skip internal fields that start with underscore
				if (!key.startsWith('_')) {
					fieldSet.add(key);
				}
			});
		});

		// Get fields from the app state field schema if available
		const state = get(appState);
		const schema = state?.fieldSchema || state?.field_schema;
		if (schema?.fields) {
			Object.keys(schema.fields).forEach(key => {
				fieldSet.add(key);
			});
		}

		return Array.from(fieldSet).sort();
	}
};
