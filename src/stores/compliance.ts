// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import type { Control, ControlWithMappings, Mapping } from '$lib/types';
import { appState } from '$lib/websocket';
import { derived, get, writable } from 'svelte/store';

// Type for control field values - similar to FilterValue but more specific to control fields
export type ControlFieldValue =
	| string
	| number
	| boolean
	| string[]
	| number[]
	| Record<string, unknown>;

// Interface for accessing control fields dynamically for filtering
export interface ControlWithDynamicFields {
	// Index signature with more specific type than 'any'
	[key: string]:
		| ControlFieldValue
		| undefined
		| Record<string, ControlFieldValue>
		| Mapping[]
		| unknown[];

	// Common known fields with specific types
	_metadata?: {
		family?: string;
		[key: string]: ControlFieldValue | undefined;
	};
	id?: string;
	family?: string;
	'control-acronym'?: string;
	name?: string;
	title?: string;
	description?: string;
	mappings?: Mapping[];
	enhancements?: unknown[];
	links?: Array<{ href: string; rel?: string; text?: string }>;
	parameters?: Array<{ id: string; [key: string]: unknown }>;
}

// Filter types
export type FilterOperator =
	| 'equals'
	| 'not_equals'
	| 'exists'
	| 'not_exists'
	| 'includes'
	| 'not_includes';

// Filter operator option with display label
export interface FilterOperatorOption {
	value: FilterOperator;
	label: string;
}

/**
 * Shared filter operator options used across the application
 */
export const FILTER_OPERATORS: FilterOperatorOption[] = [
	{ value: 'equals', label: 'Equals' },
	{ value: 'not_equals', label: 'Not equals' },
	{ value: 'includes', label: 'Contains' },
	{ value: 'not_includes', label: 'Does not contain' },
	{ value: 'exists', label: 'Exists' },
	{ value: 'not_exists', label: 'Not exists' }
];

/**
 * Helper function to get the display label for a filter operator
 */
export function getOperatorLabel(operator: FilterOperator): string {
	const option = FILTER_OPERATORS.find((op) => op.value === operator);
	return option?.label || operator;
}

// Type for filter values - can be string, number, boolean, or array of these
export type FilterValue = string | number | boolean | string[] | number[] | Record<string, unknown>;

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

		// Helper function to evaluate filter against a field value
		function evaluateFilter(filter: FilterCondition, fieldValue: FilterValue | undefined): boolean {
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
			results = results.filter((control) => {
				// Cast to ControlWithDynamicFields for dynamic field access
				const dynamicControl = control as ControlWithDynamicFields;
				// Control must match all filters
				return $activeFilters.every((filter) => {
					if (filter.fieldName === 'family') {
						// Handle special case for family field which might be in different locations
						const fieldValue =
							dynamicControl._metadata?.family ||
							dynamicControl.family ||
							(dynamicControl['control-acronym']
								? dynamicControl['control-acronym'].split('-')[0]
								: '') ||
							'';

						return evaluateFilter(filter, fieldValue);
					} else {
						// Regular control field
						const fieldValue = dynamicControl[filter.fieldName];
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
