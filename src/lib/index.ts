// Core library exports

// Types (base types first)
export type * from './types.js';

// Adapters system (with potential type conflicts resolved)
export {
  type FormatAdapter,
  type ControlSchema,
  type FieldDefinition,
  type ValidationResult,
  type ImportOptions,
  type ImportResult,
  type ExportOptions,
  type ExportResult,
  adapterRegistry,
  registerAdapter,
  getAdapter,
  getAvailableAdapters,
  detectAdapter,
  getDefaultAdapter,
  InternalYamlAdapter,
  OSCALImportAdapter
} from './adapters/index.js';

// Existing utilities (explicit exports to avoid conflicts)
export { api } from './api.js';
export { FileStore } from './fileStore.js';
export { GitHistoryUtil } from './gitHistory.js';
export * from './yamlDiff.js';
