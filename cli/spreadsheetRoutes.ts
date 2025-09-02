import express from 'express';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import multer from 'multer';
import { dirname, join, relative } from 'path';
import * as XLSX from 'xlsx';
import * as yaml from 'yaml';
import { getServerState } from './serverState';

const router = express.Router();
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Scan for existing control-set.yaml files
// Export the scan function for reuse
export async function scanControlSets() {
	const state = getServerState();
	const baseDir = state.CONTROL_SET_DIR; // Always scan from the root

	// Search for control-set.yaml files in subdirectories
	const pattern = '**/control-set.yaml';
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
				const data = yaml.parse(content);

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
					name: 'Invalid control-set.yaml',
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
		if (!req.file) {
			return res.status(400).json({ error: 'No file uploaded' });
		}

		const {
			controlIdField = 'Control ID',
			startRow = '1',
			controlSetName = 'Imported Control Set',
			controlSetDescription = 'Imported from spreadsheet'
		} = req.body;

		console.log('Import parameters received:', {
			controlIdField,
			startRow,
			controlSetName,
			controlSetDescription
		});

		// Hard-coded values
		const namingConvention = 'kebab-case';
		const skipEmpty = true;
		const skipEmptyRows = true;

		// Parse the spreadsheet
		const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
		const sheetName = workbook.SheetNames[0];
		const sheet = workbook.Sheets[sheetName];

		// Convert to JSON with headers
		const rawData = XLSX.utils.sheet_to_json(sheet, {
			header: 1,
			defval: null,
			blankrows: true
		});

		const startRowIndex = parseInt(startRow) - 1;
		if (rawData.length <= startRowIndex) {
			return res.status(400).json({ error: 'Start row exceeds sheet data' });
		}

		const headers = rawData[startRowIndex] as string[];
		if (!headers || headers.length === 0) {
			return res.status(400).json({ error: 'No headers found at specified row' });
		}

		console.log('Headers found:', headers);
		console.log(
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
				console.log(
					`Looking for control ID in field: ${controlIdFieldName}, available fields:`,
					Object.keys(control)
				);
				const controlId = control[controlIdFieldName];
				if (!controlId) {
					console.log(`No control ID found in field ${controlIdFieldName}, skipping row`);
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

		// Create control-set.yaml with enhanced field metadata
		const uniqueFamilies = Array.from(families.keys()).filter((f) => f && f !== 'UNKNOWN');
		console.log(`Found ${uniqueFamilies.length} unique families:`, uniqueFamilies);
		console.log(`Total controls: ${controls.length}`);

		// Build field schema from metadata in the expected format
		// Check if frontend provided field schema with tab assignments
		let frontendFieldSchema: Array<{
			fieldName: string;
			tab?: string;
			displayTab?: string;
		}> | null = null;
		if (req.body.fieldSchema) {
			try {
				frontendFieldSchema = JSON.parse(req.body.fieldSchema);
			} catch (e) {
				console.error('Failed to parse fieldSchema:', e);
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
			fields['family'].options = familyOptions;
		}

		// Add other fields from metadata
		fieldMetadata.forEach((metadata, fieldName) => {
			// Skip family as it's already added, and skip 'id' if it would duplicate the control ID field
			if (fieldName === 'family' || (fieldName === 'id' && controlIdFieldNameClean !== 'id')) {
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

			// Find frontend config for this field if provided
			const frontendConfig = frontendFieldSchema?.find((f) => f.fieldName === fieldName);

			// Determine category based on field name and usage or use frontend config
			let category = frontendConfig?.category || 'custom';
			if (!frontendConfig) {
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
				tab: isControlIdField ? 'overview' : frontendConfig?.tab || undefined // Control ID is always in overview
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

		writeFileSync(join(baseDir, 'control-set.yaml'), yaml.stringify(controlSetData));

		// Create controls directory and write individual control files
		const controlsDir = join(baseDir, 'controls');

		families.forEach((familyControls, family) => {
			const familyDir = join(controlsDir, family);
			if (!existsSync(familyDir)) {
				mkdirSync(familyDir, { recursive: true });
			}

			familyControls.forEach((control) => {
				// Use the control ID field value for the filename
				const controlId = control[controlIdFieldNameClean];
				const fileName = `${controlId.replace(/[^a-zA-Z0-9-]/g, '_')}.yaml`;
				const filePath = join(familyDir, fileName);
				writeFileSync(filePath, yaml.stringify(control));
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

export default router;
