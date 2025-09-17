// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import type { Control, ControlWithMappings, Mapping } from '$lib/types';
import { appState } from '$lib/websocket';
import { derived, get, writable } from 'svelte/store';

/**
 * A more flexible type for control field values that can handle any type of data
 * found in control objects, including primitive values, arrays, and objects.
 */
export type ControlFieldValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| Array<unknown>
	| Record<string, unknown>;

/**
 * Interface for accessing control fields dynamically for filtering.
 * This interface is intentionally flexible to handle the varied structure
 * of control objects loaded from YAML files.
 */
export interface ControlWithDynamicFields {
	// Index signature that allows any string key with any type of value
	[key: string]: unknown;

	// Common known fields with specific types for better IDE support
	id?: string;
	title?: string;
	description?: string;
	family?: string;
	status?: string;
	'review-status'?: string;
	'control-acronym'?: string;

	// Metadata fields
	_metadata?: Record<string, unknown>;

	// Complex fields
	mappings?: Mapping[];
	enhancements?: unknown[];
	links?: Array<{ href: string; rel?: string; text?: string }>;
	parameters?: Array<{ id: string; [key: string]: unknown }>;
}

/**
 * Shared filter operator options used across the application
 */
export const FILTER_OPERATORS = [
	{ value: 'equals' as const, label: 'Equals' },
	{ value: 'not_equals' as const, label: 'Not equals' },
	{ value: 'includes' as const, label: 'Contains' },
	{ value: 'not_includes' as const, label: 'Does not contain' },
	{ value: 'exists' as const, label: 'Exists' },
	{ value: 'not_exists' as const, label: 'Not exists' }
] as const;

// Extract the filter operator type from the constant
export type FilterOperator = (typeof FILTER_OPERATORS)[number]['value'];

/**
 * Filter operator option with display label
 */
export interface FilterOperatorOption {
	value: FilterOperator;
	label: string;
}

/**
 * Helper function to get the display label for a filter operator
 */
export function getOperatorLabel(operator: FilterOperator): string {
	const option = FILTER_OPERATORS.find((op) => op.value === operator);
	return option?.label || operator;
}

/**
 * Type for filter values - intentionally flexible to handle any value type
 * that might be found in control objects loaded from YAML files.
 */
export type FilterValue = unknown;

export interface FilterCondition {
	fieldName: string;
	operator: FilterOperator;
	value?: FilterValue;
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

		// Apply advanced filters
		if ($activeFilters.length > 0) {
			results = results.filter((control) => {
				// Cast to ControlWithDynamicFields for dynamic field access
				const dynamicControl = control as ControlWithDynamicFields;

				// Control must match all filters
				return $activeFilters.every((filter) => {
					let fieldValue: unknown;

					if (filter.fieldName === 'family') {
						// Handle special case for family field which might be in different locations
						fieldValue =
							dynamicControl._metadata?.family ||
							dynamicControl.family ||
							(dynamicControl['control-acronym']
								? dynamicControl['control-acronym'].split('-')[0]
								: '') ||
							'';
					} else {
						// Access field directly using the dynamic field access
						fieldValue = dynamicControl[filter.fieldName];
					}

					// For exists/not_exists operators, we just need to check if the field has a value
					if (filter.operator === 'exists') {
						return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
					} else if (filter.operator === 'not_exists') {
						return fieldValue === undefined || fieldValue === null || fieldValue === '';
					}

					// For other operators, convert values to strings for comparison
					if (fieldValue !== undefined && fieldValue !== null) {
						const fieldValueStr = String(fieldValue).toLowerCase();
						const filterValueStr =
							filter.value !== undefined ? String(filter.value).toLowerCase() : '';

						switch (filter.operator) {
							case 'equals':
								return fieldValueStr === filterValueStr;

							case 'not_equals':
								return fieldValueStr !== filterValueStr;

							case 'includes':
								return fieldValueStr.includes(filterValueStr);

							case 'not_includes':
								return !fieldValueStr.includes(filterValueStr);

							default:
								return true;
						}
					}

					return false;
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

	// Advanced filter methods
	addFilter(fieldName: string, operator: FilterOperator, value?: FilterValue) {
		const filters = get(activeFilters);
		const newFilter: FilterCondition = {
			fieldName,
			operator,
			value
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

	getAvailableFields() {
		// Get all unique field names from all controls and field schema
		const allControls = get(controls);
		const allMappings = get(mappings);
		const fieldSet = new Set<string>();

		// Add 'family' as a special field that's always available
		fieldSet.add('family');

		// Extract fields from controls
		allControls.forEach((control) => {
			Object.keys(control).forEach((key) => {
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
			Object.keys(schema.fields).forEach((key) => {
				fieldSet.add(key);
			});
		}

		return Array.from(fieldSet).sort();
	}
};
