/**
 * Adapter registry for managing format adapters
 */

import type { FormatAdapter, AdapterRegistry } from './types.js';
import { InternalYamlAdapter } from './nist-native.js';
import { OSCALImportAdapter } from './oscal-import.js';

/**
 * Singleton registry for format adapters
 */
class AdapterRegistryImpl implements AdapterRegistry {
  private adapters = new Map<string, FormatAdapter>();
  private static instance: AdapterRegistryImpl;

  private constructor() {
    // Register built-in adapters
    this.registerBuiltInAdapters();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): AdapterRegistryImpl {
    if (!AdapterRegistryImpl.instance) {
      AdapterRegistryImpl.instance = new AdapterRegistryImpl();
    }
    return AdapterRegistryImpl.instance;
  }

  /**
   * Register a new adapter
   */
  register(adapter: FormatAdapter): void {
    if (!adapter.id) {
      throw new Error('Adapter must have an ID');
    }

    if (this.adapters.has(adapter.id)) {
      console.warn(`Adapter '${adapter.id}' is already registered. Overwriting.`);
    }

    this.adapters.set(adapter.id, adapter);
    console.log(`Registered adapter: ${adapter.id} (${adapter.name})`);
  }

  /**
   * Get an adapter by ID
   */
  get(id: string): FormatAdapter | undefined {
    return this.adapters.get(id);
  }

  /**
   * List all registered adapter IDs
   */
  list(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get all registered adapters
   */
  getAll(): FormatAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Find adapter that can handle the given data
   */
  detect(data: any): FormatAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      try {
        if (adapter.canHandle(data)) {
          return adapter;
        }
      } catch (error) {
        console.warn(`Adapter ${adapter.id} threw error during detection:`, error);
      }
    }
    return undefined;
  }

  /**
   * Unregister an adapter
   */
  unregister(id: string): boolean {
    const deleted = this.adapters.delete(id);
    if (deleted) {
      console.log(`Unregistered adapter: ${id}`);
    }
    return deleted;
  }

  /**
   * Get adapter information for UI display
   */
  getAdapterInfo(): Array<{
    id: string;
    name: string;
    version: string;
    description: string;
    schemaName: string;
  }> {
    return this.getAll().map(adapter => ({
      id: adapter.id,
      name: adapter.name,
      version: adapter.version,
      description: adapter.schema.description,
      schemaName: adapter.schema.name
    }));
  }

  /**
   * Validate that an adapter is properly implemented
   */
  validateAdapter(adapter: FormatAdapter): string[] {
    const errors: string[] = [];

    if (!adapter.id || adapter.id.trim() === '') {
      errors.push('Adapter must have a non-empty ID');
    }

    if (!adapter.name || adapter.name.trim() === '') {
      errors.push('Adapter must have a non-empty name');
    }

    if (!adapter.version || adapter.version.trim() === '') {
      errors.push('Adapter must have a version');
    }

    if (!adapter.schema) {
      errors.push('Adapter must have a schema');
    } else {
      if (!adapter.schema.name || adapter.schema.name.trim() === '') {
        errors.push('Schema must have a name');
      }

      if (!adapter.schema.fields || !Array.isArray(adapter.schema.fields)) {
        errors.push('Schema must have fields array');
      } else if (adapter.schema.fields.length === 0) {
        errors.push('Schema must have at least one field');
      }
    }

    if (typeof adapter.import !== 'function') {
      errors.push('Adapter must implement import method');
    }

    if (typeof adapter.export !== 'function') {
      errors.push('Adapter must implement export method');
    }

    if (typeof adapter.validate !== 'function') {
      errors.push('Adapter must implement validate method');
    }

    if (typeof adapter.canHandle !== 'function') {
      errors.push('Adapter must implement canHandle method');
    }

    return errors;
  }

  /**
   * Register built-in adapters
   */
  private registerBuiltInAdapters(): void {
    try {
      // Register the internal YAML adapter
      const internalAdapter = new InternalYamlAdapter();
      this.register(internalAdapter);

      // Register the OSCAL import adapter
      const oscalAdapter = new OSCALImportAdapter();
      this.register(oscalAdapter);
    } catch (error) {
      console.error('Failed to register built-in adapters:', error);
    }
  }

  /**
   * Reset registry (useful for testing)
   */
  reset(): void {
    this.adapters.clear();
    this.registerBuiltInAdapters();
  }

  /**
   * Get statistics about registered adapters
   */
  getStats(): {
    totalAdapters: number;
    adaptersByType: Record<string, number>;
    schemaVersions: Record<string, string[]>;
  } {
    const adapters = this.getAll();
    const adaptersByType: Record<string, number> = {};
    const schemaVersions: Record<string, string[]> = {};

    adapters.forEach(adapter => {
      // Count by schema name
      const schemaName = adapter.schema.name;
      adaptersByType[schemaName] = (adaptersByType[schemaName] || 0) + 1;

      // Track versions
      if (!schemaVersions[schemaName]) {
        schemaVersions[schemaName] = [];
      }
      if (!schemaVersions[schemaName].includes(adapter.version)) {
        schemaVersions[schemaName].push(adapter.version);
      }
    });

    return {
      totalAdapters: adapters.length,
      adaptersByType,
      schemaVersions
    };
  }
}

/**
 * Export the singleton instance
 */
export const adapterRegistry = AdapterRegistryImpl.getInstance();

/**
 * Convenience functions for common operations
 */

/**
 * Register a new adapter
 */
export function registerAdapter(adapter: FormatAdapter): void {
  adapterRegistry.register(adapter);
}

/**
 * Get an adapter by ID
 */
export function getAdapter(id: string): FormatAdapter | undefined {
  return adapterRegistry.get(id);
}

/**
 * Get all available adapters
 */
export function getAvailableAdapters(): FormatAdapter[] {
  return adapterRegistry.getAll();
}

/**
 * Detect which adapter can handle the given data
 */
export function detectAdapter(data: any): FormatAdapter | undefined {
  return adapterRegistry.detect(data);
}

/**
 * Get the default adapter (Internal YAML)
 */
export function getDefaultAdapter(): FormatAdapter {
  const adapter = adapterRegistry.get('internal-yaml');
  if (!adapter) {
    throw new Error('Default internal YAML adapter not found');
  }
  return adapter;
}

/**
 * Import data using the appropriate adapter
 */
export async function importWithAdapter(
  data: any,
  adapterId?: string,
  options?: any
): Promise<{ adapter: FormatAdapter; result: any }> {
  let adapter: FormatAdapter | undefined;

  if (adapterId) {
    adapter = adapterRegistry.get(adapterId);
    if (!adapter) {
      throw new Error(`Adapter '${adapterId}' not found`);
    }
  } else {
    adapter = adapterRegistry.detect(data);
    if (!adapter) {
      throw new Error('No suitable adapter found for the provided data');
    }
  }

  const result = await adapter.import(data, options);
  return { adapter, result };
}

/**
 * Export data using the specified adapter
 */
export async function exportWithAdapter(
  adapterId: string,
  controls: any[],
  options?: any
): Promise<{ adapter: FormatAdapter; result: any }> {
  const adapter = adapterRegistry.get(adapterId);
  if (!adapter) {
    throw new Error(`Adapter '${adapterId}' not found`);
  }

  const result = await adapter.export(controls, options);
  return { adapter, result };
}