/**
 * Tests for OSCAL import adapter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OSCALImportAdapter } from './oscal-import.js';

// Sample OSCAL catalog data (simplified)
const sampleOSCALCatalog = {
  catalog: {
    uuid: 'b954d3b7-d2c7-453b-8eb2-459e8d3b8462',
    metadata: {
      title: 'NIST Special Publication 800-53 Revision 4: Security and Privacy Controls',
      'last-modified': '2023-10-12T00:00:00.000000-04:00',
      version: '2015-01-22',
      'oscal-version': '1.1.1'
    },
    groups: [
      {
        id: 'ac',
        class: 'family',
        title: 'Access Control',
        controls: [
          {
            id: 'ac-1',
            class: 'SP800-53',
            title: 'Access Control Policy and Procedures',
            params: [
              {
                id: 'ac-1_prm_1',
                label: 'organization-defined personnel or roles'
              }
            ],
            props: [
              {
                name: 'label',
                value: 'AC-1'
              }
            ],
            parts: [
              {
                id: 'ac-1_smt',
                name: 'statement',
                prose: 'The organization develops, documents, and disseminates access control policy.',
                parts: [
                  {
                    id: 'ac-1_smt.a',
                    name: 'item',
                    prose: 'An access control policy that addresses purpose, scope, roles, responsibilities.'
                  }
                ]
              },
              {
                id: 'ac-1_gdn',
                name: 'guidance',
                prose: 'This control addresses the establishment of policy and procedures for access control.'
              }
            ],
            controls: [
              {
                id: 'ac-1.1',
                class: 'SP800-53-enhancement',
                title: 'Access Control Policy Enhancement',
                parts: [
                  {
                    id: 'ac-1.1_smt',
                    name: 'statement',
                    prose: 'The organization reviews and updates the access control policy.'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
};

describe('OSCALImportAdapter', () => {
  let adapter: OSCALImportAdapter;

  beforeEach(() => {
    adapter = new OSCALImportAdapter();
  });

  it('should have correct metadata', () => {
    expect(adapter.id).toBe('oscal-import');
    expect(adapter.name).toBe('NIST OSCAL Import');
    expect(adapter.version).toBe('1.1.1');
    expect(adapter.schema).toBeDefined();
    expect(adapter.schema.name).toBe('NIST OSCAL Catalog');
  });

  it('should detect OSCAL catalog format', () => {
    expect(adapter.canHandle(sampleOSCALCatalog)).toBe(true);
  });

  it('should reject non-OSCAL data', () => {
    expect(adapter.canHandle({})).toBe(false);
    expect(adapter.canHandle({ catalog: {} })).toBe(false);
    expect(adapter.canHandle({ catalog: { metadata: {} } })).toBe(false);
    expect(adapter.canHandle(null)).toBe(false);
  });

  it('should validate correct OSCAL data', async () => {
    const result = await adapter.validate(sampleOSCALCatalog);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect validation errors in invalid OSCAL data', async () => {
    const invalidData = {
      catalog: {
        // Missing required fields
      }
    };

    const result = await adapter.validate(invalidData);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    
    const errorFields = result.errors.map(e => e.field);
    expect(errorFields).toContain('catalog.uuid');
    expect(errorFields).toContain('catalog.metadata');
  });

  it('should import OSCAL catalog correctly', async () => {
    const result = await adapter.import(sampleOSCALCatalog);
    
    expect(result.controls).toHaveLength(2); // Main control + sub-control
    expect(result.summary.controlsImported).toBe(2);
    
    // Check main control
    const mainControl = result.controls.find(c => c.id === 'AC-1');
    expect(mainControl).toBeDefined();
    expect(mainControl?.['control-acronym']).toBe('AC-1');
    expect(mainControl?.['control-information']).toContain('Access Control Policy and Procedures');
    expect(mainControl?.['control-implementation-status']).toBe('Not Implemented');
    
    // Check sub-control
    const subControl = result.controls.find(c => c.id === 'AC-1.1');
    expect(subControl).toBeDefined();
    expect(subControl?.['control-acronym']).toBe('AC-1');
  });

  it('should preserve OSCAL metadata', async () => {
    const result = await adapter.import(sampleOSCALCatalog);
    
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.oscalCatalog).toBeDefined();
    expect(result.metadata?.oscalCatalog?.uuid).toBe('b954d3b7-d2c7-453b-8eb2-459e8d3b8462');
    expect(result.metadata?.oscalCatalog?.title).toContain('NIST Special Publication 800-53');
    expect(result.metadata?.importTimestamp).toBeDefined();
    expect(result.metadata?.sourceFormat).toBe('oscal-catalog');
  });

  it('should handle empty catalog gracefully', async () => {
    const emptyCatalog = {
      catalog: {
        uuid: 'test-uuid',
        metadata: {
          title: 'Empty Catalog',
          'last-modified': '2024-01-01T00:00:00.000Z',
          version: '1.0.0',
          'oscal-version': '1.1.1'
        },
        groups: []
      }
    };

    const result = await adapter.import(emptyCatalog);
    expect(result.controls).toHaveLength(0);
    expect(result.summary.controlsImported).toBe(0);
    expect(result.metadata).toBeDefined();
  });

  it('should throw error for export operation', async () => {
    await expect(adapter.export([])).rejects.toThrow('OSCAL import adapter is for importing only');
  });

  it('should handle malformed controls with warnings', async () => {
    const malformedCatalog = {
      catalog: {
        uuid: 'test-uuid',
        metadata: {
          title: 'Test Catalog',
          'last-modified': '2024-01-01T00:00:00.000Z',
          version: '1.0.0',
          'oscal-version': '1.1.1'
        },
        groups: [
          {
            id: 'test',
            class: 'family',
            title: 'Test Family',
            controls: [
              {
                // Missing required fields to trigger warnings
                id: 'malformed-control',
                class: 'SP800-53'
                // Missing title and parts
              }
            ]
          }
        ]
      }
    };

    const result = await adapter.import(malformedCatalog);
    // Should still try to import but with warnings
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should extract control information from OSCAL parts', async () => {
    const result = await adapter.import(sampleOSCALCatalog);
    const control = result.controls.find(c => c.id === 'AC-1');
    
    expect(control?.['control-information']).toContain('Title: Access Control Policy and Procedures');
    expect(control?.['control-information']).toContain('Statement:');
    expect(control?.['control-information']).toContain('develops, documents, and disseminates');
    expect(control?.['control-information']).toContain('Supplemental Guidance:');
  });

  it('should generate unique CCI numbers', async () => {
    const result = await adapter.import(sampleOSCALCatalog);
    const controls = result.controls;
    
    // Each control should have a CCI
    controls.forEach(control => {
      expect(control.cci).toBeDefined();
      expect(control.cci).toMatch(/^\d{6}$/); // 6-digit number
    });

    // CCIs should be different for different controls
    const ccis = controls.map(c => c.cci);
    const uniqueCcis = new Set(ccis);
    expect(uniqueCcis.size).toBe(ccis.length);
  });
});