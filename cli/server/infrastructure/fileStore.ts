// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * Simplified FileStore for git-friendly YAML storage
 * Uses predictable filenames based on control IDs
 */

import {
	existsSync,
	promises as fs,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	unlinkSync,
	writeFileSync
} from 'fs';
import * as yaml from 'js-yaml';
import { join } from 'path';
import type { Control, Mapping } from '../types';
import { getControlId } from './controlHelpers';

export interface ControlMetadata {
	controlId: string;
	filename: string;
	family: string;
}

export interface FileStoreOptions {
	baseDir: string;
}

export interface FileStoreStats {
	controlCount: number;
	mappingCount: number;
	familyCount: number;
}

/**
 * FileStore for git-friendly YAML storage using control IDs as filenames
 */
export class FileStore {
	private baseDir: string;
	private controlsDir: string;
	private mappingsDir: string;

	// Simple cache - just control ID to filename mapping
	private controlMetadataCache = new Map<string, ControlMetadata>();

	constructor(options: FileStoreOptions) {
		this.baseDir = options.baseDir;
		this.controlsDir = join(this.baseDir, 'controls');
		this.mappingsDir = join(this.baseDir, 'mappings');

		// Don't create directories in constructor - only when needed
		// This prevents creating empty folders in project root

		// Load control metadata if directories exist
		if (existsSync(this.controlsDir)) {
			this.refreshControlsCache();
		}
	}

	/**
	 * Get simple filename from control ID
	 */
	private getControlFilename(controlId: string): string {
		// Sanitize control ID for filename, preserving the first dash
		// AC-1.1 -> AC-1_1, AC-10.3 -> AC-10_3, but AC-1 stays AC-1
		 
		const sanitized = controlId.replace(/^([A-Z]+)-(.*)/, (match, prefix, suffix) => {
			// Preserve the first dash, replace other non-word chars with underscores
			return `${prefix}-${suffix.replace(/[^\w]/g, '_')}`;
		});
		return `${sanitized}.yaml`;
	}

	/**
	 * Get family name from control ID
	 */
	private getControlFamily(controlId: string): string {
		return controlId.split('-')[0];
	}

	/**
	 * Ensure required directories exist
	 */
	private ensureDirectories(): void {
		// Only create directories if baseDir is a valid control set path
		// Avoid creating directories in project root
		if (!this.baseDir || this.baseDir === '.' || this.baseDir === process.cwd()) {
			// Skipping directory creation - baseDir appears to be project root
			return;
		}

		// Check if baseDir contains a lula.yaml file (indicating it's a valid control set directory)
		const lulaConfigPath = join(this.baseDir, 'lula.yaml');
		if (!existsSync(lulaConfigPath)) {
			// Skipping directory creation - no lula.yaml found
			return;
		}

		if (!existsSync(this.controlsDir)) {
			mkdirSync(this.controlsDir, { recursive: true });
		}
		if (!existsSync(this.mappingsDir)) {
			mkdirSync(this.mappingsDir, { recursive: true });
		}
	}

	/**
	 * Get control metadata by ID
	 */
	getControlMetadata(controlId: string): ControlMetadata | undefined {
		return this.controlMetadataCache.get(controlId);
	}

