import express from 'express';
import multer from 'multer';
import { glob } from 'glob';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, relative } from 'path';
import * as XLSX from 'xlsx';
import * as yaml from 'yaml';
import { getServerState } from './serverState';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Switch to a different control set directory
router.post('/switch-control-set', async (req, res) => {
  try {
    const { path } = req.body;
    
    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const state = getServerState();
    const baseDir = state.CONTROL_SET_DIR || process.cwd();
    
    // First check if path is absolute or relative
    let newDir = path;
    if (!path.startsWith('/')) {
      // Relative path - join with base directory
      newDir = join(baseDir, path);
    }
    
    // Check if control-set.yaml exists in the new directory
    const controlSetPath = join(newDir, 'control-set.yaml');
    if (!existsSync(controlSetPath)) {
      return res.status(404).json({ error: 'No control-set.yaml found in specified directory: ' + newDir });
    }
    
    console.log(`Switching control set from ${state.CONTROL_SET_DIR} to ${newDir}`);
    
    // Clear old state completely
    state.controlsCache.clear();
    state.mappingsCache.clear();
    state.controlsByFamily.clear();
    state.mappingsByFamily.clear();
    state.mappingsByControl.clear();
    
    // Re-initialize server state with new directory (absolute path)
    const { initializeServerState, loadAllData } = await import('./serverState');
    initializeServerState(newDir);
    await loadAllData();
    
    res.json({ 
      success: true, 
      message: 'Switched to control set',
      path: newDir 
    });
  } catch (error) {
    console.error('Error switching control set:', error);
    res.status(500).json({ error: 'Failed to switch control set: ' + (error as Error).message });
  }
});

// Scan for existing control-set.yaml files
router.get('/scan-control-sets', async (req, res) => {
  try {
    const state = getServerState();
    const baseDir = state.CONTROL_SET_DIR || process.cwd();
    
    // Search for control-set.yaml files in subdirectories
    const pattern = '**/control-set.yaml';
    const files = await glob(pattern, {
      cwd: baseDir,
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
      maxDepth: 5
    });
    
    const controlSets = files.map(file => {
      const fullPath = join(baseDir, file);
      try {
        const content = readFileSync(fullPath, 'utf8');
        const data = yaml.parse(content);
        return {
          path: relative(baseDir, dirname(fullPath)),
          name: data.name || 'Unnamed Control Set',
          description: data.description || '',
          controlCount: data.controlCount || 0,
          file: file
        };
      } catch (err) {
        return {
          path: relative(baseDir, dirname(fullPath)),
          name: 'Invalid control-set.yaml',
          description: 'Could not parse file',
          controlCount: 0,
          file: file
        };
      }
    });
    
    res.json({ controlSets });
  } catch (error) {
    console.error('Error scanning for control sets:', error);
    res.status(500).json({ error: 'Failed to scan for control sets' });
  }
});

