// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * CLI Types Module
 *
 * Defines CLI-specific types. Core types (Control, Mapping, etc.) are imported
 * from the frontend to maintain a single source of truth.
 */

// Import shared core types from frontend
import type {
	ControlCompleteData,
	ControlSet,
	ControlSetInfo,
	ControlWithHistory,
	Control as FrontendControl,
	Mapping as FrontendMapping,
	GitCommit,
	GitFileHistory,
	SourceEntry,
	UnifiedHistory
} from '../../src/lib/types';

// Re-export for external use
export type Control = FrontendControl;
export type Mapping = FrontendMapping;
export type {
	ControlCompleteData,
	ControlSet,
	ControlSetInfo,
	ControlWithHistory,
	GitCommit,
	GitFileHistory,
	SourceEntry,
	UnifiedHistory
};

/**
 * Parameter value can be string, number, boolean, or array of these
 */
export type ParameterValue = string | number | boolean | (string | number | boolean)[];

/**
 * Control parameters configuration
 */
export interface ControlParameters {
	[key: string]: ParameterValue;
}

/**
 * Enhancement to a control
 */
export interface Enhancement {
	/** Enhancement identifier */
	id: string;
	/** Enhancement title */
	title?: string;
	/** Enhancement description */
	description?: string;
	/** Implementation guidance */
	guidance?: string;
	/** Enhancement parameters */
	parameters?: ControlParameters;
	/** Additional enhancement properties */
	[key: string]: unknown;
}

/**
 * Control set metadata
 */
export interface ControlSetMetadata {
	/** Source of the control set */
	source?: string;
	/** Baseline profile */
	baseline?: string;
	/** Revision number */
	revision?: string;
	/** Control ID field name */
	control_id_field?: string;
	/** Additional metadata */
	[key: string]: unknown;
}

/**
 * Field metadata for spreadsheet import
 */
export interface FieldMetadata {
	/** Original field name from spreadsheet */
	originalName: string;
	/** Cleaned field name for YAML */
	cleanName: string;
	/** Detected data type */
	type: 'string' | 'number' | 'boolean' | 'date' | 'mixed';
	/** Maximum length of values */
	maxLength: number;
	/** Whether field has multiple lines */
	hasMultipleLines: boolean;
	/** Unique values in this field */
	uniqueValues: Set<unknown>;
	/** Count of empty values */
	emptyCount: number;
	/** Total count of values */
	totalCount: number;
	/** Example values */
	examples: unknown[];
}

/**
 * Spreadsheet row data
 */
export interface SpreadsheetRow {
	/** Row data indexed by column name */
	[columnName: string]: unknown;
}
