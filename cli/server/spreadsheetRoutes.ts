// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import crypto from 'crypto';
import { parse as parseCSVSync } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import express from 'express';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import * as yaml from 'js-yaml';
import multer from 'multer';
import { dirname, join, relative } from 'path';
import { debug } from '../utils/debug';
import { getServerState } from './serverState';

// Type definitions
interface SpreadsheetRow {
	[key: string]: any;
}

interface MappingData {
	control_id: string;
	justification: string;
	uuid: string;
}

const router: express.Router = express.Router();
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Scan for existing lula.yaml files
// Export the scan function for reuse
export async function scanControlSets() {
	const state = getServerState();
	const baseDir = state.CONTROL_SET_DIR; // Always scan from the root

	// Search for lula.yaml files in subdirectories
	const pattern = '**/lula.yaml';
	const files = await glob(pattern, {
		cwd: baseDir,
		ignore: ['node_modules/**', 'dist/**', 'build/**'],
		maxDepth: 5
	});

	const controlSets = files
		.map((file) => {
			const fullPath = join(baseDir, file);
			const dirPath = dirname(fullPath);
			// Get relative path, but use '.' if it's the base directory itself
			const relativePath = relative(baseDir, dirPath) || '.';

			try {
				const content = readFileSync(fullPath, 'utf8');
				const data = yaml.load(content) as any;

				// Skip default/placeholder control sets
				if (data.id === 'default') {
					return null;
				}

				return {
					path: relativePath,
					name: data.name || 'Unnamed Control Set',
					description: data.description || '',
					controlCount: data.controlCount || 0,
					file: file
				};
			} catch (_err) {
				return {
					path: relativePath,
					name: 'Invalid lula.yaml',
					description: 'Could not parse file',
					controlCount: 0,
					file: file
				};
			}
		})
		.filter((cs) => cs !== null);

	return { controlSets };
}

