// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * CLI Types Module
 *
 * Defines types used throughout the CLI module to avoid cross-boundary imports
 * from the frontend src/ directory.
 */

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
 * Security control definition
 */
export interface Control {
	/** Control identifier */
	id: string;
	/** Control title */
	title?: string;
	/** Control description */
	description?: string;
	/** Implementation guidance */
	guidance?: string;
	/** Control parameters */
	parameters?: ControlParameters;
	/** Control enhancements */
	enhancements?: Enhancement[];
	/** Control family (e.g., AC, AU, etc.) */
	family?: string;
	/** Control priority (e.g., P1, P2, P3) */
	priority?: string;
	/** Responsible party */
	responsible?: string;
	/** Additional control properties from various standards */
	[key: string]: unknown;
}

/**
 * Mapping of source code to control
 */
export interface Mapping {
	/** Unique identifier for the mapping */
	uuid: string;
	/** Control identifier this maps to */
	control_id: string;
	/** Enhancement identifier if mapping to enhancement */
	enhancement_id?: string;
	/** Source file path */
	source_file: string;
	/** Line number in source file */
	line_number?: number;
	/** Description of the mapping */
	description: string;
	/** Type of mapping */
	type: 'implementation' | 'documentation' | 'test' | 'config';
	/** Implementation status */
	status: 'implemented' | 'partial' | 'planned' | 'not-applicable';
	/** Last update timestamp */
	last_updated: string;
	/** Evidence for the mapping */
	evidence?: string;
	/** Additional notes */
	notes?: string;
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
 * Control set definition
 */
export interface ControlSet {
	/** Control set identifier */
	id: string;
	/** Control set name */
	name: string;
	/** Control set description */
	description?: string;
	/** Control set version */
	version?: string;
	/** Last modification time */
	lastModified?: string;
	/** File system path */
	path?: string;
	/** Available control families */
	families?: string[];
	/** Control set metadata */
	metadata?: ControlSetMetadata;
}

/**
 * Control set information
 */
export interface ControlSetInfo {
	/** Currently active control set */
	currentSet: ControlSet;
	/** All available control sets */
	availableSets: ControlSet[];
}

/**
 * Git commit information
 */
export interface GitCommit {
	/** Commit hash */
	hash: string;
	/** Commit author */
	author: string;
	/** Commit date */
	date: string;
	/** Commit message */
	message: string;
}

/**
 * Git file history
 */
export interface GitFileHistory {
	/** File path */
	file: string;
	/** Commits affecting this file */
	commits: GitCommit[];
}

/**
 * Control with git history
 */
export interface ControlWithHistory extends Control {
	/** Git history for this control */
	history: GitCommit[];
}

/**
 * Complete control data including mappings and history
 */
export interface ControlCompleteData {
	/** The control */
	control: Control;
	/** Mappings for this control */
	mappings: Mapping[];
	/** Git history for this control */
	history: GitCommit[];
}

/**
 * Unified history entry
 */
export interface UnifiedHistory {
	/** Type of the item */
	type: 'control' | 'mapping';
	/** The control or mapping */
	item: Control | Mapping;
	/** The commit */
	commit: GitCommit;
}

/**
 * Server state
 */
export interface ServerState {
	/** Control set directory */
	controlSetDir: string;
	/** Map of control IDs to controls */
	controls: Map<string, Control>;
	/** Map of control IDs to their mappings */
	mappings: Map<string, Mapping[]>;
	/** Last data load time */
	lastLoaded: Date;
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
