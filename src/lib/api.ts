// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import type {
	Control,
	Mapping,
	SearchResult,
	Stats,
	GitFileHistory,
	ControlWithHistory,
	ControlCompleteData,
	ControlSet
} from './types';

const BASE_URL = '';

class ApiClient {
	private async request<T>(url: string, options?: RequestInit): Promise<T> {
		const response = await fetch(`${BASE_URL}${url}`, {
			headers: {
				'Content-Type': 'application/json',
				...options?.headers
			},
			...options
		});

		if (!response.ok) {
			throw new Error(`API Error: ${response.status} ${response.statusText}`);
		}

		return response.json();
	}

	async loadAll(): Promise<{ controls: Control[]; mappings: Mapping[] }> {
		return this.request('/api/data/all');
	}

	async getControl(id: string): Promise<Control> {
		return this.request(`/api/controls/${id}`);
	}

	async updateControl(control: Control): Promise<Control> {
		return this.request(`/api/controls/${control.id}`, {
			method: 'PUT',
			body: JSON.stringify(control)
		});
	}

	async createMapping(mapping: Omit<Mapping, 'uuid' | 'created_at'>): Promise<Mapping> {
		return this.request('/api/mappings', {
			method: 'POST',
			body: JSON.stringify(mapping)
		});
	}

	async updateMapping(mapping: Mapping): Promise<Mapping> {
		return this.request(`/api/mappings/${mapping.uuid}`, {
			method: 'PUT',
			body: JSON.stringify(mapping)
		});
	}

	async deleteMapping(uuid: string): Promise<{ success: boolean }> {
		return this.request(`/api/mappings/${uuid}`, {
			method: 'DELETE'
		});
	}

	async search(query: string): Promise<SearchResult> {
		return this.request(`/api/search?q=${encodeURIComponent(query)}`);
	}

	async getControlSet(): Promise<ControlSet> {
		return this.request('/api/control-set');
	}

	async exportExcel(): Promise<Blob> {
		const response = await fetch(`${BASE_URL}/api/export/excel`, {
			method: 'POST'
		});

		if (!response.ok) {
			throw new Error(`Export Error: ${response.status} ${response.statusText}`);
		}

		return response.blob();
	}

	async importCSV(file: File): Promise<void> {
		const formData = new FormData();
		formData.append('file', file);

		const response = await fetch(`${BASE_URL}/api/import/csv`, {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			throw new Error(`Import Error: ${response.status} ${response.statusText}`);
		}
	}

}

export const api = new ApiClient();
