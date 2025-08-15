/**
 * Adapter system for supporting multiple compliance frameworks
 * 
 * This module provides a generic adapter pattern that allows the system
 * to work with multiple compliance formats while maintaining the
 * git-friendly YAML storage format.
 */

// Core types and interfaces
export type {
  FormatAdapter,
  ControlSchema,
  FieldDefinition,
  ValidationRule,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ImportOptions,
  ImportResult,
  ExportOptions,
  ExportResult,
  AdapterRegistry,
  AdapterMetadata,
  AdapterControlSetInfo,
  SchemaGroup
} from './types.js';

// Registry functions
export {
  adapterRegistry,
  registerAdapter,
  getAdapter,
  getAvailableAdapters,
  detectAdapter,
  getDefaultAdapter,
  importWithAdapter,
  exportWithAdapter
} from './registry.js';

// Built-in adapters
export { InternalYamlAdapter } from './nist-native.js';
export { OSCALImportAdapter } from './oscal-import.js';

// Utility functions
export {
  validateControlData,
  getSchemaForAdapter,
  listAvailableFormats,
  createAdapterInfo
} from './utils.js';