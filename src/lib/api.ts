import type { Control, Mapping, SearchResult, Stats, GitFileHistory, ControlWithHistory, ControlCompleteData } from './types';

const BASE_URL = '';

class ApiClient {
  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${BASE_URL}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async loadAll(): Promise<{ controls: Control[], mappings: Mapping[] }> {
    return this.request('/api/data/all');
  }

  async getControls(): Promise<Control[]> {
    return this.request('/api/controls');
  }

  async getControl(id: string): Promise<Control> {
    return this.request(`/api/controls/${id}`);
  }

  async updateControl(control: Control): Promise<Control> {
    return this.request(`/api/controls/${control.id}`, {
      method: 'PUT',
      body: JSON.stringify(control),
    });
  }

  async deleteControl(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/controls/${id}`, {
      method: 'DELETE',
    });
  }

  async getMappings(): Promise<Mapping[]> {
    return this.request('/api/mappings');
  }

  async getMapping(uuid: string): Promise<Mapping> {
    return this.request(`/api/mappings/${uuid}`);
  }

  async createMapping(mapping: Omit<Mapping, 'uuid' | 'created_at'>): Promise<Mapping> {
    return this.request('/api/mappings', {
      method: 'POST',
      body: JSON.stringify(mapping),
    });
  }

  async updateMapping(mapping: Mapping): Promise<Mapping> {
    return this.request(`/api/mappings/${mapping.uuid}`, {
      method: 'PUT',
      body: JSON.stringify(mapping),
    });
  }

  async deleteMapping(uuid: string): Promise<{ success: boolean }> {
    return this.request(`/api/mappings/${uuid}`, {
      method: 'DELETE',
    });
  }

  async search(query: string): Promise<SearchResult> {
    return this.request(`/api/search?q=${encodeURIComponent(query)}`);
  }

  async getStats(): Promise<Stats> {
    return this.request('/api/stats');
  }

  async exportExcel(): Promise<Blob> {
    const response = await fetch(`${BASE_URL}/api/export/excel`, {
      method: 'POST',
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
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Import Error: ${response.status} ${response.statusText}`);
    }
  }

  async getControlHistory(id: string, limit?: number): Promise<GitFileHistory> {
    const params = limit ? `?limit=${limit}` : '';
    return this.request(`/api/controls/${id}/history${params}`);
  }

  async getControlWithHistory(id: string, limit?: number): Promise<ControlWithHistory> {
    const params = limit ? `?limit=${limit}` : '';
    return this.request(`/api/controls/${id}/with-history${params}`);
  }

  async getGitStats(): Promise<{
    totalCommits: number;
    contributors: number;
    lastCommitDate: string | null;
    firstCommitDate: string | null;
  }> {
    return this.request('/api/git/stats');
  }

  async getMappingHistory(family: string, limit: number = 20): Promise<GitFileHistory> {
    return this.request(`/api/mappings/${family}/history?limit=${limit}`);
  }

  async getControlComplete(id: string, limit?: number): Promise<ControlCompleteData> {
    const params = limit ? `?limit=${limit}` : '';
    return this.request(`/api/controls/${id}/complete${params}`);
  }

  async getControlCompleteWithPending(id: string, limit?: number): Promise<ControlCompleteData> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    params.append('includePending', 'true');
    return this.request(`/api/controls/${id}/complete?${params.toString()}`);
  }

  async getFileContentAtCommit(commitHash: string, type: 'control' | 'mapping', controlId?: string, family?: string): Promise<{ filePath: string; commitHash: string; content: string | null }> {
    let url = `/api/git/file/${commitHash}/${type}`;
    
    if (type === 'mapping' && family) {
      url += `/${family}`;
    }
    
    const params = new URLSearchParams();
    if (controlId) {
      params.append('controlId', controlId);
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    return this.request(url);
  }
}

export const api = new ApiClient();