// Process spreadsheet upload
router.post('/import-spreadsheet', upload.single('file'), async (req, res) => {
	try {
		if (!(req as any).file) {
			return res.status(400).json({ error: 'No file uploaded' });
		}

		const {
			controlIdField = 'Control ID',
			startRow = '1',
			controlSetName = 'Imported Control Set',
			controlSetDescription = 'Imported from spreadsheet'
		} = req.body;

		// Parse justification fields if provided
		let justificationFields: string[] = [];
		if (req.body.justificationFields) {
			try {
				justificationFields = JSON.parse(req.body.justificationFields);
				debug('Justification fields received:', justificationFields);
			} catch (e) {
				console.error('Failed to parse justification fields:', e);
			}
		}

		debug('Import parameters received:', {
			controlIdField,
			startRow,
			controlSetName,
			controlSetDescription
		});

		// Hard-coded values
		const namingConvention = 'kebab-case';
		const skipEmpty = true;
		const skipEmptyRows = true;

		// Parse the spreadsheet - handle both CSV and Excel
		const fileName = (req as any).file.originalname || '';
		const isCSV = fileName.toLowerCase().endsWith('.csv');
		let rawData: any[][] = [];

		if (isCSV) {
			// Parse CSV file
			const csvContent = (req as any).file.buffer.toString('utf-8');
			rawData = parseCSV(csvContent);
		} else {
			// Parse Excel file with ExcelJS
			const workbook = new ExcelJS.Workbook();
			// Convert multer buffer to Node.js Buffer
			const buffer = Buffer.from((req as any).file.buffer);
			await workbook.xlsx.load(buffer as any);
			const worksheet = workbook.worksheets[0];

			if (!worksheet) {
				return res.status(400).json({ error: 'No worksheet found in file' });
			}

			// Convert to array format similar to XLSX
			worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
				const rowData: any[] = [];
				row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
					rowData[colNumber - 1] = cell.value;
				});
				rawData[rowNumber - 1] = rowData;
			});
		}

		const startRowIndex = parseInt(startRow) - 1;
		if (rawData.length <= startRowIndex) {
			return res.status(400).json({ error: 'Start row exceeds sheet data' });
		}

		const headers = rawData[startRowIndex] as string[];
		if (!headers || headers.length === 0) {
			return res.status(400).json({ error: 'No headers found at specified row' });
		}

		debug('Headers found:', headers);
		debug(
			'After conversion, looking for control ID field:',
			applyNamingConvention(controlIdField, namingConvention)
		);

		// Process rows into controls
		const controls: SpreadsheetRow[] = [];
		const families = new Map<string, SpreadsheetRow[]>();

		// Field metadata collection
		const fieldMetadata = new Map<
			string,
			{
				originalName: string;
				cleanName: string;
				type: 'string' | 'number' | 'boolean' | 'date' | 'mixed';
				maxLength: number;
				hasMultipleLines: boolean;
				uniqueValues: Set<unknown>;
				emptyCount: number;
				totalCount: number;
				examples: unknown[];
			}
		>();

		// Initialize field metadata for each header
		headers.forEach((header) => {
			if (header) {
				const cleanName = applyNamingConvention(header, namingConvention);
				fieldMetadata.set(cleanName, {
					originalName: header,
					cleanName: cleanName,
					type: 'string',
					maxLength: 0,
					hasMultipleLines: false,
					uniqueValues: new Set(),
					emptyCount: 0,
					totalCount: 0,
					examples: []
				});
			}
		});

		for (let i = startRowIndex + 1; i < rawData.length; i++) {
			const row = rawData[i] as unknown[];
			if (!row || row.length === 0) continue;

			const control: SpreadsheetRow = {};
			let hasData = false;

			headers.forEach((header, index) => {
				if (header && row[index] !== undefined && row[index] !== null) {
					const value = typeof row[index] === 'string' ? row[index].trim() : row[index];
					const fieldName = applyNamingConvention(header, namingConvention);
					const metadata = fieldMetadata.get(fieldName)!;

					// Update field metadata
					metadata.totalCount++;

					if (value === '' || value === null || value === undefined) {
						metadata.emptyCount++;
						if (skipEmpty) return;
					} else {
						// Track value for metadata - normalize strings for uniqueness detection
						const normalizedValue = typeof value === 'string' ? value.trim() : value;
						if (normalizedValue !== '') {
							// Don't count empty strings as unique values
							metadata.uniqueValues.add(normalizedValue);
						}

						// Update type detection
						const valueType = detectValueType(value);
						if (metadata.type === 'string' || metadata.totalCount === 1) {
							metadata.type = valueType;
						} else if (metadata.type !== valueType) {
							metadata.type = 'mixed';
						}

						// Update max length for strings
						if (typeof value === 'string') {
							const length = value.length;
							if (length > metadata.maxLength) {
								metadata.maxLength = length;
							}

							// Check for multiple lines
							if (value.includes('\n') || length > 100) {
								metadata.hasMultipleLines = true;
							}
						}

						// Track a few examples for internal use only (not exported)
						if (metadata.examples.length < 3 && normalizedValue !== '') {
							metadata.examples.push(normalizedValue);
						}
					}

					control[fieldName] = value;
					hasData = true;
				}
			});

			if (hasData && (!skipEmptyRows || Object.keys(control).length > 0)) {
				// Extract control ID
				const controlIdFieldName = applyNamingConvention(controlIdField, namingConvention);
				// Extract control ID
				const controlId = control[controlIdFieldName];
				if (!controlId) {
					// No control ID found, skipping row
					continue;
				}

				// Always extract family from control ID, ignore family field
				const family = extractFamilyFromControlId(controlId);

				// Don't duplicate the field - just add family
				control.family = family;
				controls.push(control);

				// Group by family
				if (!families.has(family)) {
					families.set(family, []);
				}
				families.get(family)!.push(control);
			}
		}

		// Create output directory structure
		// Use control set name for folder, converted to kebab-case for filesystem compatibility
		const state = getServerState();
		const folderName = toKebabCase(controlSetName || 'imported-controls');
		const baseDir = join(state.CONTROL_SET_DIR || process.cwd(), folderName);

		if (!existsSync(baseDir)) {
			mkdirSync(baseDir, { recursive: true });
		}

		// Create lula.yaml with enhanced field metadata
		const uniqueFamilies = Array.from(families.keys()).filter((f) => f && f !== 'UNKNOWN');
		// Process families and controls

		// Build field schema from metadata in the expected format
		// Check if frontend provided field schema with tab assignments
		let frontendFieldSchema: Array<{
			fieldName: string;
			tab?: string;
			displayTab?: string;
			category?: string;
			required?: boolean;
			displayOrder?: number;
			originalName?: string;
		}> | null = null;
		if (req.body.fieldSchema) {
			try {
				frontendFieldSchema = JSON.parse(req.body.fieldSchema);
			} catch (e) {
				// Failed to parse fieldSchema
			}
		}

		const fields: Record<string, unknown> = {};
		let displayOrder = 1;

		// Store the control ID field name for the control-set metadata
		const controlIdFieldNameClean = applyNamingConvention(controlIdField, namingConvention);

		// Family should be a select since it has limited values
		const familyOptions = Array.from(families.keys())
			.filter((f) => f && f !== 'UNKNOWN')
			.sort();
		fields['family'] = {
			type: 'string',
			ui_type: familyOptions.length <= 50 ? 'select' : 'short_text', // Make select if reasonable number of families
			is_array: false,
			max_length: 10,
			usage_count: controls.length,
			usage_percentage: 100,
			required: true,
			visible: true,
			show_in_table: true,
			editable: false,
			display_order: displayOrder++,
			category: 'core',
			tab: 'overview'
		};

		// Add options for family field if it's a select
		if (familyOptions.length <= 50) {
			(fields['family'] as any).options = familyOptions;
		}

		// Add other fields from metadata
		fieldMetadata.forEach((metadata, fieldName) => {
			// Skip family as it's already added, and skip 'id' if it would duplicate the control ID field
			if (fieldName === 'family' || (fieldName === 'id' && controlIdFieldNameClean !== 'id')) {
				return;
			}

			// Check if this field was excluded in the frontend (not assigned to any tab)
			const frontendConfig = frontendFieldSchema?.find((f) => f.fieldName === fieldName);
			// If we have frontend schema and this field isn't in it, skip it (it was excluded)
			if (frontendFieldSchema && !frontendConfig) {
				return;
			}

			const usageCount = metadata.totalCount - metadata.emptyCount;
			const usagePercentage =
				metadata.totalCount > 0 ? Math.round((usageCount / metadata.totalCount) * 100) : 0;

			// Determine UI type based on metadata
			let uiType = 'short_text';

			// Check for dropdown fields - few unique values with short text and sufficient usage
			const nonEmptyCount = metadata.totalCount - metadata.emptyCount;
			const isDropdownCandidate =
				metadata.uniqueValues.size > 0 &&
				metadata.uniqueValues.size <= 20 && // Max 20 unique values for dropdown
				nonEmptyCount >= 10 && // At least 10 non-empty values to be meaningful
				metadata.maxLength <= 100 && // Reasonably short values only
				metadata.uniqueValues.size / nonEmptyCount <= 0.3; // Less than 30% unique ratio among non-empty values

			if (metadata.hasMultipleLines || metadata.maxLength > 500) {
				uiType = 'textarea';
			} else if (isDropdownCandidate) {
				uiType = 'select'; // Few unique values suggest a dropdown
			} else if (metadata.type === 'boolean') {
				uiType = 'checkbox';
			} else if (metadata.type === 'number') {
				uiType = 'number';
			} else if (metadata.type === 'date') {
				uiType = 'date';
			} else if (metadata.maxLength <= 50) {
				uiType = 'short_text';
			} else if (metadata.maxLength <= 200) {
				uiType = 'medium_text';
			} else {
				uiType = 'long_text';
			}

			// Determine category based on field name and usage or use frontend config
			let category = frontendConfig?.category || 'custom';
			// Check if this field is in the justification fields list
			if (justificationFields.includes(fieldName)) {
				category = 'mappings';
			} else if (!frontendConfig) {
				if (fieldName.includes('status') || fieldName.includes('state')) {
					category = 'compliance';
				} else if (
					fieldName.includes('title') ||
					fieldName.includes('name') ||
					fieldName.includes('description')
				) {
					category = 'core';
				} else if (fieldName.includes('note') || fieldName.includes('comment')) {
					category = 'notes';
				}
			}

			// Special handling for the control ID field
			const isControlIdField = fieldName === controlIdFieldNameClean;

			const fieldDef: Record<string, unknown> = {
				type: metadata.type,
				ui_type: uiType,
				is_array: false,
				max_length: metadata.maxLength,
				usage_count: usageCount,
				usage_percentage: usagePercentage,
				required: isControlIdField ? true : (frontendConfig?.required ?? usagePercentage > 95), // Control ID is always required
				visible: frontendConfig?.tab !== 'hidden',
				show_in_table: isControlIdField ? true : metadata.maxLength <= 100 && usagePercentage > 30, // Always show control ID in table
				editable: isControlIdField ? false : true, // Control ID is not editable
				display_order: isControlIdField ? 1 : (frontendConfig?.displayOrder ?? displayOrder++), // Control ID is always first
				category: isControlIdField ? 'core' : category, // Control ID is always core
				tab: isControlIdField
					? 'overview'
					: justificationFields.includes(fieldName)
						? 'mappings' // Mark justification fields for mappings tab
						: frontendConfig?.tab || undefined // Use frontend config or default
			};

			// Only add options for select fields
			if (uiType === 'select') {
				fieldDef.options = Array.from(metadata.uniqueValues).sort();
			}

			// Add original name if different from field name
			if (frontendConfig?.originalName || metadata.originalName) {
				fieldDef.original_name = frontendConfig?.originalName || metadata.originalName;
			}

			fields[fieldName] = fieldDef;
		});

		const fieldSchema = {
			fields: fields,
			total_controls: controls.length,
			analyzed_at: new Date().toISOString()
		};

		const controlSetData = {
			name: controlSetName,
			description: controlSetDescription,
			version: '1.0.0',
			control_id_field: controlIdFieldNameClean, // Add this to indicate which field is the control ID
			controlCount: controls.length,
			families: uniqueFamilies,
			fieldSchema: fieldSchema
		};

		writeFileSync(join(baseDir, 'lula.yaml'), yaml.dump(controlSetData));

		// Create controls directory and write individual control files
		const controlsDir = join(baseDir, 'controls');
		const mappingsDir = join(baseDir, 'mappings');

		// Track which fields are used for justification to avoid duplicating them in control files
		const justificationFieldNames = justificationFields;

		families.forEach((familyControls, family) => {
			// Create family directories for both controls and mappings
			const familyDir = join(controlsDir, family);
			const familyMappingsDir = join(mappingsDir, family);

			if (!existsSync(familyDir)) {
				mkdirSync(familyDir, { recursive: true });
			}

			if (!existsSync(familyMappingsDir)) {
				mkdirSync(familyMappingsDir, { recursive: true });
			}

			familyControls.forEach((control) => {
				// Use the control ID field value for the filename
				const controlId = control[controlIdFieldNameClean];

				if (!controlId) {
					console.error('Missing control ID for control:', control);
					return; // Skip this control
				}

				// Ensure the control ID is a string and limit filename length
				const controlIdStr = String(controlId).slice(0, 50); // Limit to 50 chars for safety
				const fileName = `${controlIdStr.replace(/[^a-zA-Z0-9-]/g, '_')}.yaml`;
				const filePath = join(familyDir, fileName);

				// Create mapping file path
				const mappingFileName = `${controlIdStr.replace(/[^a-zA-Z0-9-]/g, '_')}-mappings.yaml`;
				const mappingFilePath = join(familyMappingsDir, mappingFileName);

				// Filter control to only include fields that are in the field schema (not excluded)
				const filteredControl: SpreadsheetRow = {};

				// Prepare mapping data with empty justification
				const mappingData: MappingData = {
					control_id: controlIdStr,
					justification: '',
					uuid: crypto.randomUUID()
				};

				// Collect justification content from all specified fields
				const justificationContents: string[] = [];

				// Always include family in control file
				if (control.family !== undefined) {
					filteredControl.family = control.family;
				}

				// Include fields that are in the frontend schema or in the fields metadata
				Object.keys(control).forEach((fieldName) => {
					// Skip family as it's already added
					if (fieldName === 'family') return;

					// Check if this field is in the justification fields list
					if (
						justificationFields.includes(fieldName) &&
						control[fieldName] !== undefined &&
						control[fieldName] !== null
					) {
						// Add to justification contents
						justificationContents.push(control[fieldName]);
						// Also keep the field in the control file
						filteredControl[fieldName] = control[fieldName];
					}

					// Check if field is in the frontend schema (meaning it was assigned to a tab)
					const isInFrontendSchema = frontendFieldSchema?.some((f) => f.fieldName === fieldName);

					// Check if field is in the fields metadata (core fields)
					const isInFieldsMetadata = fields.hasOwnProperty(fieldName);

					// Include the field if it's either in frontend schema or fields metadata
					if (isInFrontendSchema || isInFieldsMetadata) {
						filteredControl[fieldName] = control[fieldName];
					}
				});

				// Write control file
				writeFileSync(filePath, yaml.dump(filteredControl));

				// Combine all justification contents with line breaks
				if (justificationContents.length > 0) {
					mappingData.justification = justificationContents.join('\n\n');
				}

				// Write mapping file if it has justification content
				if (mappingData.justification && mappingData.justification.trim() !== '') {
					// Format as an array with a single mapping entry
					const mappingArray = [mappingData];
					writeFileSync(mappingFilePath, yaml.dump(mappingArray));
				}
			});
		});

		res.json({
			success: true,
			controlCount: controls.length,
			families: Array.from(families.keys()),
			outputDir: folderName // Return just the folder name, not full path
		});
	} catch (error) {
		console.error('Error processing spreadsheet:', error);
		res.status(500).json({ error: 'Failed to process spreadsheet' });
	}
});

