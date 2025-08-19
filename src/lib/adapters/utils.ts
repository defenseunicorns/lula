/**
 * Utility functions for the adapter system
 */

import type { Control } from '../types.js';
import type {
  FormatAdapter,
  ControlSchema,
  ValidationResult,
  FieldDefinition
} from './types.js';
import { adapterRegistry } from './registry.js';

/**
 * Validate control data against a specific adapter's schema
 */
export async function validateControlData(
  control: Control,
  adapterId?: string
): Promise<ValidationResult> {
  const adapter = adapterId 
    ? adapterRegistry.get(adapterId)
    : adapterRegistry.detect(control);

  if (!adapter) {
    return {
      valid: false,
      errors: [{ message: 'No suitable adapter found for validation' }],
      warnings: []
    };
  }

  return adapter.validate(control);
}

/**
 * Get schema for a specific adapter
 */
export function getSchemaForAdapter(adapterId: string): ControlSchema | undefined {
  const adapter = adapterRegistry.get(adapterId);
  return adapter?.schema;
}

/**
 * List all available format names and versions
 */
export function listAvailableFormats(): Array<{
  id: string;
  name: string;
  version: string;
  description: string;
}> {
  return adapterRegistry.getAll().map(adapter => ({
    id: adapter.id,
    name: adapter.name,
    version: adapter.version,
    description: adapter.schema.description
  }));
}

/**
 * Create adapter information for UI display
 */
export function createAdapterInfo(adapter: FormatAdapter): {
  id: string;
  name: string;
  version: string;
  schema: {
    name: string;
    description: string;
    fieldCount: number;
    groups: string[];
  };
  capabilities: {
    canImport: boolean;
    canExport: boolean;
    canValidate: boolean;
    hasMappingSchema: boolean;
  };
} {
  return {
    id: adapter.id,
    name: adapter.name,
    version: adapter.version,
    schema: {
      name: adapter.schema.name,
      description: adapter.schema.description,
      fieldCount: adapter.schema.fields.length,
      groups: adapter.schema.groups?.map(g => g.label) || []
    },
    capabilities: {
      canImport: typeof adapter.import === 'function',
      canExport: typeof adapter.export === 'function',
      canValidate: typeof adapter.validate === 'function',
      hasMappingSchema: false // Mappings are internal-only and don't vary by format
    }
  };
}

/**
 * Get field definition by ID from a schema
 */
export function getFieldDefinition(
  schema: ControlSchema,
  fieldId: string
): FieldDefinition | undefined {
  return schema.fields.find(field => field.id === fieldId);
}

/**
 * Get required fields from a schema
 */
export function getRequiredFields(schema: ControlSchema): FieldDefinition[] {
  return schema.fields.filter(field => field.required);
}

/**
 * Get optional fields from a schema
 */
export function getOptionalFields(schema: ControlSchema): FieldDefinition[] {
  return schema.fields.filter(field => !field.required);
}

/**
 * Group fields by their group property
 */
export function groupFieldsByGroup(
  schema: ControlSchema
): Record<string, FieldDefinition[]> {
  const grouped: Record<string, FieldDefinition[]> = {};
  
  schema.fields.forEach(field => {
    const group = field.group || 'default';
    if (!grouped[group]) {
      grouped[group] = [];
    }
    grouped[group].push(field);
  });

  return grouped;
}

/**
 * Validate that a control has all required fields for a schema
 */
export function validateRequiredFields(
  control: Control,
  schema: ControlSchema
): { valid: boolean; missingFields: string[] } {
  const requiredFields = getRequiredFields(schema);
  const missingFields: string[] = [];

  requiredFields.forEach(field => {
    const value = (control as any)[field.id];
    if (value === undefined || value === null || value === '') {
      missingFields.push(field.id);
    }
  });

  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Convert control data to match a specific schema
 * (useful for schema migration)
 */
export function adaptControlToSchema(
  control: Control,
  targetSchema: ControlSchema,
  fieldMapping?: Record<string, string>
): Partial<Control> {
  const adapted: any = {};
  
  targetSchema.fields.forEach(field => {
    const sourceField = fieldMapping?.[field.id] || field.id;
    const value = (control as any)[sourceField];
    
    if (value !== undefined) {
      adapted[field.id] = value;
    } else if (field.required) {
      // Set default values for required fields
      switch (field.type) {
        case 'text':
          adapted[field.id] = '';
          break;
        case 'select':
          adapted[field.id] = field.options?.[0] || '';
          break;
        case 'boolean':
          adapted[field.id] = false;
          break;
        case 'textarea':
          adapted[field.id] = '';
          break;
        default:
          adapted[field.id] = '';
      }
    }
  });

  return adapted;
}

/**
 * Get schema differences between two adapters
 */
export function compareSchemas(
  schema1: ControlSchema,
  schema2: ControlSchema
): {
  addedFields: FieldDefinition[];
  removedFields: FieldDefinition[];
  modifiedFields: Array<{
    field: FieldDefinition;
    changes: string[];
  }>;
  compatible: boolean;
} {
  const fields1 = new Map(schema1.fields.map(f => [f.id, f]));
  const fields2 = new Map(schema2.fields.map(f => [f.id, f]));

  const addedFields: FieldDefinition[] = [];
  const removedFields: FieldDefinition[] = [];
  const modifiedFields: Array<{ field: FieldDefinition; changes: string[] }> = [];

  // Find added fields
  fields2.forEach((field, id) => {
    if (!fields1.has(id)) {
      addedFields.push(field);
    }
  });

  // Find removed and modified fields
  fields1.forEach((field1, id) => {
    const field2 = fields2.get(id);
    if (!field2) {
      removedFields.push(field1);
    } else {
      const changes: string[] = [];
      
      if (field1.type !== field2.type) {
        changes.push(`type: ${field1.type} → ${field2.type}`);
      }
      
      if (field1.required !== field2.required) {
        changes.push(`required: ${field1.required} → ${field2.required}`);
      }
      
      if (field1.label !== field2.label) {
        changes.push(`label: "${field1.label}" → "${field2.label}"`);
      }

      if (changes.length > 0) {
        modifiedFields.push({ field: field2, changes });
      }
    }
  });

  // Check compatibility (breaking changes)
  const compatible = removedFields.length === 0 && 
    !modifiedFields.some(m => 
      m.changes.some(c => 
        c.includes('type:') || 
        c.includes('required: false → true')
      )
    );

  return {
    addedFields,
    removedFields,
    modifiedFields,
    compatible
  };
}