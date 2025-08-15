/**
 * OSCAL Import adapter for converting NIST OSCAL catalogs to internal YAML format
 */

import type { Control } from '../types.js';
import type {
  FormatAdapter,
  ControlSchema,
  ImportOptions,
  ImportResult,
  ExportOptions,
  ExportResult,
  ValidationResult,
  ValidationError,
  ValidationWarning
} from './types.js';

/**
 * OSCAL catalog structures (simplified interfaces for our use)
 */
interface OSCALCatalog {
  catalog: {
    uuid: string;
    metadata: OSCALMetadata;
    groups: OSCALGroup[];
  };
}

interface OSCALMetadata {
  title: string;
  'last-modified': string;
  version: string;
  'oscal-version': string;
  props?: Array<{ name: string; value: string }>;
  parties?: Array<{
    uuid: string;
    type: string;
    name: string;
    'email-addresses'?: string[];
  }>;
}

interface OSCALGroup {
  id: string;
  class: string;
  title: string;
  controls: OSCALControl[];
}

interface OSCALControl {
  id: string;
  class: string;
  title: string;
  params?: Array<{
    id: string;
    label: string;
  }>;
  props?: Array<{
    name: string;
    value: string;
  }>;
  parts: OSCALPart[];
  controls?: OSCALControl[]; // Sub-controls/enhancements
}

interface OSCALPart {
  id: string;
  name: string;
  prose?: string;
  parts?: OSCALPart[];
  props?: Array<{
    name: string;
    value: string;
  }>;
}

/**
 * Schema for OSCAL format (describes the input format, not our internal format)
 */
const OSCAL_IMPORT_SCHEMA: ControlSchema = {
  name: 'NIST OSCAL Catalog',
  version: '1.1.1',
  description: 'Official NIST Open Security Controls Assessment Language format',
  groups: [
    {
      id: 'source',
      label: 'Source Information',
      description: 'Information about the OSCAL catalog source',
      defaultExpanded: true
    }
  ],
  fields: [
    {
      id: 'catalog.uuid',
      label: 'Catalog UUID',
      type: 'text',
      required: true,
      group: 'source',
      helpText: 'Unique identifier for the OSCAL catalog'
    },
    {
      id: 'catalog.metadata.title',
      label: 'Catalog Title',
      type: 'text',
      required: true,
      group: 'source',
      helpText: 'Official title of the catalog'
    },
    {
      id: 'catalog.metadata.version',
      label: 'Version',
      type: 'text',
      required: true,
      group: 'source',
      helpText: 'Version of the control catalog'
    }
  ]
};

/**
 * OSCAL Import adapter - converts OSCAL catalogs to internal format
 */
export class OSCALImportAdapter implements FormatAdapter {
  readonly id = 'oscal-import';
  readonly name = 'NIST OSCAL Import';
  readonly version = '1.1.1';
  readonly schema = OSCAL_IMPORT_SCHEMA;