// Helper functions
function applyNamingConvention(fieldName: string, convention: string): string {
	if (!fieldName) return fieldName;

	const cleanedName = fieldName.trim();

	switch (convention) {
		case 'camelCase':
			return toCamelCase(cleanedName);
		case 'snake_case':
			return toSnakeCase(cleanedName);
		case 'kebab-case':
			return toKebabCase(cleanedName);
		case 'lowercase':
			return cleanedName.replace(/\W+/g, '').toLowerCase();
		case 'original':
			return cleanedName;
		default:
			return toCamelCase(cleanedName);
	}
}

function toCamelCase(str: string): string {
	return str
		.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
			return index === 0 ? word.toLowerCase() : word.toUpperCase();
		})
		.replace(/\s+/g, '');
}

function toSnakeCase(str: string): string {
	return str
		.replace(/\W+/g, ' ')
		.split(/ |\s/)
		.map((word) => word.toLowerCase())
		.join('_');
}

function toKebabCase(str: string): string {
	return str
		.replace(/\W+/g, ' ')
		.split(/ |\s/)
		.map((word) => word.toLowerCase())
		.join('-');
}

function detectValueType(value: unknown): 'string' | 'number' | 'boolean' | 'date' {
	if (typeof value === 'boolean') return 'boolean';
	if (typeof value === 'number') return 'number';

	if (typeof value === 'string') {
		// Check for boolean strings
		const lowerValue = value.toLowerCase().trim();
		if (
			lowerValue === 'true' ||
			lowerValue === 'false' ||
			lowerValue === 'yes' ||
			lowerValue === 'no' ||
			lowerValue === 'y' ||
			lowerValue === 'n'
		) {
			return 'boolean';
		}

		// Check for numbers
		if (!isNaN(Number(value)) && value.trim() !== '') {
			return 'number';
		}

		// Check for dates (basic patterns)
		const datePatterns = [
			/^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
			/^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
			/^\d{1,2}\/\d{1,2}\/\d{2,4}$/ // M/D/YY or MM/DD/YYYY
		];

		if (datePatterns.some((pattern) => pattern.test(value))) {
			return 'date';
		}
	}

	return 'string';
}

