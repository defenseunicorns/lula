#!/usr/bin/env node

import { program } from 'commander';
import cors from 'cors';
import crypto from 'crypto';
import express from 'express';
import * as fs from 'fs';
import { existsSync, promises as fsPromises, mkdirSync, writeFileSync } from 'fs';
import * as git from 'isomorphic-git';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import * as YAML from 'yaml';
import { getAdapter } from './src/lib/adapters/index.js';
import { GitHistoryUtil } from './src/lib/gitHistory.js';
import { FileStore } from './src/lib/index.js';
import type { Control, ControlCompleteData, ControlWithHistory, GitCommit, GitFileHistory, Mapping, UnifiedHistory } from './src/lib/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Server state - will be initialized by startServer
let serverState: {
  CONTROL_SET_DIR: string;
  fileStore: FileStore;
  gitHistory: GitHistoryUtil;
  controlsCache: Map<string, Control>;
  mappingsCache: Map<string, Mapping>;
  controlsByFamily: Map<string, Set<string>>;
  mappingsByFamily: Map<string, Set<string>>;
  mappingsByControl: Map<string, Set<string>>;
} | undefined = undefined;

// CLI setup
program
  .name('cya')
  .description('Compliance Manager - Git-friendly compliance control management')
  .version('1.0.0');

program
  .command('serve')
  .description('Start the web server')
  .option('--dir <directory>', 'Control set directory path', './examples/nist-800-53-rev4')
  .option('--port <port>', 'Server port', '3000')
  .action(async (options) => {
    await startServer(options.dir, parseInt(options.port));
  });



program
  .command('import')
  .description('Import controls from external formats (OSCAL, etc.)')
  .option('--format <format>', 'Source format (oscal-import)', 'oscal-import')
  .option('--file <file>', 'Source file path (required)')
  .option('--dir <directory>', 'Target control set directory path', './examples/nist-800-53-rev4')
  .option('--dry-run', 'Show what would be imported without making changes')
  .option('--overwrite', 'Overwrite existing controls')
  .action(async (options) => {
    await runImport(options);
  });

// For backward compatibility, if no command is specified, run serve
if (process.argv.length === 2 || (!process.argv.includes('serve') && !process.argv.includes('import'))) {
  process.argv.splice(2, 0, 'serve');
}

program.parse();