// Process spreadsheet upload
router.post('/import-spreadsheet', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { 
      controlIdField = 'Control ID',
      startRow = '1',
      outputDir = './imported-controls'
    } = req.body;
    
    console.log('Import parameters received:', {
      controlIdField,
      startRow,
      outputDir
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
    console.log('After conversion, looking for control ID field:', applyNamingConvention(controlIdField, namingConvention));
    
    // Process rows into controls
    const controls: any[] = [];
    const families = new Map<string, any[]>();
    
    // Field metadata collection
    const fieldMetadata = new Map<string, {
      originalName: string;
      cleanName: string;
      type: 'string' | 'number' | 'boolean' | 'date' | 'mixed';
      maxLength: number;
      hasMultipleLines: boolean;
      uniqueValues: Set<any>;
      emptyCount: number;
      totalCount: number;
      examples: any[];
    }>();
    
    // Initialize field metadata for each header
    headers.forEach(header => {
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
      const row = rawData[i] as any[];
      if (!row || row.length === 0) continue;
      
      const control: any = {};
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
            if (normalizedValue !== '') {  // Don't count empty strings as unique values
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
        console.log(`Looking for control ID in field: ${controlIdFieldName}, available fields:`, Object.keys(control));
        const controlId = control[controlIdFieldName];
        if (!controlId) {
          console.log(`No control ID found in field ${controlIdFieldName}, skipping row`);
          continue;
        }
        
        // Always extract family from control ID, ignore family field
        const family = extractFamilyFromControlId(controlId);
        
        control.id = controlId;
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
    const state = getServerState();
    const baseDir = join(state.CONTROL_SET_DIR || process.cwd(), outputDir);
    
    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }
    
    // Create control-set.yaml with enhanced field metadata
    const uniqueFamilies = Array.from(families.keys()).filter(f => f && f !== 'UNKNOWN');
    console.log(`Found ${uniqueFamilies.length} unique families:`, uniqueFamilies);
    console.log(`Total controls: ${controls.length}`);
    
    // Build field schema from metadata in the expected format
    // Check if frontend provided field schema with tab assignments
    let frontendFieldSchema: any = null;
    if (req.body.fieldSchema) {
      try {
        frontendFieldSchema = JSON.parse(req.body.fieldSchema);
      } catch (e) {
        console.error('Failed to parse fieldSchema:', e);
      }
    }
    
    const fields: any = {};
    let displayOrder = 1;
    
    // Always include core fields first
    fields['id'] = {
      type: 'string',
      ui_type: 'short_text',
      is_array: false,
      max_length: 50,
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
    
    // Family should be a select since it has limited values
    const familyOptions = Array.from(families.keys()).filter(f => f && f !== 'UNKNOWN').sort();
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
      // Skip id and family as they're already added
      if (fieldName === 'id' || fieldName === 'family' || 
          fieldName === applyNamingConvention(controlIdField, namingConvention)) {
        return;
      }
      
      const usageCount = metadata.totalCount - metadata.emptyCount;
      const usagePercentage = metadata.totalCount > 0 
        ? Math.round((usageCount / metadata.totalCount) * 100)
        : 0;
      
      // Determine UI type based on metadata
      let uiType = 'short_text';
      
      // Check for dropdown fields - few unique values with short text and sufficient usage
      const nonEmptyCount = metadata.totalCount - metadata.emptyCount;
      const isDropdownCandidate = 
        metadata.uniqueValues.size > 0 && 
        metadata.uniqueValues.size <= 20 && // Max 20 unique values for dropdown
        nonEmptyCount >= 10 && // At least 10 non-empty values to be meaningful
        metadata.maxLength <= 100 && // Reasonably short values only
        (metadata.uniqueValues.size / nonEmptyCount) <= 0.3; // Less than 30% unique ratio among non-empty values
      
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
      const frontendConfig = frontendFieldSchema?.find((f: any) => f.fieldName === fieldName);
      
      // Determine category based on field name and usage or use frontend config
      let category = frontendConfig?.category || 'custom';
      if (!frontendConfig) {
        if (fieldName.includes('status') || fieldName.includes('state')) {
          category = 'compliance';
        } else if (fieldName.includes('title') || fieldName.includes('name') || fieldName.includes('description')) {
          category = 'core';
        } else if (fieldName.includes('note') || fieldName.includes('comment')) {
          category = 'notes';
        }
      }
      
      const fieldDef: any = {
        type: metadata.type,
        ui_type: uiType,
        is_array: false,
        max_length: metadata.maxLength,
        usage_count: usageCount,
        usage_percentage: usagePercentage,
        required: frontendConfig?.required ?? (usagePercentage > 95), // Use frontend config or default heuristic
        visible: frontendConfig?.tab !== 'hidden',
        show_in_table: metadata.maxLength <= 100 && usagePercentage > 30, // Show in table if short and commonly filled
        editable: true,
        display_order: frontendConfig?.displayOrder ?? displayOrder++,
        category: category,
        tab: frontendConfig?.tab || undefined  // Include tab assignment from frontend
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
      name: req.body.controlSetName || 'Imported Control Set',
      description: req.body.controlSetDescription || 'Imported from spreadsheet',
      version: '1.0.0',
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
      
      familyControls.forEach(control => {
        const fileName = `${control.id.replace(/[^a-zA-Z0-9-]/g, '_')}.yaml`;
        const filePath = join(familyDir, fileName);
        writeFileSync(filePath, yaml.stringify(control));
      });
    });
    
    res.json({
      success: true,
      controlCount: controls.length,
      families: Array.from(families.keys()),
      outputDir: relative(process.cwd(), baseDir)
    });
    
  } catch (error) {
    console.error('Error processing spreadsheet:', error);
    res.status(500).json({ error: 'Failed to process spreadsheet' });
  }
});

// Get available fields from a spreadsheet (for preview)
router.post('/preview-spreadsheet', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { startRow = '1' } = req.body;
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
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
    const sampleData = [];
    
    // Get up to 5 sample rows
    for (let i = startRowIndex + 1; i < Math.min(startRowIndex + 6, rawData.length); i++) {
      const row = rawData[i] as any[];
      if (!row || row.length === 0) continue;
      
      const sample: any = {};
      headers.forEach((header, index) => {
        if (header && row[index] !== undefined) {
          sample[header] = row[index];
        }
      });
      
      if (Object.keys(sample).length > 0) {
        sampleData.push(sample);
      }
    }
    
    res.json({
      sheets: workbook.SheetNames,
      fields: headers.filter(h => h),
      rowCount: rawData.length - startRowIndex - 1,
      sampleData
    });
    
  } catch (error) {
    console.error('Error previewing spreadsheet:', error);
    res.status(500).json({ error: 'Failed to preview spreadsheet' });
  }
});

// Helper functions
function applyNamingConvention(fieldName: string, convention: string): string {
  if (!fieldName) return fieldName;
  
  let cleanedName = fieldName.trim();
  
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
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\s+/g, '');
}

function toSnakeCase(str: string): string {
  return str.replace(/\W+/g, ' ')
    .split(/ |\s/)
    .map(word => word.toLowerCase())
    .join('_');
}

function toKebabCase(str: string): string {
  return str.replace(/\W+/g, ' ')
    .split(/ |\s/)
    .map(word => word.toLowerCase())
    .join('-');
}

function detectValueType(value: any): 'string' | 'number' | 'boolean' | 'date' {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  
  if (typeof value === 'string') {
    // Check for boolean strings
    const lowerValue = value.toLowerCase().trim();
    if (lowerValue === 'true' || lowerValue === 'false' || 
        lowerValue === 'yes' || lowerValue === 'no' ||
        lowerValue === 'y' || lowerValue === 'n') {
      return 'boolean';
    }
    
    // Check for numbers
    if (!isNaN(Number(value)) && value.trim() !== '') {
      return 'number';
    }
    
    // Check for dates (basic patterns)
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,  // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/,  // MM/DD/YYYY
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/  // M/D/YY or MM/DD/YYYY
    ];
    
    if (datePatterns.some(pattern => pattern.test(value))) {
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