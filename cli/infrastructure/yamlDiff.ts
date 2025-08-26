// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import * as YAML from 'yaml';

export interface YamlDiffChange {
	type: 'added' | 'removed' | 'modified';
	path: string;
	oldValue?: any;
	newValue?: any;
	description: string;
}

export interface YamlDiffResult {
	hasChanges: boolean;
	changes: YamlDiffChange[];
	summary: string;
}

/**
 * Create an intelligent YAML-aware diff between two YAML strings
 */
export function createYamlDiff(oldYaml: string, newYaml: string): YamlDiffResult {
	try {
		const oldData = YAML.parse(oldYaml || '{}');
		const newData = YAML.parse(newYaml || '{}');

		const changes = compareObjects(oldData, newData, '');

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

function compareObjects(oldObj: any, newObj: any, basePath: string): YamlDiffChange[] {
	const changes: YamlDiffChange[] = [];

	// Handle null/undefined cases
	if (oldObj === null || oldObj === undefined) {
		if (newObj !== null && newObj !== undefined) {
			changes.push({
				type: 'added',
				path: basePath || 'root',
				newValue: newObj,
				description: `Added ${basePath || 'content'}`
			});
		}
		return changes;
	}

	if (newObj === null || newObj === undefined) {
		changes.push({
			type: 'removed',
			path: basePath || 'root',
			oldValue: oldObj,
			description: `Removed ${basePath || 'content'}`
		});
		return changes;
	}

	// Handle arrays
	if (Array.isArray(oldObj) || Array.isArray(newObj)) {
		return compareArrays(oldObj, newObj, basePath);
	}

	// Handle objects
	if (typeof oldObj === 'object' && typeof newObj === 'object') {
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
					changes.push(...compareObjects(oldValue, newValue, currentPath));
				} else {
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

	// Handle primitive values
	if (oldObj !== newObj) {
		changes.push({
			type: 'modified',
			path: basePath,
			oldValue: oldObj,
			newValue: newObj,
			description: `Changed ${basePath || 'value'}`
		});
	}

	return changes;
}

function compareArrays(oldArray: any[], newArray: any[], basePath: string): YamlDiffChange[] {
	const changes: YamlDiffChange[] = [];

	if (!Array.isArray(oldArray)) oldArray = [];
	if (!Array.isArray(newArray)) newArray = [];

	// For mappings and similar arrays, try to match by uuid or other identifier
	if (basePath.includes('mappings')) {
		return compareMappingsArrays(oldArray, newArray, basePath);
	}

	// Simple array comparison
	const maxLength = Math.max(oldArray.length, newArray.length);

	for (let i = 0; i < maxLength; i++) {
		const currentPath = `${basePath}[${i}]`;
		const oldItem = i < oldArray.length ? oldArray[i] : undefined;
		const newItem = i < newArray.length ? newArray[i] : undefined;

		if (oldItem === undefined) {
			changes.push({
				type: 'added',
				path: currentPath,
				newValue: newItem,
				description: `Added item at index ${i}`
			});
		} else if (newItem === undefined) {
			changes.push({
				type: 'removed',
				path: currentPath,
				oldValue: oldItem,
				description: `Removed item at index ${i}`
			});
		} else if (!deepEqual(oldItem, newItem)) {
			changes.push(...compareObjects(oldItem, newItem, currentPath));
		}
	}

	return changes;
}

function compareMappingsArrays(
	oldMappings: any[],
	newMappings: any[],
	basePath: string
): YamlDiffChange[] {
	const changes: YamlDiffChange[] = [];

	// Create maps by UUID for efficient lookup
	const oldMap = new Map();
	const newMap = new Map();

	oldMappings.forEach((mapping, index) => {
		if (mapping && mapping.uuid) {
			oldMap.set(mapping.uuid, { mapping, index });
		}
	});

	newMappings.forEach((mapping, index) => {
		if (mapping && mapping.uuid) {
			newMap.set(mapping.uuid, { mapping, index });
		}
	});

	// Find added mappings
	for (const [uuid, { mapping }] of newMap) {
		if (!oldMap.has(uuid)) {
			changes.push({
				type: 'added',
				path: `${basePath}[uuid=${uuid}]`,
				newValue: mapping,
				description: `Added mapping for ${mapping.control_id || 'control'}`
			});
		}
	}

	// Find removed mappings
	for (const [uuid, { mapping }] of oldMap) {
		if (!newMap.has(uuid)) {
			changes.push({
				type: 'removed',
				path: `${basePath}[uuid=${uuid}]`,
				oldValue: mapping,
				description: `Removed mapping for ${mapping.control_id || 'control'}`
			});
		}
	}

	// Find modified mappings
	for (const [uuid, { mapping: newMapping }] of newMap) {
		if (oldMap.has(uuid)) {
			const { mapping: oldMapping } = oldMap.get(uuid);
			if (!deepEqual(oldMapping, newMapping)) {
				changes.push(...compareObjects(oldMapping, newMapping, `${basePath}[uuid=${uuid}]`));
			}
		}
	}

	return changes;
}

function deepEqual(obj1: any, obj2: any): boolean {
	if (obj1 === obj2) return true;

	if (obj1 == null || obj2 == null) return obj1 === obj2;

	if (typeof obj1 !== typeof obj2) return false;

	if (typeof obj1 !== 'object') return obj1 === obj2;

	if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);

	if (keys1.length !== keys2.length) return false;

	for (const key of keys1) {
		if (!keys2.includes(key)) return false;
		if (!deepEqual(obj1[key], obj2[key])) return false;
	}

	return true;
}

function generateSummary(changes: YamlDiffChange[]): string {
	if (changes.length === 0) return 'No changes';

	const added = changes.filter((c) => c.type === 'added').length;
	const removed = changes.filter((c) => c.type === 'removed').length;
	const modified = changes.filter((c) => c.type === 'modified').length;

	const parts: string[] = [];
	if (added > 0) parts.push(`${added} added`);
	if (removed > 0) parts.push(`${removed} removed`);
	if (modified > 0) parts.push(`${modified} modified`);

	return parts.join(', ');
}

/**
 * Format a value for display in diffs
 */
export function formatValue(value: any): string {
	if (value === null) return 'null';
	if (value === undefined) return 'undefined';
	if (typeof value === 'string') return `"${value}"`;
	if (typeof value === 'object') {
		return YAML.stringify(value).trim();
	}
	return String(value);
}
