// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

export interface FieldDefinition {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'boolean' | 'date' | 'number' | 'string-array' | 'object-array';
  description?: string;
  placeholder?: string;
  required?: boolean;
  group?: string;
  rows?: number; // for textarea
  options?: string[]; // for select
  validation?: ValidationRule[];
  helpText?: string;
  arrayItemType?: 'string' | 'object'; // for array types
  arraySchema?: any; // schema for object array items
}

export interface ValidationRule {
  type: 'minLength' | 'maxLength' | 'pattern';
  value: number; // Made required to fix TypeScript errors
  pattern?: string;
  message?: string;
}

export interface ControlSchema {
  name: string;
  version: string;
  fields: FieldDefinition[];
  groups?: FieldGroup[];
}

export interface FieldGroup {
  id: string;
  label: string;
  description?: string;
}


export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}
