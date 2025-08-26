// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * Universal Atomic Control Types
 *
 * Defines the core types for atomic control units that can represent
 * CCIs, NIST controls, ISO controls, or custom control types.
 */

export type AtomicControlType = 'cci' | 'nist' | 'iso' | 'cobit' | 'custom';

export interface AtomicControl {
	/** Unique identifier (CCI-000001, ac-1, iso-27001-a.5.1, etc.) */
	id: string;

	/** Type of atomic control */
	type: AtomicControlType;

	/** Human-readable title */
	title: string;

	/** Detailed definition or description of the requirement */
	definition: string;

	/** Source framework (nist-800-53, iso-27001, cobit, etc.) */
	framework: string;

	/** Framework version */
	framework_version?: string;

	/** Parent control context (AC-1, A.5, APO01, etc.) */
	parent_control?: string;

	/** Control family/category */
	family?: string;

	/** Implementation status */
	implementation_status:
		| 'not_implemented'
		| 'partially_implemented'
		| 'implemented'
		| 'not_applicable';

	/** Assessment/compliance status */
	compliance_status?: 'compliant' | 'non_compliant' | 'not_assessed';

	/** Priority level */
	priority?: 'high' | 'medium' | 'low';

	/** Control class (SP800-53, etc.) */
	class?: string;

	/** Sort identifier for ordering */
	sort_id?: string;

	/** Properties and metadata */
	properties?: Record<string, any>;

	/** Links to related resources */
	links?: Array<{
		href: string;
		rel: string;
		text?: string;
	}>;

	/** Implementation guidance */
	guidance?: string;

	/** Structured statement parts */
	statement_parts?: any[];

	/** Assessment objectives (structured) */
	objectives?: any[];

	/** Assessment methods (structured) */
	assessment_methods?: any[];

	/** Parameters that can be customized */
	parameters?: Array<{
		id: string;
		label: string;
		values?: string[];
		guidelines?: string[];
		select?: {
			how_many?: string;
			choice?: string[];
		};
	}>;

	/** References to standards and frameworks */
	references?: Array<{
		creator: string;
		title: string;
		version?: string;
		location?: string;
		index: string;
	}>;

	/** Evidence and documentation */
	evidence?: Array<{
		type: 'document' | 'code' | 'test' | 'other';
		name: string;
		description?: string;
		location: string;
		date_created?: string;
		date_reviewed?: string;
	}>;

	/** Source code mappings */
	mappings?: Array<{
		source_type: 'file' | 'directory' | 'function' | 'class';
		source_path: string;
		justification: string;
		status: 'planned' | 'implemented' | 'verified';
	}>;

	/** Review and audit information */
	last_reviewed?: string;
	next_review?: string;
	reviewed_by?: string;

	/** Notes and comments */
	notes?: string;

	/** Custom fields for extensibility */
	custom_fields?: Record<string, any>;
}

/**
 * CCI-specific fields when type is 'cci'
 */
export interface CCIControl extends AtomicControl {
	type: 'cci';

	/** CCI publication status */
	status: 'draft' | 'final';

	/** Publication date */
	publish_date?: string;

	/** Contributing organization */
	contributor?: string;

	/** CCI type classification */
	cci_type: 'policy' | 'technical' | 'procedural';
}

/**
 * Framework metadata for organizing atomic controls
 */
export interface ControlFramework {
	/** Framework identifier */
	id: string;

	/** Framework name */
	name: string;

	/** Framework version */
	version: string;

	/** Framework description */
	description?: string;

	/** Publisher/organization */
	publisher?: string;

	/** Default granularity level */
	default_granularity: 'control' | 'cci' | 'custom';

	/** Whether CCI enhancement is available */
	cci_enabled: boolean;

	/** Control families/categories */
	families?: Array<{
		id: string;
		name: string;
		description?: string;
	}>;

	/** Framework-specific metadata */
	metadata?: Record<string, any>;
}

/**
 * Import configuration for atomic control processing
 */
export interface AtomicImportOptions {
	/** Use CCI granularity for NIST controls */
	use_cci?: boolean;

	/** Output directory */
	output_dir: string;

	/** Overwrite existing files */
	overwrite?: boolean;

	/** Dry run mode */
	dry_run?: boolean;

	/** Flatten references */
	flatten_references?: boolean;

	/** Include links */
	include_links?: boolean;

	/** Resolve parameter insertions in control text (default: false to preserve OSCAL structure) */
	resolve_parameters?: boolean;

	/** Target framework version */
	framework_version?: string;

	/** Filter CCIs by NIST SP 800-53 revision (4 or 5) */
	nist_revision_filter?: '4' | '5';

	/** Custom field mappings */
	field_mappings?: Record<string, string>;
}
