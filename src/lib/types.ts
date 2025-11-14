// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

export interface Control {
	id: string;
	title: string;
	family: string;
	class?: string;
	sort_id?: string;
	statement?: string;
	guidance?: string;
	objectives?: string[];
	assessment_methods?: string[];
	properties?: { [key: string]: string };
	links?: Array<{
		href: string;
		rel?: string;
		text?: string;
	}>;
	parameters?: Array<{
		id: string;
		label?: string;
		usage?: string;
		values?: string[];
		guidelines?: string[];
		constraints?: string[];
	}>;
	enhancements?: Control[];
	// Allow dynamic field access for form components
	[key: string]: any;
}

export interface Mapping {
	uuid: string;
	control_id: string;
	justification: string;
	source_entries: SourceEntry[];
	status: 'planned' | 'implemented' | 'verified';
	created_by?: string;
}

export interface SourceEntry {
	location: string;
	shasum?: string;
}

export interface ControlWithMappings extends Control {
	mappings: Mapping[];
}

export interface SearchResult {
	controls: Control[];
	mappings: Mapping[];
}

export interface Stats {
	controls: number;
	mappings: number;
	families: number;
	familyList: string[];
}

export interface FieldSchema {
	type: string;
	ui_type:
		| 'short_text'
		| 'medium_text'
		| 'textarea'
		| 'select'
		| 'date'
		| 'number'
		| 'boolean'
		| 'long_text';
	is_array: boolean;
	max_length?: number;
	usage_count?: number;
	usage_percentage?: number;
	required: boolean;
	visible: boolean;
	show_in_table?: boolean;
	editable: boolean;
	display_order: number;
	category: 'core' | 'content' | 'metadata' | 'compliance' | 'custom';
	tab?: 'overview' | 'implementation' | 'custom' | 'hidden';
	examples?: any[];
	options?: string[];
	original_name?: string;
}

export interface ControlSet {
	id: string;
	name: string;
	title?: string;
	description?: string;
	version?: string;
	lastModified?: string;
	path?: string;
	families?: Array<{
		id: string;
		name: string;
		control_count?: number;
	}>;
	project?: {
		framework?: {
			baseline?: string;
			name?: string;
		};
	};
	statistics?: {
		total_controls?: number;
		families?: number;
	};
	metadata?: {
		source?: string;
		baseline?: string;
		revision?: string;
		[key: string]: any;
	};
	fieldSchema?: {
		fields: Record<string, FieldSchema>;
		total_controls?: number;
		analyzed_at?: string;
	};
	field_schema?: {
		fields: Record<string, FieldSchema>;
		total_controls?: number;
		analyzed_at?: string;
	};
}

export interface ControlSetInfo {
	currentSet: ControlSet;
	availableSets: ControlSet[];
}

export interface GitCommit {
	hash: string;
	shortHash: string;
	author: string;
	authorEmail: string;
	date: string;
	message: string;
	changes: {
		insertions: number;
		deletions: number;
		files: number;
	};
	diff?: string; // The actual file diff
	yamlDiff?: any; // Intelligent YAML diff (YamlDiffResult)
	type?: string; // 'control' or 'mapping' - added by unified endpoint
	fileType?: string; // 'Control File' or 'Mappings' - added by unified endpoint
	isPending?: boolean; // true for uncommitted changes
	isStaged?: boolean; // true for staged changes (optional since user doesn't care about staged vs unstaged)
}

export interface GitFileHistory {
	filePath: string;
	commits: GitCommit[];
	totalCommits: number;
	firstCommit: GitCommit | null;
	lastCommit: GitCommit | null;
}

export interface ControlWithHistory extends Control {
	history?: GitFileHistory;
}

export interface UnifiedHistory {
	commits: GitCommit[];
	totalCommits: number;
	controlCommits: number;
	mappingCommits: number;
	controlFilePath?: string;
	mappingFilePath?: string;
}

export interface ControlCompleteData {
	control: Control;
	mappings: Mapping[];
	unifiedHistory: UnifiedHistory;
}

export interface GitBranchInfo {
	currentBranch: string;
	isAhead: boolean;
	isBehind: boolean;
	aheadCount: number;
	behindCount: number;
	lastCommitDate: string | null;
	lastCommitMessage: string | null;
	hasUnpushedChanges: boolean;
}

export interface GitStatus {
	isGitRepository: boolean;
	currentBranch: string | null;
	branchInfo: GitBranchInfo | null;
	canPull: boolean;
	canPush: boolean;
}
