/**
 * Native NIST SP 800-53 adapter that wraps the current YAML format.
 * This adapter maintains backward compatibility while enabling the adapter pattern.
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
 * Schema definition for the current internal YAML format
 * This represents the git-friendly format we use for storage,
 * not the official NIST specification (which comes from OSCAL import)
 */
const INTERNAL_YAML_SCHEMA: ControlSchema = {
  name: 'Internal Control Format',
  version: '1.0.0',
  description: 'Git-friendly YAML format for storing control implementation details',
  groups: [
    {
      id: 'identification',
      label: 'Identification',
      description: 'Control identification fields',
      defaultExpanded: true
    },
    {
      id: 'description',
      label: 'Description', 
      description: 'Control description and information',
      defaultExpanded: true
    },
    {
      id: 'implementation',
      label: 'Implementation',
      description: 'Implementation status and details',
      defaultExpanded: true
    },
    {
      id: 'compliance',
      label: 'Compliance',
      description: 'Compliance status and testing',
      defaultExpanded: false
    }
  ],
  fields: [
    {
      id: 'id',
      label: 'Control Instance ID',
      type: 'text',
      required: true,
      group: 'identification',
      helpText: 'Unique identifier for this control instance'
    },
    {
      id: 'control-acronym',
      label: 'Control Acronym',
      type: 'text',
      required: true,
      group: 'identification',
      helpText: 'Base control identifier (e.g., AC-1)'
    },
    {
      id: 'control-information',
      label: 'Control Information',
      type: 'textarea',
      required: true,
      group: 'description',
      helpText: 'Full control description, guidance, and assessment methods'
    },
    {
      id: 'control-implementation-status',
      label: 'Implementation Status',
      type: 'select',
      required: true,
      group: 'implementation',
      options: ['Implemented', 'Planned', 'Not Implemented'],
      helpText: 'Current implementation status of this control'
    },
    {
      id: 'security-control-designation',
      label: 'Control Designation',
      type: 'select',
      required: true,
      group: 'implementation',
      options: ['Common', 'Hybrid', 'System-Specific'],
      helpText: 'How this control is designated in the authorization boundary'
    },
    {
      id: 'control-implementation-narrative',
      label: 'Implementation Narrative',
      type: 'textarea',
      required: true,
      group: 'implementation',
      helpText: 'Detailed description of how this control is implemented'
    },
    {
      id: 'cci',
      label: 'CCI Number',
      type: 'text',
      required: true,
      group: 'identification',
      helpText: 'Control Correlation Identifier'
    },
    {
      id: 'cci-definition',
      label: 'CCI Definition',
      type: 'textarea',
      required: true,
      group: 'description',
      helpText: 'Definition of the CCI requirement'
    },
    {
      id: 'implementation-guidance',
      label: 'Implementation Guidance',
      type: 'textarea',
      required: true,
      group: 'implementation',
      helpText: 'Specific guidance for implementing this control'
    },
    {
      id: 'assessment-procedures',
      label: 'Assessment Procedures',
      type: 'textarea',
      required: true,
      group: 'compliance',
      helpText: 'Procedures for assessing this control'
    },
    {
      id: 'inherited',
      label: 'Inherited From',
      type: 'text',
      required: false,
      group: 'implementation',
      helpText: 'Source of inheritance (if applicable)'
    },
    {
      id: 'remote-inheritance-instance',
      label: 'Remote Inheritance Instance',
      type: 'text',
      required: false,
      group: 'implementation',
      helpText: 'Remote system providing inheritance'
    },
    {
      id: 'compliance-status',
      label: 'Compliance Status',
      type: 'select',
      required: true,
      group: 'compliance',
      options: ['Compliant', 'Non-Compliant', 'Not Assessed'],
      helpText: 'Current compliance assessment status'
    },
    {
      id: 'test-results',
      label: 'Test Results',
      type: 'textarea',
      required: false,
      group: 'compliance',
      helpText: 'Results of testing or assessment activities'
    }
  ]
};

// Note: Mappings use a consistent internal format regardless of control format
// They are not part of the adapter pattern since they're implementation-specific

/**
 * Native adapter that handles the current internal YAML format
 */
export class InternalYamlAdapter implements FormatAdapter {
  readonly id = 'internal-yaml';
  readonly name = 'Internal YAML Format';
  readonly version = '1.0.0';
  readonly schema = INTERNAL_YAML_SCHEMA;

