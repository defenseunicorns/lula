/**
 * Core adapter interfaces for supporting multiple compliance frameworks
 * while maintaining git-friendly YAML storage format.
 */

import type { Control, Mapping } from '../types.js';

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value?: any;
  message: string;
  pattern?: string; // For pattern validation
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field?: string;
  message: string;
  path?: string;
}

export interface ValidationWarning {
  field?: string;
  message: string;
  path?: string;
}

export interface FieldDefinition {
  id: string;
  label: string;
  description?: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'boolean' | 'date' | 'number';
  required: boolean;
  validation?: ValidationRule[];
  options?: string[];
  placeholder?: string;
  helpText?: string;
  group?: string; // For organizing fields in UI sections
  rows?: number; // For textarea fields
  defaultValue?: any;
  disabled?: boolean;
  pattern?: string; // For text input validation
}

export interface ControlSchema {
  name: string;
  version: string;
  description: string;
  fields: FieldDefinition[];
  groups?: SchemaGroup[];
}

export interface SchemaGroup {
  id: string;
  label: string;
  description?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

// Note: Mappings are internal-only and don't need schema variation
// They always use the same format regardless of control format

/**
 * Core adapter interface for converting between external formats
 * and the internal git-friendly YAML format
 */
export interface FormatAdapter {
  /** Schema definition for this format */
  readonly schema: ControlSchema;
  
  /** Unique identifier for this adapter */
  readonly id: string;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Version of the format this adapter supports */
  readonly version: string;
  
  /**
   * Convert external format data to internal Control format
   */
  import(data: any, options?: ImportOptions): Promise<ImportResult>;
  
  /**
   * Convert internal Control format to external format
   * Note: Mappings are internal-only and not included in exports
   */
  export(controls: Control[], options?: ExportOptions): Promise<ExportResult>;
  
  /**
   * Validate external format data
   */
  validate(data: any): Promise<ValidationResult>;
  
  /**
   * Check if this adapter can handle the given data
   */
  canHandle(data: any): boolean;
}

export interface ImportOptions {
  /** Whether to preserve original IDs or generate new ones */
  preserveIds?: boolean;
  
  /** Control ID prefix for generated IDs */
  idPrefix?: string;
  
  /** Whether to overwrite existing controls */
  overwrite?: boolean;
  
  /** Filter controls to import (regex or function) */
  filter?: string | ((control: any) => boolean);
  
  /** Additional metadata to preserve */
  preserveMetadata?: string[];
}

export interface ImportResult {
  /** Successfully imported controls */
  controls: Control[];
  
  /** Any metadata that should be preserved for export */
  metadata?: Record<string, any>;
  
  /** Import warnings (non-fatal issues) */
  warnings: ValidationWarning[];
  
  /** Summary statistics */
  summary: {
    controlsImported: number;
    skipped: number;
    errors: number;
  };
}

export interface ExportOptions {
  /** Format-specific options */
  formatOptions?: Record<string, any>;
  
  /** Whether to include implementation details */
  includeImplementation?: boolean;
  
  /** Template to use for export (if adapter supports multiple) */
  template?: string;
}

export interface ExportResult {
  /** The exported data in the target format */
  data: any;
  
  /** MIME type of the exported data */
  mimeType: string;
  
  /** Suggested filename */
  filename: string;
  
  /** Export warnings */
  warnings: ValidationWarning[];
}

/**
 * Registry for managing format adapters
 */
export interface AdapterRegistry {
  /**
   * Register a new adapter
   */
  register(adapter: FormatAdapter): void;
  
  /**
   * Get an adapter by ID
   */
  get(id: string): FormatAdapter | undefined;
  
  /**
   * List all registered adapter IDs
   */
  list(): string[];
  
  /**
   * Get all registered adapters
   */
  getAll(): FormatAdapter[];
  
  /**
   * Find adapter that can handle the given data
   */
  detect(data: any): FormatAdapter | undefined;
  
  /**
   * Unregister an adapter
   */
  unregister(id: string): boolean;
}

/**
 * Metadata format for preserving adapter-specific information
 */
export interface AdapterMetadata {
  /** Adapter ID that created this metadata */
  adapterId: string;
  
  /** Adapter version */
  adapterVersion: string;
  
  /** Original format version */
  sourceVersion: string;
  
  /** Import timestamp */
  importedAt: string;
  
  /** Import options used */
  importOptions?: ImportOptions;
  
  /** Additional adapter-specific metadata */
  data: Record<string, any>;
}

/**
 * Enhanced control set information with adapter support
 */
export interface AdapterControlSetInfo {
  /** Basic control set metadata */
  id: string;
  name: string;
  version: string;
  description: string;
  
  /** Adapter configuration */
  formatAdapter: string;
  
  /** Schema version for this control set */
  schemaVersion: string;
  
  /** Optional adapter metadata */
  adapterMetadata?: AdapterMetadata;
  
  /** Creation and modification timestamps */
  created: string;
  lastModified: string;
  
  /** File system path */
  path?: string;
  
  /** Derived information */
  families?: string[];
  controlCount?: number;
  mappingCount?: number;
}