// Command implementations
async function runImport(options: any) {
  if (!options.file) {
    console.error('❌ Error: --file option is required');
    console.log('Usage: cya import --file <path-to-oscal-catalog.json> [--format oscal-import] [--dir <target-directory>]');
    process.exit(1);
  }

  const sourceFile = options.file;
  const targetDir = options.dir;
  const format = options.format;
  const dryRun = options.dryRun;
  const overwrite = options.overwrite;

  console.log(`\n🚀 Starting import from: ${sourceFile}`);
  console.log(`📁 Target directory: ${targetDir}`);
  console.log(`📋 Format: ${format}`);
  if (dryRun) console.log('🧪 Dry run mode - no files will be changed');
  console.log();

  try {
    // Check if source file exists
    if (!existsSync(sourceFile)) {
      console.error(`❌ Source file not found: ${sourceFile}`);
      process.exit(1);
    }

    // Ensure target directory exists
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Read and parse source file
    console.log('📖 Reading source file...');
    const sourceData = JSON.parse(await fsPromises.readFile(sourceFile, 'utf8'));

    // Get the appropriate adapter
    const adapter = getAdapter(format);
    if (!adapter) {
      console.error(`❌ Unknown format: ${format}`);
      console.log('Available formats:');
      // List available adapters
      const { getAvailableAdapters } = await import('./src/lib/adapters/index.js');
      getAvailableAdapters().forEach(a => {
        console.log(`  - ${a.id}: ${a.name}`);
      });
      process.exit(1);
    }

    // Validate source data
    console.log('🔍 Validating source data...');
    const validation = await adapter.validate(sourceData);
    if (!validation.valid) {
      console.error('❌ Source data validation failed:');
      validation.errors.forEach(error => {
        console.error(`  - ${error.field ? `${error.field}: ` : ''}${error.message}`);
      });
      process.exit(1);
    }

    if (validation.warnings.length > 0) {
      console.log('⚠️  Validation warnings:');
      validation.warnings.forEach(warning => {
        console.log(`  - ${warning.field ? `${warning.field}: ` : ''}${warning.message}`);
      });
    }

    // Import controls
    console.log('🔄 Converting controls...');
    const importResult = await adapter.import(sourceData, {
      preserveIds: true,
      overwrite
    });

    console.log(`✅ Successfully converted ${importResult.controls.length} controls`);

    if (importResult.warnings.length > 0) {
      console.log('\n⚠️  Import warnings:');
      importResult.warnings.forEach(warning => {
        console.log(`  - ${warning.field ? `${warning.field}: ` : ''}${warning.message}`);
      });
    }

    if (!dryRun) {
      // Initialize file store for target directory
      const fileStore = new FileStore({ baseDir: targetDir });

      console.log('💾 Saving controls to individual files...');
      let savedCount = 0;
      let skippedCount = 0;

      for (const control of importResult.controls) {
        try {
          // Check if control already exists
          const existingControl = await fileStore.loadControl(control.id).catch(() => null);
          
          if (existingControl && !overwrite) {
            console.log(`⏭️  Skipping existing control: ${control.id}`);
            skippedCount++;
            continue;
          }

          // Save control
          await fileStore.saveControl(control);
          savedCount++;
          
          if (savedCount % 10 === 0) {
            console.log(`  Saved ${savedCount} controls...`);
          }
        } catch (error) {
          console.error(`❌ Failed to save control ${control.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Save metadata if provided
      if (importResult.metadata) {
        const metadataPath = join(targetDir, '.import-metadata.json');
        writeFileSync(metadataPath, JSON.stringify(importResult.metadata, null, 2), 'utf8');
        console.log(`📄 Import metadata saved to: ${metadataPath}`);
      }

      console.log(`\n✅ Import completed successfully!`);
      console.log(`📊 Summary:`);
      console.log(`  - Controls imported: ${savedCount}`);
      console.log(`  - Controls skipped: ${skippedCount}`);
      console.log(`  - Total processed: ${importResult.controls.length}`);
      
      if (skippedCount > 0) {
        console.log(`\n💡 Use --overwrite to replace existing controls`);
      }
    } else {
      console.log(`\n🧪 Dry run completed - no files were changed`);
      console.log(`📊 Would import ${importResult.controls.length} controls`);
      console.log(`\nSample controls that would be created:`);
      importResult.controls.slice(0, 5).forEach(control => {
        console.log(`  - ${control.id}: ${control['control-acronym']}`);
      });
      if (importResult.controls.length > 5) {
        console.log(`  ... and ${importResult.controls.length - 5} more`);
      }
    }

  } catch (error) {
    console.error('\n❌ Import failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}



async function saveMappingsToFile() {
  if (!serverState) throw new Error('Server not initialized');
  try {
    const allMappings = Array.from(serverState.mappingsCache.values());
    await serverState.fileStore.saveMappings(allMappings);
    console.log(`Saved ${allMappings.length} mappings`);
  } catch (error) {
    console.error('Error saving mappings:', error);
  }
}

function addToIndexes(control: Control) {
  if (!serverState) throw new Error('Server not initialized');
  const family = control['control-acronym'].split('-')[0];
  
  // Add to family index
  if (!serverState.controlsByFamily.has(family)) {
    serverState.controlsByFamily.set(family, new Set());
  }
  serverState.controlsByFamily.get(family)!.add(control.id);
}

function addMappingToIndexes(mapping: Mapping) {
  if (!serverState) throw new Error('Server not initialized');
  const family = mapping.control_id.split('-')[0];
  
  // Add to family index
  if (!serverState.mappingsByFamily.has(family)) {
    serverState.mappingsByFamily.set(family, new Set());
  }
  serverState.mappingsByFamily.get(family)!.add(mapping.uuid);
  
  // Add to control index
  if (!serverState.mappingsByControl.has(mapping.control_id)) {
    serverState.mappingsByControl.set(mapping.control_id, new Set());
  }
  serverState.mappingsByControl.get(mapping.control_id)!.add(mapping.uuid);
}

async function loadAllData() {
  if (!serverState) throw new Error('Server not initialized');
  console.log('Loading data into memory...');
  
  try {
    // Load controls from individual files
    const controls = await serverState.fileStore.loadAllControls();
    for (const control of controls) {
      serverState.controlsCache.set(control.id, control);
      addToIndexes(control);
    }
    console.log(`Loaded ${controls.length} controls from individual files`);
    
    // Load mappings from mappings file
    const mappings = await serverState.fileStore.loadMappings();
    for (const mapping of mappings) {
      serverState.mappingsCache.set(mapping.uuid, mapping);
      addMappingToIndexes(mapping);
    }
    console.log(`Loaded ${mappings.length} mappings`);
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Express app setup
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, 'dist')));

// API Routes
app.get('/api/data/all', (req, res) => {
  try {
    const allControls = Array.from(serverState!.controlsCache.values()).sort((a, b) => a.id.localeCompare(b.id));
    const allMappings = Array.from(serverState!.mappingsCache.values()).sort((a, b) => a.control_id.localeCompare(b.control_id));
    
    res.json({ controls: allControls, mappings: allMappings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/controls', (req, res) => {
  try {
    const allControls = Array.from(serverState!.controlsCache.values()).sort((a, b) => a.id.localeCompare(b.id));
    res.json(allControls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/controls/:id', async (req, res) => {
  try {
    let control = serverState!.controlsCache.get(req.params.id);
    if (!control) {
      // Try loading from file store in case cache is stale
      control = await serverState!.fileStore.loadControl(req.params.id);
      if (control) {
        serverState!.controlsCache.set(control.id, control);
        addToIndexes(control);
      }
    }
    
    if (!control) {
      return res.status(404).json({ error: 'Control not found' });
    }
    res.json(control);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/controls/:id', async (req, res) => {
  try {
    const control = req.body;
    const family = control['control-acronym'].split('-')[0];
    
    // Save to file store
    await serverState!.fileStore.saveControl(control);
    
    // Update in-memory cache
    serverState!.controlsCache.set(control.id, control);
    addToIndexes(control);
    
    res.json(control);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/controls/:id', async (req, res) => {
  try {
    const control = serverState!.controlsCache.get(req.params.id);
    if (!control) {
      return res.status(404).json({ error: 'Control not found' });
    }
    
    const family = control['control-acronym'].split('-')[0];
    
    // Delete from file store
    await serverState!.fileStore.deleteControl(req.params.id);
    
    // Remove from caches
    serverState!.controlsCache.delete(req.params.id);
    serverState!.controlsByFamily.get(family)?.delete(req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mappings', (req, res) => {
  try {
    const allMappings = Array.from(serverState!.mappingsCache.values()).sort((a, b) => a.control_id.localeCompare(b.control_id));
    res.json(allMappings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mappings/:uuid', (req, res) => {
  try {
    const mapping = serverState!.mappingsCache.get(req.params.uuid);
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }
    res.json(mapping);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mappings', async (req, res) => {
  try {
    const mapping = {
      ...req.body,
      uuid: crypto.randomUUID()
    };
    
    // Update in-memory stores
    serverState!.mappingsCache.set(mapping.uuid, mapping);
    addMappingToIndexes(mapping);
    
    // Save mappings to file
    await saveMappingsToFile();
    
    res.json(mapping);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/mappings/:uuid', async (req, res) => {
  try {
    const mapping = req.body;
    
    // Update in-memory stores
    serverState!.mappingsCache.set(mapping.uuid, mapping);
    addMappingToIndexes(mapping);
    
    // Save mappings to file
    await saveMappingsToFile();
    
    res.json(mapping);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/mappings/:uuid', async (req, res) => {
  try {
    const mapping = serverState!.mappingsCache.get(req.params.uuid);
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }
    
    const family = mapping.control_id.split('-')[0];
    
    // Remove from stores
    serverState!.mappingsCache.delete(req.params.uuid);
    serverState!.mappingsByFamily.get(family)?.delete(req.params.uuid);
    serverState!.mappingsByControl.get(mapping.control_id)?.delete(req.params.uuid);
    
    // Save mappings to file
    await saveMappingsToFile();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json({ controls: [], mappings: [] });
    }
    
    const searchTerm = q.toString().toLowerCase();
    
    const matchingControls = Array.from(serverState!.controlsCache.values()).filter(control => 
      JSON.stringify(control).toLowerCase().includes(searchTerm)
    ).sort((a, b) => a.id.localeCompare(b.id));
    
    const matchingMappings = Array.from(serverState!.mappingsCache.values()).filter(mapping => 
      JSON.stringify(mapping).toLowerCase().includes(searchTerm)
    ).sort((a, b) => a.control_id.localeCompare(b.control_id));
    
    res.json({ controls: matchingControls, mappings: matchingMappings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const controlCount = serverState!.controlsCache.size;
    const mappingCount = serverState!.mappingsCache.size;
    const families = Array.from(serverState!.controlsByFamily.keys()).sort();
    const fileStats = serverState!.fileStore.getStats();
    
    res.json({
      controls: controlCount,
      mappings: mappingCount,
      families: families.length,
      familyList: families,
      fileStore: fileStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/control-set', async (req, res) => {
  try {
    const controlSetFile = join(serverState!.CONTROL_SET_DIR, 'control-set.yaml');
    
    try {
      const content = await fsPromises.readFile(controlSetFile, 'utf8');
      const controlSet = YAML.parse(content);
      
      // Add derived families from directory structure
      const families = Array.from(serverState!.controlsByFamily.keys()).sort();
      
      res.json({
        ...controlSet,
        families,
        path: serverState!.CONTROL_SET_DIR
      });
    } catch (error) {
      console.error('Error reading control-set.yaml:', error);
      // If no control-set.yaml file, return basic info
      const families = Array.from(serverState!.controlsByFamily.keys()).sort();
      res.json({
        id: 'unknown',
        name: 'Unknown Control Set',
        version: 'Unknown',
        description: 'Control set metadata not found',
        families,
        path: serverState!.CONTROL_SET_DIR
      });
    }
  } catch (error) {
    console.error('Error in /api/control-set:', error);
    res.status(500).json({ error: error.message });
  }
});

// Git History API endpoints
app.get('/api/controls/:id/history', async (req, res) => {
  try {
    const controlId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 50;
    
    console.log(`Getting git history for control: ${controlId}`);
    
    // Get control to find its file path
    const control = serverState!.controlsCache.get(controlId);
    if (!control) {
      console.log(`Control not found in cache: ${controlId}`);
      return res.status(404).json({ error: 'Control not found' });
    }
    
    // Get control metadata to find the file path
    const metadata = serverState!.fileStore.getControlMetadata(controlId);
    if (!metadata) {
      console.log(`Control metadata not found: ${controlId}`);
      return res.status(404).json({ error: 'Control file not found' });
    }
    
    const family = control['control-acronym'].split('-')[0];
    const filePath = join(serverState!.CONTROL_SET_DIR, 'controls', family, metadata.filename);
    
    console.log(`Looking for git history of file: ${filePath}`);
    
    // Check if file exists
    const { existsSync } = await import('fs');
    if (!existsSync(filePath)) {
      console.log(`File does not exist: ${filePath}`);
      return res.status(404).json({ error: 'Control file does not exist' });
    }
    
    // Get git history
    const history = await serverState!.gitHistory.getFileHistory(filePath, limit);
    
    console.log(`Git history for ${controlId}: ${history.commits.length} commits found`);
    
    res.json(history);
  } catch (error) {
    console.error('Error getting control history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Git history for mapping files by control
app.get('/api/mappings/:controlId/history', async (req, res) => {
  try {
    const controlId = req.params.controlId;
    const limit = parseInt(req.query.limit as string) || 50;
    
    console.log(`Getting git history for mappings control: ${controlId}`);
    
    const family = controlId.split('-')[0];
    const mappingFilePath = join(serverState!.CONTROL_SET_DIR, 'mappings', family, `${controlId}-mappings.yaml`);
    
    // Check if file exists
    const { existsSync } = await import('fs');
    if (!existsSync(mappingFilePath)) {
      console.log(`Mapping file does not exist: ${mappingFilePath}`);
      return res.status(404).json({ error: 'Mapping file does not exist' });
    }
    
    // Get git history
    const history = await serverState!.gitHistory.getFileHistory(mappingFilePath, limit);
    
    console.log(`Git history for ${controlId} mappings: ${history.commits.length} commits found`);
    
    res.json(history);
  } catch (error) {
    console.error('Error getting mapping history:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/controls/:id/with-history', async (req, res) => {
  try {
    const controlId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Get control
    let control = serverState!.controlsCache.get(controlId);
    if (!control) {
      // Try loading from file store in case cache is stale
      control = await serverState!.fileStore.loadControl(controlId);
      if (control) {
        serverState!.controlsCache.set(control.id, control);
        addToIndexes(control);
      }
    }
    
    if (!control) {
      return res.status(404).json({ error: 'Control not found' });
    }
    
    // Get control metadata to find the file path
    const metadata = serverState!.fileStore.getControlMetadata(controlId);
    let history: GitFileHistory | undefined;
    
    if (metadata) {
      const family = control['control-acronym'].split('-')[0];
      const filePath = join(serverState!.CONTROL_SET_DIR, 'controls', family, metadata.filename);
      history = await serverState!.gitHistory.getFileHistory(filePath, limit);
    }
    
    const controlWithHistory: ControlWithHistory = {
      ...control,
      history
    };
    
    res.json(controlWithHistory);
  } catch (error) {
    console.error('Error getting control with history:', error);
    res.status(500).json({ error: error.message });
  }
});

// NEW: Unified endpoint that loads control, mappings, and unified history
app.get('/api/controls/:id/complete', async (req, res) => {
  try {
    const controlId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 50;
    
    console.log(`Getting complete data for control: ${controlId}`);
    
    // Get control
    let control = serverState!.controlsCache.get(controlId);
    if (!control) {
      control = await serverState!.fileStore.loadControl(controlId);
      if (control) {
        serverState!.controlsCache.set(control.id, control);
        addToIndexes(control);
      }
    }
    
    if (!control) {
      return res.status(404).json({ error: 'Control not found' });
    }
    
    const family = control['control-acronym'].split('-')[0];
    
    // Get mappings for this control
    const mappings = Array.from(serverState!.mappingsCache.values())
      .filter(mapping => mapping.control_id === controlId)
      .sort((a, b) => a.uuid.localeCompare(b.uuid));
    
    console.log(`Complete data for ${controlId}: ${mappings.length} mappings, starting history lookup`);
    
    // Get all commits for both control and mapping files, including pending changes
    const allCommits: GitCommit[] = [];
    let controlCommits = 0;
    let mappingCommits = 0;
    
    const { existsSync, statSync } = await import('fs');
    // Find the actual git root, don't assume it's the control set directory
    let gitRoot: string;
    try {
      gitRoot = await git.findRoot({ fs: fs, filepath: serverState!.CONTROL_SET_DIR });
    } catch (error) {
      console.log('Could not find git root, falling back to control set directory');
      gitRoot = serverState!.CONTROL_SET_DIR;
    }
    
    // Get file paths
    const metadata = serverState!.fileStore.getControlMetadata(controlId);
    const controlFilePath = metadata ? join(serverState!.CONTROL_SET_DIR, 'controls', family, metadata.filename) : undefined;
    const mappingFilePath = join(serverState!.CONTROL_SET_DIR, 'mappings', family, `${controlId}-mappings.yaml`);
    
    // Get control file history
    if (controlFilePath && existsSync(controlFilePath)) {
      try {
        const controlHistory = await serverState!.gitHistory.getFileHistory(controlFilePath, limit);
        controlHistory.commits.forEach(commit => {
          allCommits.push({ ...commit, type: 'control', fileType: 'Control File' } as GitCommit & { type: string; fileType: string });
        });
        controlCommits = controlHistory.commits.length;
        console.log(`Found ${controlCommits} commits for control file`);
      } catch (error) {
        console.log(`No git history for control file: ${controlFilePath}`);
      }
    }
    
    // Get mapping file history
    if (existsSync(mappingFilePath)) {
      try {
        const mappingHistory = await serverState!.gitHistory.getFileHistory(mappingFilePath, limit);
        mappingHistory.commits.forEach(commit => {
          allCommits.push({ ...commit, type: 'mapping', fileType: 'Mappings' } as GitCommit & { type: string; fileType: string });
        });
        mappingCommits = mappingHistory.commits.length;
        console.log(`Found ${mappingCommits} commits for mapping file`);
      } catch (error) {
        console.log(`No git history for mapping file: ${mappingFilePath}`);
      }
    }
    
    // Check for pending changes
    const filesToCheck: { path: string; type: 'control' | 'mapping' }[] = [];
    if (controlFilePath) filesToCheck.push({ path: controlFilePath, type: 'control' });
    if (existsSync(mappingFilePath)) filesToCheck.push({ path: mappingFilePath, type: 'mapping' });
    
    for (const { path, type } of filesToCheck) {
      try {
        const relativePath = relative(gitRoot, path);
        const status = await git.status({ fs: fs, dir: gitRoot, filepath: relativePath });
        
        // isomorphic-git returns different status values: unmodified, *modified, *deleted, *added, etc.
        console.log(`Git status for ${relativePath}: ${status}`);
        if (status !== 'unmodified' && status !== 'absent') {
          const currentTime = new Date().toISOString();
          const displayType = type === 'mapping' ? 'Mappings' : 'Control File';
          
          // Generate diff for pending changes
          let diff = '';
          let yamlDiff = null;
          try {
            // Get current working directory content
            const currentContent = await fsPromises.readFile(path, 'utf8');
            
            // Get HEAD content for comparison
            let headContent = '';
            try {
              const headOid = await git.resolveRef({ fs: fs, dir: gitRoot, ref: 'HEAD' });
              const { blob } = await git.readBlob({ fs: fs, dir: gitRoot, oid: headOid, filepath: relativePath });
              headContent = new TextDecoder().decode(blob);
            } catch (error) {
              // File might be new (not in HEAD), use empty content
              headContent = '';
            }
            
            // Generate basic diff
            console.log(`Content comparison for ${relativePath}: current length=${currentContent.length}, head length=${headContent.length}, equal=${currentContent === headContent}`);
            if (currentContent !== headContent) {
              const lines1 = headContent.split('\n');
              const lines2 = currentContent.split('\n');
              
              // Simple diff generation - show actual line differences
              const diffLines = [];
              diffLines.push(`--- a/${relativePath}`);
              diffLines.push(`+++ b/${relativePath}`);
              
              // Basic line-by-line comparison
              const maxLines = Math.max(lines1.length, lines2.length);
              let hasChanges = false;
              
              for (let i = 0; i < maxLines; i++) {
                const oldLine = lines1[i] || '';
                const newLine = lines2[i] || '';
                
                if (oldLine !== newLine) {
                  if (!hasChanges) {
                    diffLines.push(`@@ -${i+1},${lines1.length} +${i+1},${lines2.length} @@`);
                    hasChanges = true;
                  }
                  
                  if (oldLine && lines1[i] !== undefined) {
                    diffLines.push(`-${oldLine}`);
                  }
                  if (newLine && lines2[i] !== undefined) {
                    diffLines.push(`+${newLine}`);
                  }
                }
              }
              
              // For YAML files, try to parse and generate structured diff
              if (relativePath.endsWith('.yaml') || relativePath.endsWith('.yml')) {
                try {
                  const oldData = headContent ? YAML.parse(headContent) : {};
                  const newData = YAML.parse(currentContent);
                  
                  // Find changed fields
                  const changedFields = [];
                  
                  // Simple field comparison
                  function findChanges(oldObj, newObj, path = '') {
                    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
                    
                    for (const key of allKeys) {
                      if (key.startsWith('_')) continue; // Skip metadata
                      
                      const oldVal = oldObj?.[key];
                      const newVal = newObj?.[key];
                      const fullPath = path ? `${path}.${key}` : key;
                      
                      if (oldVal !== newVal) {
                        if (oldVal === undefined) {
                          changedFields.push({
                            type: 'Added',
                            field: key,
                            oldValue: undefined,
                            newValue: newVal
                          });
                        } else if (newVal === undefined) {
                          changedFields.push({
                            type: 'Removed',
                            field: key,
                            oldValue: oldVal,
                            newValue: undefined
                          });
                        } else {
                          changedFields.push({
                            type: 'Modified',
                            field: key,
                            oldValue: oldVal,
                            newValue: newVal
                          });
                        }
                      }
                    }
                  }
                  
                  findChanges(oldData, newData);
                  
                  if (changedFields.length > 0) {
                    // Count change types for concise summary
                    const added = changedFields.filter(f => f.type === 'Added').length;
                    const removed = changedFields.filter(f => f.type === 'Removed').length;
                    const modified = changedFields.filter(f => f.type === 'Modified').length;
                    
                    // Create concise summary like "2 added, 1 modified"
                    const summaryParts = [];
                    if (added > 0) summaryParts.push(`${added} added`);
                    if (modified > 0) summaryParts.push(`${modified} modified`);
                    if (removed > 0) summaryParts.push(`${removed} removed`);
                    
                    yamlDiff = {
                      hasChanges: true,
                      summary: summaryParts.join(', '),
                      changes: changedFields.map(change => ({
                        type: change.type.toLowerCase(),
                        field: change.field,
                        path: change.field,
                        description: `${change.type} ${change.field}`,
                        oldValue: change.oldValue,
                        newValue: change.newValue
                      }))
                    };
                  }
                  console.log(`YAML diff generated for ${relativePath}:`, yamlDiff ? `${yamlDiff.changes.length} changes` : 'no yaml diff');
                } catch (yamlError) {
                  console.log(`YAML parsing error for ${relativePath}:`, yamlError);
                  // If YAML parsing fails, fall back to text diff
                }
              }
              
              // Generate simple text diff
              diff = diffLines.join('\n');
            }
          } catch (error) {
            console.log(`Could not generate diff for ${relativePath}:`, error);
            diff = 'Unable to generate diff for pending changes';
          }
          
          allCommits.push({
            hash: 'pending',
            shortHash: 'pending',
            author: 'You',
            authorEmail: '',
            date: currentTime,
            message: `Uncommitted modifications`,
            changes: { insertions: 0, deletions: 0, files: 1 },
            type,
            fileType: displayType,
            isPending: true,
            diff: diff || undefined,
            yamlDiff: yamlDiff || undefined
          } as GitCommit & { type: string; fileType: string; isPending: boolean });
          
          console.log(`Added pending commit for ${relativePath} (${displayType}):`, yamlDiff ? `${yamlDiff.changes.length} yaml changes` : 'text diff only');
          
          if (type === 'control') controlCommits++;
          else mappingCommits++;
          
          console.log(`Found pending changes in ${type} file: ${relativePath}`);
        }
      } catch (error) {
        console.log(`Could not check git status for ${path}:`, error);
      }
    }
    
    // Sort by date (pending first, then newest first)
    allCommits.sort((a: any, b: any) => {
      if (a.isPending && !b.isPending) return -1;
      if (!a.isPending && b.isPending) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    
    const unifiedHistory: UnifiedHistory = {
      commits: allCommits,
      totalCommits: allCommits.length,
      controlCommits,
      mappingCommits,
      controlFilePath: controlFilePath ? controlFilePath.replace(serverState!.CONTROL_SET_DIR + '/', '') : undefined,
      mappingFilePath: mappingFilePath ? mappingFilePath.replace(serverState!.CONTROL_SET_DIR + '/', '') : undefined
    };
    
    const completeData: ControlCompleteData = {
      control,
      mappings,
      unifiedHistory
    };
    
    console.log(`Complete data for ${controlId}: ${mappings.length} mappings, ${unifiedHistory.totalCommits} total commits (${controlCommits} control, ${mappingCommits} mapping)`);
    
    res.json(completeData);
  } catch (error) {
    console.error('Error getting complete control data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/git/stats', async (req, res) => {
  try {
    const stats = await serverState!.gitHistory.getRepositoryStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting git stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get file content at specific commit
app.get('/api/git/file/:commitHash/:type/:family?', async (req, res) => {
  try {
    const { commitHash, type, family } = req.params;
    
    let filePath: string;
    
    if (type === 'control') {
      // For control files, we need the control ID from query params
      const controlId = req.query.controlId as string;
      if (!controlId) {
        return res.status(400).json({ error: 'Control ID required for control file' });
      }
      
      const metadata = serverState!.fileStore.getControlMetadata(controlId);
      if (!metadata) {
        return res.status(404).json({ error: 'Control metadata not found' });
      }
      
      const controlFamily = controlId.split('-')[0];
      filePath = join('controls', controlFamily, metadata.filename);
    } else if (type === 'mapping') {
      if (!controlId) {
        return res.status(400).json({ error: 'Control ID required for mapping file' });
      }
      const controlFamily = controlId.split('-')[0];
      filePath = join('mappings', controlFamily, `${controlId}-mappings.yaml`);
    } else {
      return res.status(400).json({ error: 'Invalid file type. Must be "control" or "mapping"' });
    }
    
    console.log(`Getting file content for ${filePath} at commit ${commitHash}`);
    
    // Use git history utility to get file content at specific commit
    const fileContent = await serverState!.gitHistory.getFileContentAtCommit(filePath, commitHash);
    
    res.json({
      filePath,
      commitHash,
      content: fileContent
    });
  } catch (error) {
    console.error('Error getting file content at commit:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Initialize and start server
async function startServer(controlSetDir: string, port: number) {
  const CONTROL_SET_DIR = controlSetDir;
  const PORT = port;
  
  // Ensure control set directory exists
  if (!existsSync(CONTROL_SET_DIR)) {
    mkdirSync(CONTROL_SET_DIR, { recursive: true });
  }

  // Initialize server state
  serverState = {
    CONTROL_SET_DIR,
    fileStore: new FileStore({ baseDir: CONTROL_SET_DIR }),
    gitHistory: new GitHistoryUtil(CONTROL_SET_DIR),
    controlsCache: new Map<string, Control>(),
    mappingsCache: new Map<string, Mapping>(),
    controlsByFamily: new Map<string, Set<string>>(),
    mappingsByFamily: new Map<string, Set<string>>(),
    mappingsByControl: new Map<string, Set<string>>()
  };
  
  await loadAllData();
  
  app.listen(PORT, () => {
    console.log(`Compliance Manager running on http://localhost:${PORT}`);
    console.log(`Control set directory: ${CONTROL_SET_DIR}`);
    console.log(`Using individual control files in: ${CONTROL_SET_DIR}/controls/`);
    
    // Auto-open browser
    // open(`http://localhost:${PORT}`);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nSaving any pending changes...');
  try {
    await saveMappingsToFile();
    console.log('All changes saved.');
  } catch (error) {
    console.error('Error saving changes:', error);
  }
  console.log('Shutdown complete.');
  process.exit(0);
});

// Note: Server startup is now handled by the 'serve' command
