// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * YAML diff utilities for creating intelligent diffs between YAML documents
 * Provides structured change detection and human-readable summaries
 */

import * as yaml from 'js-yaml';

/**
 * Represents a single change between two YAML documents
 */
export interface YamlDiffChange {
	/** Type of change */
	type: 'added' | 'removed' | 'modified';
	/** Path to the changed field (dot notation) */
	path: string;
	/** Previous value (for removed/modified) */
	oldValue?: unknown;
	/** New value (for added/modified) */
	newValue?: unknown;
	/** Human-readable description of the change */
	description: string;
}

/**
 * Result of comparing two YAML documents
 */
export interface YamlDiffResult {
	/** Whether any changes were detected */
	hasChanges: boolean;
	/** List of all changes */
	changes: YamlDiffChange[];
	/** Human-readable summary of changes */
	summary: string;
}

/**
 * Valid YAML value types
 */
type YamlValue = string | number | boolean | null | YamlObject | YamlArray;
type YamlObject = { [key: string]: YamlValue };
type YamlArray = YamlValue[];

/**
 * Create an intelligent YAML-aware diff between two YAML strings
 *
 * @param oldYaml - The original YAML string
 * @param newYaml - The modified YAML string
 * @returns A structured diff result with changes and summary
 *
 * @example
 * ```typescript
 * const diff = createYamlDiff(oldYamlStr, newYamlStr);
 * console.log(diff.summary);
 * for (const change of diff.changes) {
 *   console.log(`${change.type}: ${change.path}`);
 * }
 * ```
 */
export function createYamlDiff(
	oldYaml: string,
	newYaml: string,
	isArrayFile: boolean = false
): YamlDiffResult {
	try {
		// For array files (like mappings), default to empty array instead of empty object
		const emptyDefault = isArrayFile ? '[]' : '{}';
		const oldData = yaml.load(oldYaml || emptyDefault) as YamlValue;
		const newData = yaml.load(newYaml || emptyDefault) as YamlValue;

		const changes = compareValues(oldData, newData, '');

		return {
			hasChanges: changes.length > 0,
			changes,
			summary: generateSummary(changes)
		};
	} catch (error) {
		console.error('Error parsing YAML for diff:', error);
		return {
			hasChanges: false,
			changes: [],
			summary: 'Error parsing YAML content'
		};
	}
}

/**
 * Compare two YAML values recursively
 *
 * @param oldValue - The original value
 * @param newValue - The modified value
 * @param basePath - The current path in dot notation
 * @returns List of changes detected
 */
function compareValues(
	oldValue: YamlValue,
	newValue: YamlValue,
	basePath: string
): YamlDiffChange[] {
	const changes: YamlDiffChange[] = [];

	// Handle null/undefined cases
	if (oldValue === null || oldValue === undefined) {
		if (newValue !== null && newValue !== undefined) {
			changes.push({
				type: 'added',
				path: basePath || 'root',
				newValue,
				description: `Added ${basePath || 'content'}`
			});
		}
		return changes;
	}

	if (newValue === null || newValue === undefined) {
		changes.push({
			type: 'removed',
			path: basePath || 'root',
			oldValue,
			description: `Removed ${basePath || 'content'}`
		});
		return changes;
	}

	// Handle arrays
	if (Array.isArray(oldValue) || Array.isArray(newValue)) {
		return compareArrays(oldValue as YamlArray, newValue as YamlArray, basePath);
	}

	// Handle objects
	if (typeof oldValue === 'object' && typeof newValue === 'object') {
		return compareObjects(oldValue as YamlObject, newValue as YamlObject, basePath);
	}

	// Handle primitives
	if (oldValue !== newValue) {
		changes.push({
			type: 'modified',
			path: basePath || 'root',
			oldValue,
			newValue,
			description: `Changed ${basePath || 'value'}`
		});
	}

	return changes;
}

/**
 * Compare two objects and detect changes
 *
 * @param oldObj - The original object
 * @param newObj - The modified object
 * @param basePath - The current path in dot notation
 * @returns List of changes detected
 */
function compareObjects(
	oldObj: YamlObject,
	newObj: YamlObject,
	basePath: string
): YamlDiffChange[] {
	const changes: YamlDiffChange[] = [];
	const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

	for (const key of allKeys) {
		const currentPath = basePath ? `${basePath}.${key}` : key;
		const oldValue = oldObj[key];
		const newValue = newObj[key];

		if (!(key in oldObj)) {
			changes.push({
				type: 'added',
				path: currentPath,
				newValue,
				description: `Added ${key}`
			});
		} else if (!(key in newObj)) {
			changes.push({
				type: 'removed',
				path: currentPath,
				oldValue,
				description: `Removed ${key}`
			});
		} else if (!deepEqual(oldValue, newValue)) {
			if (typeof oldValue === 'object' && typeof newValue === 'object') {
				// Recursively compare nested objects
				changes.push(...compareValues(oldValue, newValue, currentPath));
			} else {
				// For primitive values or type changes
				changes.push({
					type: 'modified',
					path: currentPath,
					oldValue,
					newValue,
					description: `Changed ${key}`
				});
			}
		}
	}

	return changes;
}

/**
 * Compare two arrays and detect changes
 *
 * @param oldArr - The original array
 * @param newArr - The modified array
 * @param basePath - The current path in dot notation
 * @returns List of changes detected
 */