// Parse CSV content into rows using the csv-parse library
function parseCSV(content: string): any[][] {
	try {
		// Parse CSV with robust handling of edge cases
		const records = parseCSVSync(content, {
			// Don't treat first row as headers - we'll handle that ourselves
			columns: false,
			// Skip empty lines
			skip_empty_lines: true,
			// Handle different line endings
			relax_column_count: true,
			// Trim whitespace from fields
			trim: true,
			// Handle quoted fields properly
			quote: '"',
			// Standard escape character
			escape: '"',
			// Auto-detect delimiter (usually comma)
			delimiter: ','
		});

		return records;
	} catch (error) {
		console.error('CSV parsing error:', error);
		// Fallback to simple split if csv-parse fails
		return content.split(/\r?\n/).map((line) => line.split(','));
	}
}

function extractFamilyFromControlId(controlId: string): string {
	if (!controlId) return 'UNKNOWN';

	// Trim any whitespace
	controlId = controlId.trim();

	// Try to extract family from control ID patterns like AC-1, AU-2, AC.1, etc.
	const match = controlId.match(/^([A-Za-z]+)[-._ ]?\d/);
	if (match) {
		return match[1].toUpperCase();
	}

	// If no pattern matches, check if it starts with letters
	const letterMatch = controlId.match(/^([A-Za-z]+)/);
	if (letterMatch) {
		return letterMatch[1].toUpperCase();
	}

	// Last resort: use first two characters
	return controlId.substring(0, 2).toUpperCase();
}

