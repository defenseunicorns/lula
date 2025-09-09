// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import type { Control, ControlWithMappings, Mapping } from '$lib/types';
import { derived, writable } from 'svelte/store';

// Base stores
export const controls = writable<Control[]>([]);
export const mappings = writable<Mapping[]>([]);
export const loading = writable(true);
export const saveStatus = writable<'saved' | 'saving' | 'error'>('saved');
export const searchTerm = writable('');
export const selectedFamily = writable<string | null>(null);
export const selectedControl = writable<Control | null>(null);

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
	[controls, selectedFamily, searchTerm],
	([$controls, $selectedFamily, $searchTerm]) => {
		let results = $controls;

		if ($selectedFamily) {
			results = results.filter((c) => {
				// Enhanced controls have family in _metadata.family, fallback to extracting from control-acronym
				const family =
					(c as any)?._metadata?.family ||
					(c as any)?.family ||
					(c as any)?.['control-acronym']?.split('-')[0] ||
					'';
				return family === $selectedFamily;
			});
		}

		if ($searchTerm) {
			const term = $searchTerm.toLowerCase();
			results = results.filter((c) => JSON.stringify(c).toLowerCase().includes(term));
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

	setSelectedFamily(family: string | null) {
		selectedFamily.set(family);
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
		selectedFamily.set(null);
	}
};