	/**
	 * Load a control by ID
	 */
	async loadControl(controlId: string): Promise<Control | null> {
		// controlId might be either the actual control ID (AC-1.1) or the filename without extension (AC-1_1)
		// We need to handle both cases

		// Convert control ID to filename format (AC-1.1 -> AC-1_1)
		// eslint-disable-next-line no-useless-escape
		const sanitizedId = controlId.replace(/[^\w\-]/g, '_');

		// Try flat structure first (atomic controls)
		// Try both the original ID and sanitized version
		const possibleFlatPaths = [
			join(this.controlsDir, `${controlId}.yaml`),
			join(this.controlsDir, `${sanitizedId}.yaml`)
		];

		for (const flatFilePath of possibleFlatPaths) {
			if (existsSync(flatFilePath)) {
				try {
					const content = readFileSync(flatFilePath, 'utf8');
					const parsed = yaml.load(content) as any;
					// Ensure the control has an 'id' field
					// Always use the original control ID format (with dots, not underscores)
					if (!parsed.id) {
						try {
							parsed.id = getControlId(parsed, this.baseDir);
						} catch {
							// Fallback to the controlId parameter if getControlId fails
							parsed.id = controlId;
						}
					}
					return parsed as Control;
				} catch (error) {
					console.error(`Failed to load control ${controlId} from flat structure:`, error);
					throw new Error(
						`Failed to load control ${controlId}: ${error instanceof Error ? error.message : String(error)}`
					);
				}
			}
		}

		// Fallback to family-based structure
		const family = this.getControlFamily(controlId);
		const familyDir = join(this.controlsDir, family);

		// Try both formats in family directory
		const possibleFamilyPaths = [
			join(familyDir, `${controlId}.yaml`),
			join(familyDir, `${sanitizedId}.yaml`)
		];

		for (const filePath of possibleFamilyPaths) {
			if (existsSync(filePath)) {
				try {
					const content = readFileSync(filePath, 'utf8');
					const parsed = yaml.load(content) as any;
					// Ensure the control has an 'id' field
					// Always use the original control ID format (with dots, not underscores)
					if (!parsed.id) {
						try {
							parsed.id = getControlId(parsed, this.baseDir);
						} catch {
							// Fallback to the controlId parameter if getControlId fails
							parsed.id = controlId;
						}
					}
					return parsed as Control;
				} catch (error) {
					console.error(`Failed to load control ${controlId}:`, error);
					throw new Error(
						`Failed to load control ${controlId}: ${error instanceof Error ? error.message : String(error)}`
					);
				}
			}
		}

		// Control not found in any location
		return null;
	}