// Export controls to various formats
router.get('/export-controls', async (req, res) => {
	try {
		const format = (req.query.format as string) || 'csv';
		const state = getServerState();
		const fileStore = state.fileStore;

		if (!fileStore) {
			return res.status(500).json({ error: 'No control set loaded' });
		}

		// Load all controls and mappings
		const controls = await fileStore.loadAllControls();
		const mappings = await fileStore.loadMappings();

		// Load metadata from lula.yaml file
		let metadata: any = {};
		try {
			const metadataPath = join(state.CONTROL_SET_DIR, 'lula.yaml');
			if (existsSync(metadataPath)) {
				const metadataContent = readFileSync(metadataPath, 'utf8');
				metadata = yaml.load(metadataContent) as any;
			}
		} catch (err) {
			debug('Could not load metadata:', err);
		}

		if (!controls || controls.length === 0) {
			return res.status(404).json({ error: 'No controls found' });
		}

		// Combine controls with their mappings
		const controlsWithMappings = controls.map((control) => {
			// Use the control_id_field value or fallback to 'id' for mapping lookups
			const controlIdField = metadata?.control_id_field || 'id';
			const controlId = control[controlIdField] || control.id;
			const controlMappings = mappings.filter((m) => m.control_id === controlId);
			return {
				...control,
				mappings_count: controlMappings.length,
				mappings: controlMappings.map((m) => ({
					uuid: m.uuid,
					status: m.status,
					description: m.justification || ''
				}))
			};
		});

		debug(`Exporting ${controlsWithMappings.length} controls as ${format}`);

		switch (format.toLowerCase()) {
			case 'csv':
				return exportAsCSV(controlsWithMappings, metadata, res);
			case 'excel':
			case 'xlsx':
				return await exportAsExcel(controlsWithMappings, metadata, res);
			case 'json':
				return exportAsJSON(controlsWithMappings, metadata, res);
			default:
				return res.status(400).json({ error: `Unsupported format: ${format}` });
		}
	} catch (error: any) {
		console.error('Export error:', error);
		res.status(500).json({ error: error.message });
	}
});

