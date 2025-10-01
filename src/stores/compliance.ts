// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import type { Control, Mapping } from '$lib/types';
import { appState } from '$lib/websocket';
import { get, writable } from 'svelte/store';

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

// Store actions - mostly for local state management
// All server operations now go through WebSocket
export const complianceStore = {
	setSearchTerm(term: string) {
		searchTerm.set(term || '');
	},

	setSelectedControl(control: Control | null) {
		// Strip mappings property if it exists to prevent it from being saved to control files
		if (control && 'mappings' in control) {
			// eslint-disable-next-line  @typescript-eslint/no-explicit-any
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
		const fieldSet = new Set<string>();

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

		// Add mapping-related fields for filtering
		fieldSet.add('has_mappings');
		fieldSet.add('mapping_status');
		fieldSet.add('mapping_count');

		return Array.from(fieldSet).sort();
	}
};
