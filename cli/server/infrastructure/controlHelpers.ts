// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * Control helper utilities for managing control ID field configuration
 * Handles dynamic control ID field names based on control set metadata
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

/**
 * Control set metadata structure
 * Contains configuration for how controls are identified and structured
 */
interface ControlSetMetadata {
	/** The field name that contains the control ID */
	control_id_field?: string;
	/** Control set name */
	name?: string;
	/** Control set version */
	version?: string;
	/** Additional metadata fields */
	[key: string]: unknown;
}

/**
 * Control object with flexible ID field
 * The actual ID field name is determined by control set metadata
 */
interface ControlObject {
	/** Standard ID field (fallback) */
	id?: string;
	/** Alternative ID field names */
	'ap-acronym'?: string;
	'control-id'?: string;
	control_id?: string;
	controlId?: string;
	/** Other control properties */
	[key: string]: unknown;
}

/** Cached control set metadata to avoid repeated file reads */
let controlSetMetadata: ControlSetMetadata | null = null;

/** Path to the currently loaded metadata file */
let metadataPath: string | null = null;

/**
 * Load control set metadata from disk
 * Caches the metadata to avoid repeated file reads
 *
 * @param baseDir - Base directory containing lula.yaml
 * @returns The loaded control set metadata
 *
 * @example
 * ```typescript
 * const metadata = loadControlSetMetadata('/path/to/control-set');
 * console.log(metadata.control_id_field); // 'ap-acronym'
 * ```
 */
export function loadControlSetMetadata(baseDir: string): ControlSetMetadata {
	const path = join(baseDir, 'lula.yaml');

	// Only reload if path changed or not loaded yet
	if (metadataPath !== path || !controlSetMetadata) {
		if (existsSync(path)) {
			try {
				const content = readFileSync(path, 'utf8');
				controlSetMetadata = yaml.load(content) as ControlSetMetadata;
				metadataPath = path;
			} catch (error) {
				console.error(`Failed to parse lula.yaml at ${path}:`, error);
				// Use empty metadata as fallback
				controlSetMetadata = {};
				metadataPath = path;
			}
		} else {
			// No metadata file found, use defaults
			controlSetMetadata = {};
			metadataPath = path;
		}
	}

	return controlSetMetadata;
}

/**
 * Get the control ID field name from metadata
 * Returns 'id' as default if not configured
 *
 * @param baseDir - Optional base directory to load metadata from
 * @returns The configured control ID field name
 *
 * @example
 * ```typescript
 * const idField = getControlIdField('/path/to/control-set');
 * console.log(idField); // 'ap-acronym' or 'id' (default)
 * ```
 */
export function getControlIdField(baseDir?: string): string {
	if (baseDir) {
		loadControlSetMetadata(baseDir);
	}
	return controlSetMetadata?.control_id_field || 'id';
}

/**
 * Extract control ID from a control object
 * Tries multiple strategies to find the control ID:
 * 1. Use the configured field from metadata
 * 2. Fall back to 'id' field if different
 * 3. Try common alternative field names
 *
 * @param control - The control object to extract ID from
 * @param baseDir - Optional base directory for metadata lookup
 * @returns The extracted control ID
 * @throws Error if no control ID can be found
 *
 * @example
 * ```typescript
 * const control = { 'ap-acronym': 'AC-1', title: 'Access Control Policy' };
 * const id = getControlId(control, '/path/to/control-set');
 * console.log(id); // 'AC-1'
 * ```
 */
export function getControlId(control: ControlObject, baseDir?: string): string {
	if (!control || typeof control !== 'object') {
		throw new Error('Invalid control object provided');
	}

	const idField = getControlIdField(baseDir);

	// Try the configured field first
	const configuredId = control[idField as keyof ControlObject];
	if (configuredId && typeof configuredId === 'string') {
		return configuredId;
	}

	// Fallback to 'id' field if different from configured field
	if (idField !== 'id' && control.id) {
		return control.id;
	}

	// Last resort - try to find any field that looks like an ID
	const possibleIdFields: Array<keyof ControlObject> = [
		'ap-acronym',
		'control-id',
		'control_id',
		'controlId'
	];

	for (const field of possibleIdFields) {
		const value = control[field];
		if (value && typeof value === 'string') {
			return value;
		}
	}

	// Provide helpful error message with available fields
	const availableFields = Object.keys(control).filter(
		(key) => control[key as keyof ControlObject] !== undefined
	);
	throw new Error(
		`No control ID found in control object. Available fields: ${availableFields.join(', ')}`
	);
}

/**
 * Set control ID on a control object
 * Uses the configured field name from metadata
 *
 * @param control - The control object to modify
 * @param id - The ID value to set
 * @param baseDir - Optional base directory for metadata lookup
 *
 * @example
 * ```typescript
 * const control = { title: 'Access Control Policy' };
 * setControlId(control, 'AC-1', '/path/to/control-set');
 * console.log(control['ap-acronym']); // 'AC-1' (if configured)
 * ```
 */
export function setControlId(control: ControlObject, id: string, baseDir?: string): void {
	if (!control || typeof control !== 'object') {
		throw new Error('Invalid control object provided');
	}

	if (!id || typeof id !== 'string') {
		throw new Error('Invalid control ID provided');
	}

	const idField = getControlIdField(baseDir);
	control[idField as keyof ControlObject] = id;

	// Also set the standard 'id' field for consistency
	if (idField !== 'id') {
		control.id = id;
	}
}

/**
 * Clear cached metadata
 * Useful for testing or when switching control sets
 *
 * @example
 * ```typescript
 * clearMetadataCache();
 * // Next call to getControlId will reload metadata
 * ```
 */
export function clearMetadataCache(): void {
	controlSetMetadata = null;
	metadataPath = null;
}

/**
 * Get the current cached metadata
 * Useful for debugging or testing
 *
 * @returns The currently cached metadata or null
 */
export function getCachedMetadata(): ControlSetMetadata | null {
	return controlSetMetadata;
}