// Export as CSV
function exportAsCSV(controls: any[], metadata: any, res: express.Response) {
	// Get field schema to use original names
	const fieldSchema = metadata?.fieldSchema?.fields || {};
	const controlIdField = metadata?.control_id_field || 'id';

	// Get all unique field names from controls
	const allFields = new Set<string>();
	controls.forEach((control) => {
		Object.keys(control).forEach((key) => allFields.add(key));
	});

	// Build field list with display names
	const fieldMapping: Array<{ fieldName: string; displayName: string }> = [];

	// Handle the control ID field first (might be 'control-acronym' or 'ap-acronym' etc)
	if (allFields.has(controlIdField)) {
		const idSchema = fieldSchema[controlIdField];
		fieldMapping.push({
			fieldName: controlIdField,
			displayName: idSchema?.original_name || 'Control ID'
		});
		allFields.delete(controlIdField); // Remove so we don't add it twice
	} else if (allFields.has('id')) {
		// Fallback to 'id' field if control_id_field not found
		fieldMapping.push({
			fieldName: 'id',
			displayName: 'Control ID'
		});
		allFields.delete('id');
	}

	// Add family field second if it exists
	if (allFields.has('family')) {
		const familySchema = fieldSchema['family'];
		fieldMapping.push({
			fieldName: 'family',
			displayName: familySchema?.original_name || 'Family'
		});
		allFields.delete('family');
	}

	// Add remaining fields using their original names from schema
	Array.from(allFields)
		.filter((field) => field !== 'mappings' && field !== 'mappings_count') // Skip our added fields for now
		.sort()
		.forEach((field) => {
			const schema = fieldSchema[field];
			// Use original_name if available, otherwise clean up the field name
			const displayName =
				schema?.original_name || field.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
			fieldMapping.push({ fieldName: field, displayName });
		});

	// Add mappings at the end
	if (allFields.has('mappings_count')) {
		fieldMapping.push({ fieldName: 'mappings_count', displayName: 'Mappings Count' });
	}
	if (allFields.has('mappings')) {
		fieldMapping.push({ fieldName: 'mappings', displayName: 'Mappings' });
	}

	// Create CSV header with display names
	const csvRows = [];
	csvRows.push(fieldMapping.map((field) => `"${field.displayName}"`).join(','));

	// Add control rows
	controls.forEach((control) => {
		const row = fieldMapping.map(({ fieldName }) => {
			const value = control[fieldName];
			if (value === undefined || value === null) return '""';

			// Special handling for mappings
			if (fieldName === 'mappings' && Array.isArray(value)) {
				// Format mappings as a readable string
				const mappingsStr = value
					.map(
						(m: any) =>
							`${m.status}: ${m.description.substring(0, 50)}${m.description.length > 50 ? '...' : ''}`
					)
					.join('; ');
				return `"${mappingsStr.replace(/"/g, '""')}"`;
			}

			if (Array.isArray(value)) return `"${value.join('; ').replace(/"/g, '""')}"`;
			if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
			return `"${String(value).replace(/"/g, '""')}"`;
		});
		csvRows.push(row.join(','));
	});

	const csvContent = csvRows.join('\n');
	const fileName = `${metadata?.name || 'controls'}_export_${Date.now()}.csv`;

	res.setHeader('Content-Type', 'text/csv');
	res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
	res.send(csvContent);
}

