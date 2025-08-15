/**
 * Tests for the adapter system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Control } from '../types.js';
import type { FormatAdapter } from './types.js';
import { InternalYamlAdapter } from './nist-native.js';
import { adapterRegistry, registerAdapter, getAdapter, detectAdapter } from './registry.js';

// Sample test data
const sampleControl: Control = {
  id: 'AC-1.1',
  'control-acronym': 'AC-1',
  'control-information': 'This is a test control with sufficient length for validation purposes. It contains the required description and guidance information.',
  'control-implementation-status': 'Implemented',
  'security-control-designation': 'System-Specific',
  'control-implementation-narrative': 'This control is implemented through our security policies.',
  cci: '123456',
  'cci-definition': 'Test CCI definition for validation purposes.',
  'implementation-guidance': 'Follow the security procedures documented in our manual.',
  'assessment-procedures': 'Review documentation and test implementation.',
  'compliance-status': 'Compliant'
};

// Note: Mappings are not part of adapter imports/exports
// They are managed internally regardless of control format

describe('InternalYamlAdapter', () => {
  let adapter: InternalYamlAdapter;

  beforeEach(() => {
    adapter = new InternalYamlAdapter();
  });

  it('should have correct metadata', () => {
    expect(adapter.id).toBe('internal-yaml');
    expect(adapter.name).toBe('Internal YAML Format');
    expect(adapter.version).toBe('1.0.0');
    expect(adapter.schema).toBeDefined();
    expect(adapter.schema.name).toBe('Internal Control Format');
  });

  it('should have required schema fields', () => {
    const requiredFieldIds = [
      'id',
      'control-acronym',
      'control-information',
      'control-implementation-status',
      'security-control-designation',
      'control-implementation-narrative',
      'cci',
      'cci-definition',
      'implementation-guidance',
      'assessment-procedures',
      'compliance-status'
    ];

    const schemaFieldIds = adapter.schema.fields.map(f => f.id);
    
    requiredFieldIds.forEach(fieldId => {
      expect(schemaFieldIds).toContain(fieldId);
    });
  });

  it('should validate a correct control', async () => {
    const result = await adapter.validate(sampleControl);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect validation errors for invalid control', async () => {
    const invalidControl = { 
      ...sampleControl,
      'control-information': '', // Make this required field empty
      'control-implementation-narrative': '' // Make another required field empty
    };

    const result = await adapter.validate(invalidControl);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    
    const errorFields = result.errors.map(e => e.field);
    expect(errorFields).toContain('control-information');
    expect(errorFields).toContain('control-implementation-narrative');
  });

  it('should import native data correctly', async () => {
    const data = {
      controls: [sampleControl]
    };

    const result = await adapter.import(data);
    
    expect(result.controls).toHaveLength(1);
    expect(result.controls[0]).toEqual(sampleControl);
    expect(result.summary.controlsImported).toBe(1);
  });

  it('should export native data correctly', async () => {
    const result = await adapter.export([sampleControl]);
    
    expect(result.data).toBeDefined();
    expect(result.data.controls).toHaveLength(1);
    expect(result.mimeType).toBe('application/x-yaml');
    expect(result.filename).toBe('controls.yaml');
  });

  it('should handle single control detection', () => {
    expect(adapter.canHandle(sampleControl)).toBe(true);
  });

  it('should handle collection detection', () => {
    const data = {
      controls: [sampleControl]
    };
    
    expect(adapter.canHandle(data)).toBe(true);
  });

  it('should reject invalid data', () => {
    expect(adapter.canHandle(null)).toBe(false);
    expect(adapter.canHandle(undefined)).toBe(false);
    expect(adapter.canHandle("string")).toBe(false);
    expect(adapter.canHandle({})).toBe(false);
    expect(adapter.canHandle({ random: 'data' })).toBe(false);
  });

  it('should validate select field options', async () => {
    const invalidControl = {
      ...sampleControl,
      'control-implementation-status': 'InvalidStatus'
    };

    const result = await adapter.validate(invalidControl);
    expect(result.valid).toBe(false);
    
    const statusError = result.errors.find(e => e.field === 'control-implementation-status');
    expect(statusError).toBeDefined();
    expect(statusError?.message).toContain('must be one of');
  });

  it('should validate required fields', async () => {
    const invalidControl = {
      ...sampleControl,
      cci: ''  // Required field empty
    };

    const result = await adapter.validate(invalidControl);
    expect(result.valid).toBe(false);
    
    const cciError = result.errors.find(e => e.field === 'cci');
    expect(cciError).toBeDefined();
  });
});

describe('AdapterRegistry', () => {
  beforeEach(() => {
    // Reset registry for clean test state
    adapterRegistry.reset();
  });

  it('should have internal YAML adapter registered by default', () => {
    const adapters = adapterRegistry.list();
    expect(adapters).toContain('internal-yaml');
  });

  it('should get adapter by ID', () => {
    const adapter = getAdapter('internal-yaml');
    expect(adapter).toBeDefined();
    expect(adapter?.id).toBe('internal-yaml');
  });

  it('should detect adapter for compatible data', () => {
    const adapter = detectAdapter(sampleControl);
    expect(adapter).toBeDefined();
    expect(adapter?.id).toBe('internal-yaml');
  });

  it('should return undefined for incompatible data', () => {
    const adapter = detectAdapter({ random: 'data' });
    expect(adapter).toBeUndefined();
  });

  it('should register new adapters', () => {
    // Create a mock adapter with a different ID
    const baseAdapter = new InternalYamlAdapter();
    const mockAdapter: FormatAdapter = {
      id: 'test-adapter',
      name: 'Test Adapter',
      version: '1.0.0',
      schema: baseAdapter.schema,
      import: baseAdapter.import.bind(baseAdapter),
      export: baseAdapter.export.bind(baseAdapter),
      validate: baseAdapter.validate.bind(baseAdapter),
      canHandle: baseAdapter.canHandle.bind(baseAdapter)
    };
    
    registerAdapter(mockAdapter);
    
    const retrieved = getAdapter('test-adapter');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('test-adapter');
  });

  it('should list all adapters', () => {
    const adapters = adapterRegistry.list();
    expect(adapters).toContain('internal-yaml');
    expect(adapters.length).toBeGreaterThan(0);
  });

  it('should get adapter statistics', () => {
    const stats = adapterRegistry.getStats();
    expect(stats.totalAdapters).toBeGreaterThan(0);
    expect(stats.adaptersByType['Internal Control Format']).toBe(1);
    expect(stats.schemaVersions['Internal Control Format']).toContain('1.0.0');
  });

  it('should validate adapter implementations', () => {
    const validAdapter = new InternalYamlAdapter();
    const errors = adapterRegistry.validateAdapter(validAdapter);
    expect(errors).toHaveLength(0);
  });

  it('should detect invalid adapter implementations', () => {
    const invalidAdapter = {
      // Missing required fields
      id: '',
      name: '',
      version: '',
      schema: null,
      import: 'not a function',
      export: null,
      validate: undefined,
      canHandle: () => true
    } as any;

    const errors = adapterRegistry.validateAdapter(invalidAdapter);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('ID'))).toBe(true);
    expect(errors.some(e => e.includes('name'))).toBe(true);
    expect(errors.some(e => e.includes('schema'))).toBe(true);
  });
});

describe('Integration Tests', () => {
  beforeEach(() => {
    adapterRegistry.reset();
  });

  it('should perform round-trip import/export', async () => {
    const adapter = getAdapter('internal-yaml')!;
    
    const originalData = {
      controls: [sampleControl]
    };

    // Import
    const importResult = await adapter.import(originalData);
    expect(importResult.controls).toHaveLength(1);

    // Export
    const exportResult = await adapter.export(importResult.controls);
    expect(exportResult.data.controls).toHaveLength(1);

    // Compare
    expect(exportResult.data.controls[0]).toEqual(sampleControl);
  });

  it('should handle empty data gracefully', async () => {
    const adapter = getAdapter('internal-yaml')!;
    
    const emptyData = {
      controls: []
    };

    const importResult = await adapter.import(emptyData);
    expect(importResult.controls).toHaveLength(0);
    expect(importResult.summary.controlsImported).toBe(0);
  });

  it('should handle malformed data with errors', async () => {
    const adapter = getAdapter('internal-yaml')!;
    
    const malformedControl = {
      id: 'AC-1.1',
      'control-acronym': 'AC-1',
      cci: '123456',
      // Missing required fields to trigger validation warnings
    };
    
    const malformedData = {
      controls: [malformedControl]
    };

    const importResult = await adapter.import(malformedData);
    // Should still import but with warnings
    expect(importResult.controls).toHaveLength(1);
    expect(importResult.warnings.length).toBeGreaterThan(0);
  });
});