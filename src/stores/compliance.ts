// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { writable, derived } from 'svelte/store';
import { api } from '$lib/api';
import type { Control, Mapping, ControlWithMappings } from '$lib/types';

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
  const familySet = new Set($controls.map(c => 
    c['control-acronym'].split('-')[0]
  ));
  return Array.from(familySet).sort();
});

export const filteredControls = derived(
  [controls, selectedFamily, searchTerm],
  ([$controls, $selectedFamily, $searchTerm]) => {
    let results = $controls;
    
    if ($selectedFamily) {
      results = results.filter(c => 
        c['control-acronym'].startsWith($selectedFamily)
      );
    }
    
    if ($searchTerm) {
      const term = $searchTerm.toLowerCase();
      results = results.filter(c => 
        JSON.stringify(c).toLowerCase().includes(term)
      );
    }
    
    return results;
  }
);

export const controlsWithMappings = derived(
  [controls, mappings],
  ([$controls, $mappings]): ControlWithMappings[] => {
    return $controls.map(control => ({
      ...control,
      mappings: $mappings.filter(m => m.control_id === control.id)
    }));
  }
);

// Store actions
export const complianceStore = {
  async init() {
    try {
      loading.set(true);
      const data = await api.loadAll();
      controls.set(data.controls);
      mappings.set(data.mappings);
    } catch (error) {
      console.error('Failed to load data:', error);
      saveStatus.set('error');
    } finally {
      loading.set(false);
    }
  },

  async updateControl(control: Control) {
    saveStatus.set('saving');
    
    controls.update(controlsList => {
      const index = controlsList.findIndex(c => c.id === control.id);
      if (index !== -1) {
        controlsList[index] = control;
      }
      return controlsList;
    });
    
    try {
      await api.updateControl(control);
      saveStatus.set('saved');
      setTimeout(() => {
        saveStatus.update(status => status === 'saved' ? 'saved' : status);
      }, 2000);
    } catch (error) {
      console.error('Failed to update control:', error);
      saveStatus.set('error');
    }
  },

  async createMapping(mapping: Omit<Mapping, 'uuid' | 'created_at'>) {
    try {
      const newMapping = await api.createMapping(mapping);
      mappings.update(mappingsList => [...mappingsList, newMapping]);
      return newMapping;
    } catch (error) {
      console.error('Failed to create mapping:', error);
      throw error;
    }
  },

  async updateMapping(mapping: Mapping) {
    mappings.update(mappingsList => {
      const index = mappingsList.findIndex(m => m.uuid === mapping.uuid);
      if (index !== -1) {
        mappingsList[index] = mapping;
      }
      return mappingsList;
    });
    
    try {
      await api.updateMapping(mapping);
    } catch (error) {
      console.error('Failed to update mapping:', error);
      throw error;
    }
  },

  async deleteMapping(uuid: string) {
    mappings.update(mappingsList => 
      mappingsList.filter(m => m.uuid !== uuid)
    );
    
    try {
      await api.deleteMapping(uuid);
    } catch (error) {
      console.error('Failed to delete mapping:', error);
      throw error;
    }
  },

  async search(query: string) {
    try {
      const results = await api.search(query);
      return results;
    } catch (error) {
      console.error('Search failed:', error);
      return { controls: [], mappings: [] };
    }
  },

  setSearchTerm(term: string) {
    searchTerm.set(term);
  },

  setSelectedFamily(family: string | null) {
    selectedFamily.set(family);
  },

  setSelectedControl(control: Control | null) {
    // Strip mappings property if it exists to prevent it from being saved to control files
    if (control && 'mappings' in control) {
      const { mappings, ...controlWithoutMappings } = control as any;
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