// Export as Excel
async function exportAsExcel(controls: any[], metadata: any, res: express.Response) {
	// Get field schema to use original names
	const fieldSchema = metadata?.fieldSchema?.fields || {};
	const controlIdField = metadata?.control_id_field || 'id';

	// Prepare data for Excel with original field names
	const worksheetData = controls.map((control) => {
		// Create a new object with original field names
		const exportControl: any = {};

		// Process control ID field first
		if (control[controlIdField]) {
			const idSchema = fieldSchema[controlIdField];
			const idDisplayName = idSchema?.original_name || 'Control ID';
			exportControl[idDisplayName] = control[controlIdField];
		} else if (control.id) {
			exportControl['Control ID'] = control.id;
		}

		// Process family field
		if (control.family) {
			const familySchema = fieldSchema['family'];
			const familyDisplayName = familySchema?.original_name || 'Family';
			exportControl[familyDisplayName] = control.family;
		}

		// Process all other fields
		Object.keys(control).forEach((key) => {
			// Skip if already processed or is our added field
			if (key === controlIdField || key === 'id' || key === 'family') return;

			const schema = fieldSchema[key];
			const displayName =
				schema?.original_name ||
				(key === 'mappings_count'
					? 'Mappings Count'
					: key === 'mappings'
						? 'Mappings'
						: key.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()));
			const value = control[key];

			// Special handling for mappings
			if (key === 'mappings' && Array.isArray(value)) {
				exportControl[displayName] = value
					.map(
						(m: any) =>
							`${m.status}: ${m.description.substring(0, 100)}${m.description.length > 100 ? '...' : ''}`
					)
					.join('\n');
			} else if (Array.isArray(value)) {
				exportControl[displayName] = value.join('; ');
			} else if (typeof value === 'object' && value !== null) {
				exportControl[displayName] = JSON.stringify(value);
			} else {
				exportControl[displayName] = value;
			}
		});
		return exportControl;
	});

	// Create workbook and worksheet with ExcelJS
	const wb = new ExcelJS.Workbook();
	const ws = wb.addWorksheet('Controls');

	// Add headers and configure columns
	const headers = Object.keys(worksheetData[0] || {});
	ws.columns = headers.map((header) => ({
		header: header,
		key: header,
		width: Math.min(
			Math.max(
				header.length,
				...worksheetData.map((row: any) => String(row[header] || '').length)
			) + 2,
			50
		) // Auto-size with max width of 50
	}));

	// Add data rows
	worksheetData.forEach((row: any) => {
		ws.addRow(row);
	});

	// Style the header row
	ws.getRow(1).font = { bold: true };
	ws.getRow(1).fill = {
		type: 'pattern',
		pattern: 'solid',
		fgColor: { argb: 'FFE0E0E0' }
	};

	// Create metadata sheet if available
	if (metadata) {
		const metaSheet = wb.addWorksheet('Metadata');
		const cleanMetadata = { ...metadata };
		delete cleanMetadata.fieldSchema; // Remove large schema object

		// Add metadata as key-value pairs
		metaSheet.columns = [
			{ header: 'Property', key: 'property', width: 30 },
			{ header: 'Value', key: 'value', width: 50 }
		];
		Object.entries(cleanMetadata).forEach(([key, value]) => {
			metaSheet.addRow({ property: key, value: String(value) });
		});
	}

	// Generate Excel buffer
	const buffer = await wb.xlsx.writeBuffer();
	const fileName = `${metadata?.name || 'controls'}_export_${Date.now()}.xlsx`;

	res.setHeader(
		'Content-Type',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	);
	res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
	res.send(buffer);
}

