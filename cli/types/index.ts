// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * CLI Types Module
 *
 * Defines types used throughout the CLI module to avoid cross-boundary imports
 * from the frontend src/ directory.
 */

// Control and Mapping types (duplicated from src/lib/types.ts to avoid coupling)
export interface Control {
	id: string;
	title?: string;
	description?: string;
	guidance?: string;
	parameters?: Record<string, any>;
	enhancements?: Enhancement[];
	family?: string;
	priority?: string;
	responsible?: string;
	[key: string]: any;
}

export interface Enhancement {
	id: string;
	title?: string;
	description?: string;
	guidance?: string;
	parameters?: Record<string, any>;
	[key: string]: any;
}

export interface Mapping {
	uuid: string;
	control_id: string;
	enhancement_id?: string;
	source_file: string;
	line_number?: number;
	description: string;
	type: 'implementation' | 'documentation' | 'test' | 'config';
	status: 'implemented' | 'partial' | 'planned' | 'not-applicable';
	last_updated: string;
	evidence?: string;
	notes?: string;
}

// Control Set types
export interface ControlSet {
	id: string;
	name: string;
	description?: string;
	version?: string;
	lastModified?: string;
	path?: string;
	families?: string[];
	metadata?: {
		source?: string;
		baseline?: string;
		revision?: string;
		[key: string]: any;
	};
}

export interface ControlSetInfo {
	currentSet: ControlSet;
	availableSets: ControlSet[];
}

// Git history types
export interface GitCommit {
	hash: string;
	author: string;
	date: string;
	message: string;
}

export interface GitFileHistory {
	file: string;
	commits: GitCommit[];
}

export interface ControlWithHistory extends Control {
	history: GitCommit[];
}

export interface ControlCompleteData {
	control: Control;
	mappings: Mapping[];
	history: GitCommit[];
}

export interface UnifiedHistory {
	type: 'control' | 'mapping';
	item: Control | Mapping;
	commit: GitCommit;
}

// Server state types
export interface ServerState {
	controlSetDir: string;
	controls: Map<string, Control>;
	mappings: Map<string, Mapping[]>;
	lastLoaded: Date;
}
