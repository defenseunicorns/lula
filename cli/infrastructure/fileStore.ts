// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * Simplified FileStore for git-friendly YAML storage
 * Uses predictable filenames based on control IDs
 */

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	unlinkSync,
	writeFileSync
} from 'fs';
import { join } from 'path';
import * as YAML from 'yaml';
import type { Control, Mapping } from '../types';

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
		// Sanitize control ID for filename (replace invalid characters)
		const sanitized = controlId.replace(/[^\w\-\.]/g, '_');
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
		// Try flat structure first (atomic controls)
		const flatFilename = `${controlId}.yaml`;
		const flatFilePath = join(this.controlsDir, flatFilename);

		if (existsSync(flatFilePath)) {
			try {
				const content = readFileSync(flatFilePath, 'utf8');
				const parsed = YAML.parse(content);
				return parsed as Control;
			} catch (error) {
				console.error(`Failed to load control ${controlId} from flat structure:`, error);
				throw new Error(
					`Failed to load control ${controlId}: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}

		// Fallback to family-based structure
		const family = this.getControlFamily(controlId);
		const filename = this.getControlFilename(controlId);
		const familyDir = join(this.controlsDir, family);
		const filePath = join(familyDir, filename);

		if (!existsSync(filePath)) {
			return null;
		}

		try {
			const content = readFileSync(filePath, 'utf8');
			const parsed = YAML.parse(content);

			// Extract the control data (skip metadata if present)
			if (parsed._metadata) {
				const { _metadata, ...control } = parsed;
				// Preserve the control ID from metadata as the id field
				return { id: _metadata.controlId, ...control } as Control;
			}

			return parsed as Control;
		} catch (error) {
			console.error(`Failed to load control ${controlId}:`, error);
			throw new Error(
				`Failed to load control ${controlId}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Save a control
	 */
	async saveControl(control: Control): Promise<void> {
		// Ensure base directories exist when saving
		this.ensureDirectories();
		
		const family = this.getControlFamily(control.id);
		const filename = this.getControlFilename(control.id);
		const familyDir = join(this.controlsDir, family);
		const filePath = join(familyDir, filename);

		// Ensure family directory exists
		if (!existsSync(familyDir)) {
			mkdirSync(familyDir, { recursive: true });
		}

		try {
			// Create control data with simple metadata
			const controlWithMetadata = {
				_metadata: {
					controlId: control.id,
					family: family
				},
				...control
			};

			const yamlContent = YAML.stringify(controlWithMetadata, {
				indent: 2,
				lineWidth: 0,
				minContentWidth: 0
			});

			writeFileSync(filePath, yamlContent, 'utf8');

			// Update cache
			this.controlMetadataCache.set(control.id, {
				controlId: control.id,
				filename: filename,
				family: family
			});
		} catch (error) {
			throw new Error(
				`Failed to save control ${control.id}: ${error instanceof Error ? error.message : String(error)}`
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
		const controls: Control[] = [];

		if (!existsSync(this.controlsDir)) {
			return controls;
		}

		const entries = readdirSync(this.controlsDir);

		// Check for flat structure first (atomic controls)
		const yamlFiles = entries.filter((file) => file.endsWith('.yaml'));
		if (yamlFiles.length > 0) {
			// Flat structure - load controls directly from controls/ directory
			for (const file of yamlFiles) {
				try {
					const filePath = join(this.controlsDir, file);
					const content = readFileSync(filePath, 'utf8');
					const parsed = YAML.parse(content);

					// Handle atomic control format directly
					if (parsed && parsed.id) {
						controls.push(parsed as Control);
					}
				} catch (error) {
					console.error(`Failed to load control from file ${file}:`, error);
				}
			}
			return controls;
		}

		// Fallback to family-based directory structure
		const families = entries.filter((name) => {
			const familyPath = join(this.controlsDir, name);
			return statSync(familyPath).isDirectory();
		});

		for (const family of families) {
			const familyPath = join(this.controlsDir, family);
			const files = readdirSync(familyPath).filter((file) => file.endsWith('.yaml'));

			for (const file of files) {
				try {
					// Extract control ID from filename
					const controlId = file.replace('.yaml', '').replace(/_/g, '/'); // Handle sanitized names

					const control = await this.loadControl(controlId);
					if (control) {
						controls.push(control);
					}
				} catch (error) {
					console.error(`Failed to load control from file ${file}:`, error);
				}
			}
		}

		return controls;
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
					const parsed = YAML.parse(content);

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
			const mappingFile = join(familyDir, `${controlId}-mappings.yaml`);

			// Ensure family directory exists
			if (!existsSync(familyDir)) {
				mkdirSync(familyDir, { recursive: true });
			}

			try {
				const yamlContent = YAML.stringify(controlMappings, {
					indent: 2,
					lineWidth: 0,
					minContentWidth: 0
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
					const parsed = YAML.parse(content);

					// Get control ID from _metadata.controlId or fall back to filename
					let controlId: string;
					if (parsed._metadata && parsed._metadata.controlId) {
						controlId = parsed._metadata.controlId;
					} else if (parsed.id) {
						controlId = parsed.id;
					} else {
						// Fallback to filename extraction (reverse the sanitization)
						controlId = filename.replace('.yaml', '').replace(/_/g, '/');
					}

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

// Backward compatibility export
export { FileStore as SimpleFileStore };