  /**
   * Import is essentially a pass-through for the native format
   */
  async import(data: any, options?: ImportOptions): Promise<ImportResult> {
    try {
      // For native format, data should already be Controls
      const controls = Array.isArray(data.controls) ? data.controls as Control[] : 
                     Array.isArray(data) ? data as Control[] :
                     [data as Control];

      // Validate each control against our schema
      const warnings: ValidationWarning[] = [];
      const validControls: Control[] = [];

      for (const control of controls) {
        const validation = await this.validateControl(control);
        if (validation.valid) {
          validControls.push(control);
        } else {
          warnings.push(...validation.warnings);
          // Add validation errors as warnings for native format
          warnings.push(...validation.errors.map(e => ({
            field: e.field,
            message: e.message,
            path: e.path
          })));
          // For native format, we're more lenient - include even invalid controls
          validControls.push(control);
        }
      }

      return {
        controls: validControls,
        warnings,
        summary: {
          controlsImported: validControls.length,
          skipped: 0,
          errors: 0
        }
      };
    } catch (error) {
      throw new Error(`Failed to import native format: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Export is also a pass-through for the native format
   */
  async export(controls: Control[], options?: ExportOptions): Promise<ExportResult> {
    try {
      const data = {
        controls: controls.map(control => ({ ...control })) // Clone to avoid mutations
      };

      return {
        data,
        mimeType: 'application/x-yaml',
        filename: 'controls.yaml',
        warnings: []
      };
    } catch (error) {
      throw new Error(`Failed to export native format: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate control data against NIST schema
   */
  async validate(data: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      if (!data || typeof data !== 'object') {
        errors.push({ message: 'Data must be an object' });
        return { valid: false, errors, warnings };
      }

      // Check if it's a single control or collection
      if (this.isControl(data)) {
        const result = await this.validateControl(data);
        return result;
      }

      // Check if it's a collection with controls and mappings
      if (data.controls && Array.isArray(data.controls)) {
        for (let i = 0; i < data.controls.length; i++) {
          const controlResult = await this.validateControl(data.controls[i]);
          if (!controlResult.valid) {
            errors.push(...controlResult.errors.map(e => ({
              ...e,
              path: `controls[${i}].${e.field || 'unknown'}`
            })));
          }
          warnings.push(...controlResult.warnings);
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
   * Check if this adapter can handle the given data
   */
  canHandle(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check for a single control
    if (this.isControl(data)) {
      return true;
    }

    // Check for collection format
    if (data.controls && Array.isArray(data.controls)) {
      return data.controls.some((item: any) => this.isControl(item));
    }

    return false;
  }

  /**
   * Check if an object looks like a NIST control
   */
  private isControl(obj: any): boolean {
    return obj &&
           typeof obj === 'object' &&
           typeof obj.id === 'string' &&
           typeof obj['control-acronym'] === 'string' &&
           typeof obj.cci === 'string';
  }

  /**
   * Validate a single control against the schema
   */
  private async validateControl(control: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const field of this.schema.fields) {
      const value = control[field.id];

      // Check required fields
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: field.id,
          message: `${field.label} is required`
        });
        continue;
      }

      // Skip validation if field is not present and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (field.type === 'select' && field.options && !field.options.includes(value)) {
        errors.push({
          field: field.id,
          message: `${field.label} must be one of: ${field.options.join(', ')}`
        });
      }

      // Custom validation rules
      if (field.validation) {
        for (const rule of field.validation) {
          const validationError = this.validateField(value, rule, field.label);
          if (validationError) {
            errors.push({
              field: field.id,
              message: validationError
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a field value against a validation rule
   */
  private validateField(value: any, rule: any, fieldLabel: string): string | null {
    switch (rule.type) {
      case 'required':
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          return rule.message || `${fieldLabel} is required`;
        }
        break;

      case 'minLength':
        if (typeof value === 'string' && value.length < rule.value) {
          return rule.message || `${fieldLabel} must be at least ${rule.value} characters`;
        }
        break;

      case 'maxLength':
        if (typeof value === 'string' && value.length > rule.value) {
          return rule.message || `${fieldLabel} must be no more than ${rule.value} characters`;
        }
        break;

      case 'pattern':
        if (typeof value === 'string' && rule.value) {
          const regex = new RegExp(rule.value);
          if (!regex.test(value)) {
            return rule.message || `${fieldLabel} format is invalid`;
          }
        }
        break;
    }

    return null;
  }
}