function compareArrays(
	oldArr: YamlArray | unknown,
	newArr: YamlArray | unknown,
	basePath: string
): YamlDiffChange[] {
	const changes: YamlDiffChange[] = [];

	// Handle case where one is not an array
	if (!Array.isArray(oldArr) && Array.isArray(newArr)) {
		changes.push({
			type: 'modified',
			path: basePath || 'root',
			oldValue: oldArr,
			newValue: newArr,
			description: `Changed ${basePath || 'value'} from non-array to array`
		});
		return changes;
	}

	if (Array.isArray(oldArr) && !Array.isArray(newArr)) {
		changes.push({
			type: 'modified',
			path: basePath || 'root',
			oldValue: oldArr,
			newValue: newArr,
			description: `Changed ${basePath || 'value'} from array to non-array`
		});
		return changes;
	}

	// Both are arrays - compare them
	const oldArray = oldArr as YamlArray;
	const newArray = newArr as YamlArray;

	// For mapping arrays, provide better descriptions
	if (isMappingArray(oldArray) || isMappingArray(newArray)) {
		return compareMappingArrays(oldArray, newArray, basePath);
	}

	// Generic array comparison
	if (oldArray.length !== newArray.length) {
		changes.push({
			type: 'modified',
			path: basePath || 'root',
			oldValue: oldArray,
			newValue: newArray,
			description: `Array ${basePath || 'items'} changed from ${oldArray.length} to ${newArray.length} items`
		});
	} else {
		// Compare each element
		for (let i = 0; i < oldArray.length; i++) {
			const elementPath = `${basePath}[${i}]`;
			if (!deepEqual(oldArray[i], newArray[i])) {
				changes.push(...compareValues(oldArray[i], newArray[i], elementPath));
			}
		}
	}

	return changes;
}

/**
 * Check if an array is a mapping array
 */
function isMappingArray(arr: YamlArray): boolean {
	if (!Array.isArray(arr) || arr.length === 0) return false;
	const firstItem = arr[0];
	return (
		typeof firstItem === 'object' &&
		firstItem !== null &&
		'control_id' in firstItem &&
		'uuid' in firstItem
	);
}

/**
 * Compare mapping arrays with better descriptions
 */
function compareMappingArrays(
	oldArr: YamlArray,
	newArr: YamlArray,
	basePath: string
): YamlDiffChange[] {
	const changes: YamlDiffChange[] = [];

	// Build maps by UUID for efficient comparison
	const oldMappings = new Map<string, any>();
	const newMappings = new Map<string, any>();

	for (const item of oldArr) {
		if (typeof item === 'object' && item !== null && 'uuid' in item) {
			oldMappings.set(item.uuid as string, item);
		}
	}

	for (const item of newArr) {
		if (typeof item === 'object' && item !== null && 'uuid' in item) {
			newMappings.set(item.uuid as string, item);
		}
	}

	// Find added mappings
	for (const [uuid, mapping] of newMappings) {
		if (!oldMappings.has(uuid)) {
			changes.push({
				type: 'added',
				path: `mapping`,
				newValue: mapping,
				description: `Added mapping`
			});
		}
	}

	// Find removed mappings
	for (const [uuid, mapping] of oldMappings) {
		if (!newMappings.has(uuid)) {
			changes.push({
				type: 'removed',
				path: `mapping`,
				oldValue: mapping,
				description: `Removed mapping`
			});
		}
	}

	// Find modified mappings
	for (const [uuid, oldMapping] of oldMappings) {
		if (newMappings.has(uuid)) {
			const newMapping = newMappings.get(uuid);
			if (!deepEqual(oldMapping, newMapping)) {
				changes.push({
					type: 'modified',
					path: `mapping`,
					oldValue: oldMapping,
					newValue: newMapping,
					description: `Modified mapping`
				});
			}
		}
	}

	// If no specific changes but counts differ, add a summary
	if (changes.length === 0 && oldArr.length !== newArr.length) {
		changes.push({
			type: 'modified',
			path: basePath || 'mappings',
			oldValue: oldArr,
			newValue: newArr,
			description: `Mappings changed from ${oldArr.length} to ${newArr.length} items`
		});
	}

	return changes;
}

/**
 * Deep equality check for YAML values
 *
 * @param a - First value
 * @param b - Second value
 * @returns True if values are deeply equal
 */
function deepEqual(a: YamlValue, b: YamlValue): boolean {
	if (a === b) return true;
	if (a === null || b === null) return false;
	if (typeof a !== typeof b) return false;

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) return false;
		}
		return true;
	}

	if (typeof a === 'object' && typeof b === 'object') {
		const aObj = a as YamlObject;
		const bObj = b as YamlObject;
		const aKeys = Object.keys(aObj);
		const bKeys = Object.keys(bObj);

		if (aKeys.length !== bKeys.length) return false;

		for (const key of aKeys) {
			if (!bKeys.includes(key)) return false;
			if (!deepEqual(aObj[key], bObj[key])) return false;
		}
		return true;
	}

	return false;
}

/**
 * Generate a human-readable summary of changes
 *
 * @param changes - List of changes
 * @returns Summary string
 */
function generateSummary(changes: YamlDiffChange[]): string {
	if (changes.length === 0) {
		return 'No changes detected';
	}

	const added = changes.filter((c) => c.type === 'added').length;
	const removed = changes.filter((c) => c.type === 'removed').length;
	const modified = changes.filter((c) => c.type === 'modified').length;

	const parts: string[] = [];
	if (added > 0) parts.push(`${added} added`);
	if (removed > 0) parts.push(`${removed} removed`);
	if (modified > 0) parts.push(`${modified} modified`);

	return parts.join(', ');
}