// Export as JSON
function exportAsJSON(controls: any[], metadata: any, res: express.Response) {
	const exportData = {
		metadata: metadata || {},
		controlCount: controls.length,
		exportedAt: new Date().toISOString(),
		controls: controls
	};

	const fileName = `${metadata?.name || 'controls'}_export_${Date.now()}.json`;

	res.setHeader('Content-Type', 'application/json');
	res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
	res.json(exportData);
}

// Parse Excel/CSV file for preview (used by frontend)
router.post('/parse-excel', upload.single('file'), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ error: 'No file uploaded' });
		}

		const fileName = req.file.originalname || '';
		const isCSV = fileName.toLowerCase().endsWith('.csv');
		let sheets: string[] = [];
		let rows: any[][] = [];

		if (isCSV) {
			// Parse CSV file
			const csvContent = req.file.buffer.toString('utf-8');
			rows = parseCSV(csvContent);
			sheets = ['Sheet1']; // CSV files only have one "sheet"
		} else {
			// Parse Excel file with ExcelJS
			const workbook = new ExcelJS.Workbook();
			// Convert multer buffer to Node.js Buffer
			const buffer = Buffer.from(req.file.buffer);
			await workbook.xlsx.load(buffer as any);

			// Get all sheet names
			sheets = workbook.worksheets.map((ws) => ws.name);

			// Parse first sheet by default
			const worksheet = workbook.worksheets[0];
			if (!worksheet) {
				return res.status(400).json({ error: 'No worksheet found in file' });
			}

			// Get data from the worksheet
			worksheet.eachRow({ includeEmpty: false }, (row: any, _rowNumber: number) => {
				const rowData: any[] = [];
				row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
					rowData[colNumber - 1] = cell.value;
				});
				rows.push(rowData);
			});
		}

		// Find potential header rows (first 5 non-empty rows)
		const headerCandidates = rows.slice(0, 5).map((row, index) => ({
			row: index + 1,
			preview:
				row
					.slice(0, 4)
					.filter((v) => v != null)
					.join(', ') + (row.length > 4 ? ', ...' : '')
		}));

		res.json({
			sheets,
			selectedSheet: sheets[0],
			rowPreviews: headerCandidates,
			totalRows: rows.length,
			sampleData: rows.slice(0, 10) // First 10 rows for preview
		});
	} catch (error) {
		console.error('Error parsing Excel file:', error);
		res.status(500).json({ error: 'Failed to parse Excel file' });
	}
});

// Get data from specific sheet
router.post('/parse-excel-sheet', upload.single('file'), async (req, res) => {
	try {
		const { sheetName, headerRow } = req.body;

		if (!req.file) {
			return res.status(400).json({ error: 'No file uploaded' });
		}

		const fileName = req.file.originalname || '';
		const isCSV = fileName.toLowerCase().endsWith('.csv');
		let rows: any[][] = [];

		if (isCSV) {
			// Parse CSV file
			const csvContent = req.file.buffer.toString('utf-8');
			rows = parseCSV(csvContent);
		} else {
			// Parse Excel file with ExcelJS
			const workbook = new ExcelJS.Workbook();
			// Convert multer buffer to Node.js Buffer
			const buffer = Buffer.from(req.file.buffer);
			await workbook.xlsx.load(buffer as any);

			// Get specific sheet
			const worksheet = workbook.getWorksheet(sheetName);
			if (!worksheet) {
				return res.status(400).json({ error: `Sheet "${sheetName}" not found` });
			}

			// Get data from the worksheet
			worksheet.eachRow({ includeEmpty: false }, (row: any, _rowNumber: number) => {
				const rowData: any[] = [];
				row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
					rowData[colNumber - 1] = cell.value;
				});
				rows.push(rowData);
			});
		}

		const headerRowIndex = parseInt(headerRow) - 1;
		const headers = rows[headerRowIndex] || [];
		const fields = headers.filter((h: any) => h && typeof h === 'string');

		// Get sample data
		const sampleData = rows.slice(headerRowIndex + 1, headerRowIndex + 4).map((row) => {
			const obj: any = {};
			headers.forEach((header: string, index: number) => {
				if (header) {
					obj[header] = row[index];
				}
			});
			return obj;
		});

		res.json({
			fields,
			sampleData,
			controlCount: rows.length - headerRowIndex - 1
		});
	} catch (error) {
		console.error('Error parsing Excel sheet:', error);
		res.status(500).json({ error: 'Failed to parse Excel sheet' });
	}
});

export default router;