	/**
	 * Save a control
	 */
	async saveControl(control: Control): Promise<void> {
		// Ensure base directories exist when saving
		this.ensureDirectories();

		const controlId = getControlId(control, this.baseDir);
		const family = this.getControlFamily(controlId);
		const filename = this.getControlFilename(controlId);
		const familyDir = join(this.controlsDir, family);
		const filePath = join(familyDir, filename);

		// Ensure family directory exists
		if (!existsSync(familyDir)) {
			mkdirSync(familyDir, { recursive: true });
		}

		try {
			// If file exists, only update changed fields to preserve format
			let yamlContent: string;
			if (existsSync(filePath)) {
				// Read existing file content as text to preserve exact format
				const existingContent = readFileSync(filePath, 'utf8');
				const existingControl = yaml.load(existingContent) as any;

				// Only update fields that actually changed from the control object
				// Remove runtime fields that should never be persisted
				const fieldsToUpdate: any = {};
				for (const key in control) {
					if (
						key === 'timeline' ||
						key === 'unifiedHistory' ||
						key === '_metadata' ||
						key === 'id' // Don't save the 'id' field - it's derived from ap-acronym or control_id_field
					) {
						continue; // Skip runtime-only fields
					}
					// Only include fields that are different from existing
					if (JSON.stringify(control[key]) !== JSON.stringify(existingControl[key])) {
						fieldsToUpdate[key] = control[key];
					}
				}

				// If there are changes, update only those fields
				if (Object.keys(fieldsToUpdate).length > 0) {
					const updatedControl = { ...existingControl, ...fieldsToUpdate };

					// Parse and re-stringify to maintain consistent format
					// But use more conservative settings to preserve existing style
					yamlContent = yaml.dump(updatedControl, {
						indent: 2,
						lineWidth: 80,
						noRefs: true,
						sortKeys: false
					});
				} else {
					// No changes, keep existing content
					yamlContent = existingContent;
				}
			} else {
				// New file - create with standard format
				const controlToSave: any = { ...control };
				delete controlToSave.timeline;
				delete controlToSave.unifiedHistory;
				delete controlToSave._metadata;
				delete controlToSave.id; // Don't save the 'id' field - it's derived from ap-acronym or control_id_field

				yamlContent = yaml.dump(controlToSave, {
					indent: 2,
					lineWidth: 80,
					noRefs: true,
					sortKeys: false
				});
			}

			writeFileSync(filePath, yamlContent, 'utf8');

			// Update cache
			this.controlMetadataCache.set(controlId, {
				controlId,
				filename,
				family
			});
		} catch (error) {
			throw new Error(
				`Failed to save control ${controlId}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Delete a control
	 */
	async deleteControl(controlId: string): Promise<void> {
		const family = this.getControlFamily(controlId);
		const filename = this.getControlFilename(controlId);
		const familyDir = join(this.controlsDir, family);
		const filePath = join(familyDir, filename);

		if (existsSync(filePath)) {
			unlinkSync(filePath);
			this.controlMetadataCache.delete(controlId);
		}
	}

	/**
	 * Load all controls
	 */
	async loadAllControls(): Promise<Control[]> {
		if (!existsSync(this.controlsDir)) {
			return [];
		}

		const entries = readdirSync(this.controlsDir);

		// Check for flat structure first (atomic controls)
		const yamlFiles = entries.filter((file) => file.endsWith('.yaml'));
		if (yamlFiles.length > 0) {
			// Flat structure - load controls in parallel
			const promises = yamlFiles.map(async (file) => {
				try {
					const filePath = join(this.controlsDir, file);
					const content = await fs.readFile(filePath, 'utf8');
					const parsed = yaml.load(content) as any;
					// Ensure the control has an 'id' field
					if (!parsed.id) {
						parsed.id = getControlId(parsed, this.baseDir);
					}
					return parsed as Control;
				} catch (error) {
					console.error(`Failed to load control from file ${file}:`, error);
					return null;
				}
			});

			const results = await Promise.all(promises);
			return results.filter((c): c is Control => c !== null);
		}

		// Fallback to family-based directory structure
		const families = entries.filter((name) => {
			const familyPath = join(this.controlsDir, name);
			return statSync(familyPath).isDirectory();
		});

		// Load all controls from all families in parallel
		const allPromises: Promise<Control | null>[] = [];

		for (const family of families) {
			const familyPath = join(this.controlsDir, family);
			const files = readdirSync(familyPath).filter((file) => file.endsWith('.yaml'));

			const familyPromises = files.map(async (file) => {
				try {
					// Extract control ID from filename
					// Keep the original filename format (AC-1_1.yaml means control ID AC-1.1)
					const controlId = file.replace('.yaml', '');
					const control = await this.loadControl(controlId);
					return control;
				} catch (error) {
					console.error(`Failed to load control from file ${file}:`, error);
					return null;
				}
			});

			allPromises.push(...familyPromises);
		}

		const results = await Promise.all(allPromises);
		return results.filter((c): c is Control => c !== null);
	}

	/**
	 * Load mappings from mappings directory
	 */
	async loadMappings(): Promise<Mapping[]> {
		const mappings: Mapping[] = [];

		if (!existsSync(this.mappingsDir)) {
			return mappings;
		}

		// Read all family directories
		const families = readdirSync(this.mappingsDir).filter((name) => {
			const familyPath = join(this.mappingsDir, name);
			return statSync(familyPath).isDirectory();
		});

		for (const family of families) {
			const familyPath = join(this.mappingsDir, family);

			// Load all per-control mapping files in this family
			const files = readdirSync(familyPath).filter((file) => file.endsWith('-mappings.yaml'));

			for (const file of files) {
				const mappingFile = join(familyPath, file);
				try {
					const content = readFileSync(mappingFile, 'utf8');
					const parsed = yaml.load(content) as any;

					if (Array.isArray(parsed)) {
						mappings.push(...parsed);
					}
				} catch (error) {
					console.error(`Failed to load mappings from ${family}/${file}:`, error);
				}
			}
		}

		return mappings;
	}

	/**
	 * Save a single mapping
	 */
	async saveMapping(mapping: Mapping): Promise<void> {
		// Ensure base directories exist when saving
		this.ensureDirectories();

		const controlId = mapping.control_id;
		const family = this.getControlFamily(controlId);
		const familyDir = join(this.mappingsDir, family);
		const mappingFile = join(
			familyDir,
			`${controlId.replace(/[^a-zA-Z0-9-]/g, '_')}-mappings.yaml`
		);

		// Ensure family directory exists
		if (!existsSync(familyDir)) {
			mkdirSync(familyDir, { recursive: true });
		}

		// Load existing mappings for this control
		let existingMappings: Mapping[] = [];
		if (existsSync(mappingFile)) {
			try {
				const content = readFileSync(mappingFile, 'utf8');
				existingMappings = (yaml.load(content) as Mapping[]) || [];
			} catch (error) {
				console.error(`Failed to parse existing mappings file: ${mappingFile}`, error);
				existingMappings = [];
			}
		}

		// Update or add the mapping
		const existingIndex = existingMappings.findIndex((m) => m.uuid === mapping.uuid);
		if (existingIndex >= 0) {
			existingMappings[existingIndex] = mapping;
		} else {
			existingMappings.push(mapping);
		}

		// Save back to file
		try {
			const yamlContent = yaml.dump(existingMappings, {
				indent: 2,
				lineWidth: -1,
				noRefs: true
			});

			writeFileSync(mappingFile, yamlContent, 'utf8');
		} catch (error) {
			throw new Error(
				`Failed to save mapping for control ${controlId}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Delete a single mapping
	 */
	async deleteMapping(compositeKey: string): Promise<void> {
		// Find the mapping in all mapping files
		const mappingFiles = this.getAllMappingFiles();

		for (const file of mappingFiles) {
			try {
				const content = readFileSync(file, 'utf8');
				let mappings: Mapping[] = (yaml.load(content) as Mapping[]) || [];

				const originalLength = mappings.length;
				mappings = mappings.filter((m) => {
					return `${m.control_id}:${m.uuid}` !== compositeKey;
				});

				// If we removed a mapping, save the file
				if (mappings.length < originalLength) {
					if (mappings.length === 0) {
						// Delete the file if no mappings remain
						unlinkSync(file);
					} else {
						// Save the remaining mappings
						const yamlContent = yaml.dump(mappings, {
							indent: 2,
							lineWidth: -1,
							noRefs: true
						});
						writeFileSync(file, yamlContent, 'utf8');
					}
					return; // Found and deleted, we're done
				}
			} catch (error) {
				console.error(`Error processing mapping file ${file}:`, error);
			}
		}
	}

	/**
	 * Get all mapping files
	 */
	private getAllMappingFiles(): string[] {
		const files: string[] = [];

		if (!existsSync(this.mappingsDir)) {
			return files;
		}

		// Check for flat structure
		const flatFiles = readdirSync(this.mappingsDir)
			.filter((file) => file.endsWith('-mappings.yaml'))
			.map((file) => join(this.mappingsDir, file));
		files.push(...flatFiles);

		// Check for family directories
		const entries = readdirSync(this.mappingsDir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory()) {
				const familyDir = join(this.mappingsDir, entry.name);
				const familyFiles = readdirSync(familyDir)
					.filter((file) => file.endsWith('-mappings.yaml'))
					.map((file) => join(familyDir, file));
				files.push(...familyFiles);
			}
		}

		return files;
	}

	/**
	 * Save mappings to per-control files
	 */
	async saveMappings(mappings: Mapping[]): Promise<void> {
		// Ensure base directories exist when saving
		this.ensureDirectories();

		// Group mappings by control ID
		const mappingsByControl = new Map<string, Mapping[]>();

		for (const mapping of mappings) {
			const controlId = mapping.control_id;
			if (!mappingsByControl.has(controlId)) {
				mappingsByControl.set(controlId, []);
			}
			mappingsByControl.get(controlId)!.push(mapping);
		}

		// Save each control's mappings
		for (const [controlId, controlMappings] of mappingsByControl) {
			const family = this.getControlFamily(controlId);
			const familyDir = join(this.mappingsDir, family);
			const mappingFile = join(
				familyDir,
				`${controlId.replace(/[^a-zA-Z0-9-]/g, '_')}-mappings.yaml`
			);

			// Ensure family directory exists
			if (!existsSync(familyDir)) {
				mkdirSync(familyDir, { recursive: true });
			}

			try {
				const yamlContent = yaml.dump(controlMappings, {
					indent: 2,
					lineWidth: -1,
					noRefs: true
				});

				writeFileSync(mappingFile, yamlContent, 'utf8');
			} catch (error) {
				throw new Error(
					`Failed to save mappings for control ${controlId}: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
	}

	/**
	 * Refresh controls cache
	 */
	private refreshControlsCache(): void {
		this.controlMetadataCache.clear();

		if (!existsSync(this.controlsDir)) {
			return;
		}

		const entries = readdirSync(this.controlsDir);

		// Check for flat structure first (atomic controls)
		const yamlFiles = entries.filter((file) => file.endsWith('.yaml'));
		if (yamlFiles.length > 0) {
			// Flat structure - cache controls directly from controls/ directory
			for (const filename of yamlFiles) {
				const controlId = filename.replace('.yaml', '');
				const family = this.getControlFamily(controlId);

				this.controlMetadataCache.set(controlId, {
					controlId: controlId,
					filename: filename,
					family: family
				});
			}
			return;
		}

		// Fallback to family-based directory structure
		const families = entries.filter((name) => {
			const familyPath = join(this.controlsDir, name);
			return statSync(familyPath).isDirectory();
		});

		for (const family of families) {
			const familyPath = join(this.controlsDir, family);
			const files = readdirSync(familyPath).filter((file) => file.endsWith('.yaml'));

			for (const filename of files) {
				try {
					// Read the actual control ID from the file metadata
					const filePath = join(familyPath, filename);
					const content = readFileSync(filePath, 'utf8');
					const parsed = yaml.load(content) as any;

					// Get control ID from _metadata.controlId or fall back to filename
					// let controlId: string;
					const controlId = getControlId(parsed, this.baseDir);

					this.controlMetadataCache.set(controlId, {
						controlId: controlId,
						filename: filename,
						family: family
					});
				} catch (error) {
					console.error(`Failed to read control metadata from ${family}/${filename}:`, error);
					// Fallback to filename-based control ID
					const controlId = filename.replace('.yaml', '').replace(/_/g, '/');
					this.controlMetadataCache.set(controlId, {
						controlId: controlId,
						filename: filename,
						family: family
					});
				}
			}
		}
	}

	/**
	 * Get file store statistics
	 */
	getStats(): FileStoreStats {
		const controlCount = this.controlMetadataCache.size;

		// Count mappings
		let mappingCount = 0;
		if (existsSync(this.mappingsDir)) {
			const families = readdirSync(this.mappingsDir).filter((name) => {
				const familyPath = join(this.mappingsDir, name);
				return statSync(familyPath).isDirectory();
			});
			mappingCount = families.length; // Approximate - one mapping file per family
		}

		const familyCount = new Set(
			Array.from(this.controlMetadataCache.values()).map((meta) => meta.family)
		).size;

		return {
			controlCount,
			mappingCount,
			familyCount
		};
	}

	/**
	 * Clear all caches
	 */
	clearCache(): void {
		this.controlMetadataCache.clear();
		this.refreshControlsCache();
	}
}