  /**
   * Import OSCAL catalog and convert to internal format
   */
  async import(data: any, options?: ImportOptions): Promise<ImportResult> {
    try {
      const oscalCatalog = data as OSCALCatalog;
      const warnings: ValidationWarning[] = [];
      const controls: Control[] = [];

      // Validate basic OSCAL structure
      if (!oscalCatalog.catalog) {
        throw new Error('Invalid OSCAL format: missing catalog object');
      }

      // Extract controls from all groups
      for (const group of oscalCatalog.catalog.groups || []) {
        for (const oscalControl of group.controls || []) {
          try {
            const convertedControl = this.convertOSCALControl(oscalControl, group);
            controls.push(convertedControl);

            // Handle sub-controls/enhancements
            if (oscalControl.controls) {
              for (const subControl of oscalControl.controls) {
                const convertedSubControl = this.convertOSCALControl(subControl, group, oscalControl.id);
                controls.push(convertedSubControl);
              }
            }
          } catch (error) {
            warnings.push({
              field: oscalControl.id,
              message: `Failed to convert control ${oscalControl.id}: ${error instanceof Error ? error.message : String(error)}`
            });
          }
        }
      }

      return {
        controls,
        metadata: {
          oscalCatalog: {
            uuid: oscalCatalog.catalog.uuid,
            title: oscalCatalog.catalog.metadata.title,
            version: oscalCatalog.catalog.metadata.version,
            lastModified: oscalCatalog.catalog.metadata['last-modified'],
            oscalVersion: oscalCatalog.catalog.metadata['oscal-version']
          },
          importTimestamp: new Date().toISOString(),
          sourceFormat: 'oscal-catalog'
        },
        warnings,
        summary: {
          controlsImported: controls.length,
          skipped: warnings.length,
          errors: 0
        }
      };
    } catch (error) {
      throw new Error(`Failed to import OSCAL catalog: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Export is not supported for OSCAL import (one-way conversion)
   */
  async export(controls: Control[], options?: ExportOptions): Promise<ExportResult> {
    throw new Error('OSCAL import adapter is for importing only. Use oscal-export adapter for exporting.');
  }

  /**
   * Validate OSCAL format
   */
  async validate(data: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      if (!data || typeof data !== 'object') {
        errors.push({ message: 'Data must be an object' });
        return { valid: false, errors, warnings };
      }

      const oscalData = data as OSCALCatalog;

      // Check for required OSCAL structure
      if (!oscalData.catalog) {
        errors.push({ message: 'Missing required "catalog" object' });
      } else {
        if (!oscalData.catalog.uuid) {
          errors.push({ field: 'catalog.uuid', message: 'Missing catalog UUID' });
        }

        if (!oscalData.catalog.metadata) {
          errors.push({ field: 'catalog.metadata', message: 'Missing catalog metadata' });
        } else {
          if (!oscalData.catalog.metadata.title) {
            errors.push({ field: 'catalog.metadata.title', message: 'Missing catalog title' });
          }
          if (!oscalData.catalog.metadata.version) {
            errors.push({ field: 'catalog.metadata.version', message: 'Missing catalog version' });
          }
        }

        if (!oscalData.catalog.groups || !Array.isArray(oscalData.catalog.groups)) {
          warnings.push({ message: 'No control groups found in catalog' });
        } else if (oscalData.catalog.groups.length === 0) {
          warnings.push({ message: 'Catalog contains no control groups' });
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      errors.push({ message: `Validation error: ${error instanceof Error ? error.message : String(error)}` });
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Check if data looks like an OSCAL catalog
   */
  canHandle(data: any): boolean {
    return !!(data &&
           typeof data === 'object' &&
           data.catalog &&
           typeof data.catalog === 'object' &&
           data.catalog.metadata &&
           data.catalog.groups &&
           Array.isArray(data.catalog.groups));
  }

  /**
   * Convert a single OSCAL control to internal format
   */
  private convertOSCALControl(oscalControl: OSCALControl, group: OSCALGroup, parentId?: string): Control {
    // Generate internal control ID
    const controlId = parentId 
      ? `${parentId.toUpperCase()}.${this.extractEnhancementNumber(oscalControl.id)}`
      : oscalControl.id.toUpperCase();

    // Extract control acronym (base control without enhancement)
    const controlAcronym = parentId ? parentId.toUpperCase() : oscalControl.id.toUpperCase();

    // Extract control information from parts
    const controlInformation = this.extractControlInformation(oscalControl);

    // Generate a temporary CCI (in real implementation, this would map to actual CCIs)
    const cci = this.generateTempCCI(oscalControl.id);

    return {
      id: controlId,
      'control-acronym': controlAcronym,
      'control-information': controlInformation,
      'control-implementation-status': 'Not Implemented', // Default status
      'security-control-designation': 'System-Specific', // Default designation
      'control-implementation-narrative': `Implementation narrative for ${oscalControl.title}. Please update with actual implementation details.`,
      cci: cci,
      'cci-definition': `CCI definition for ${oscalControl.title}`,
      'implementation-guidance': this.extractImplementationGuidance(oscalControl),
      'assessment-procedures': this.extractAssessmentProcedures(oscalControl),
      'compliance-status': 'Not Assessed' // Default status
    };
  }

  /**
   * Extract control information from OSCAL parts
   */
  private extractControlInformation(control: OSCALControl): string {
    const parts = [];
    
    parts.push(`Title: ${control.title}`);
    
    // Extract statement
    const statement = this.findPartByName(control.parts, 'statement');
    if (statement) {
      parts.push('\nStatement:');
      parts.push(this.extractProseFromPart(statement));
    }

    // Extract guidance
    const guidance = this.findPartByName(control.parts, 'guidance');
    if (guidance) {
      parts.push('\nSupplemental Guidance:');
      parts.push(this.extractProseFromPart(guidance));
    }

    return parts.join('\n');
  }

  /**
   * Extract implementation guidance
   */
  private extractImplementationGuidance(control: OSCALControl): string {
    const guidance = this.findPartByName(control.parts, 'guidance');
    if (guidance) {
      return this.extractProseFromPart(guidance);
    }
    return `Implementation guidance for ${control.title}`;
  }

  /**
   * Extract assessment procedures
   */
  private extractAssessmentProcedures(control: OSCALControl): string {
    const objectives = this.findPartByName(control.parts, 'objectives');
    if (objectives) {
      return this.extractProseFromPart(objectives);
    }
    return `Assessment procedures for ${control.title}`;
  }

  /**
   * Find a part by name in the parts array
   */
  private findPartByName(parts: OSCALPart[], name: string): OSCALPart | undefined {
    return parts.find(part => part.name === name);
  }

  /**
   * Extract prose text from a part and its nested parts
   */
  private extractProseFromPart(part: OSCALPart): string {
    const prose = [];
    
    if (part.prose) {
      prose.push(part.prose);
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        const subProse = this.extractProseFromPart(subPart);
        if (subProse) {
          prose.push(subProse);
        }
      }
    }

    return prose.join('\n');
  }

  /**
   * Extract enhancement number from control ID
   */
  private extractEnhancementNumber(controlId: string): string {
    const match = controlId.match(/\.(\d+)$/);
    return match ? match[1] : '1';
  }

  /**
   * Generate temporary CCI number (placeholder until real mapping is implemented)
   */
  private generateTempCCI(controlId: string): string {
    // This is a placeholder - in a real implementation, you'd have a mapping
    // from OSCAL control IDs to actual CCI numbers
    const hash = controlId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return Math.abs(hash).toString().padStart(6, '0').substring(0, 6);
  }
}