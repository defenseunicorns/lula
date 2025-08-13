#!/usr/bin/env node

import express from 'express';
import { existsSync, mkdirSync, writeFileSync, promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as YAML from 'yaml';
import { program } from 'commander';
import open from 'open';
import cors from 'cors';
import crypto from 'crypto';
import { FileStore } from './src/lib/fileStore.js';
import { MigrationUtility } from './src/lib/migration.js';
import { GitHistoryUtil } from './src/lib/gitHistory.js';
import type { Control, Mapping, GitFileHistory, ControlWithHistory, ControlCompleteData, UnifiedHistory, GitCommit } from './src/lib/types.js';

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
  .command('migrate')
  .description('Migrate from single YAML files to individual control files')
  .option('--dir <directory>', 'Control set directory path', './examples/nist-800-53-rev4')
  .option('--dry-run', 'Show what would be migrated without making changes')
  .option('--backup', 'Create backup before migration', true)
  .option('--no-backup', 'Skip creating backup')
  .option('--overwrite', 'Overwrite existing individual files')
  .option('--report <file>', 'Generate migration report to file')
  .action(async (options) => {
    await runMigration(options);
  });

program
  .command('status')
  .description('Check current migration status')
  .option('--dir <directory>', 'Control set directory path', './examples/nist-800-53-rev4')
  .action(async (options) => {
    await checkStatus(options.dir);
  });

// For backward compatibility, if no command is specified, run serve
if (process.argv.length === 2 || (!process.argv.includes('serve') && !process.argv.includes('migrate') && !process.argv.includes('status'))) {
  process.argv.splice(2, 0, 'serve');
}

program.parse();

// Command implementations
async function runMigration(options: any) {
  const CONTROL_SET_DIR = options.dir;
  
  // Ensure control set directory exists
  if (!existsSync(CONTROL_SET_DIR)) {
    mkdirSync(CONTROL_SET_DIR, { recursive: true });
  }
  
  console.log(`\n🚀 Starting migration for directory: ${CONTROL_SET_DIR}\n`);
  
  const migrationUtil = new MigrationUtility({
    baseDir: CONTROL_SET_DIR,
    backupExisting: options.backup,
    dryRun: options.dryRun,
    overwriteExisting: options.overwrite || false
  });
  
  try {
    // Generate and optionally save report
    if (options.report) {
      console.log('Generating migration report...');
      const report = await migrationUtil.generateReport();
      writeFileSync(options.report, report, 'utf8');
      console.log(`Migration report saved to: ${options.report}`);
      return;
    }
    
    // Run the actual migration
    const result = await migrationUtil.migrate();
    
    if (result.errors.length === 0) {
      console.log('\n✅ Migration completed successfully!');
      if (options.dryRun) {
        console.log('Run without --dry-run to perform the actual migration.');
      }
    } else {
      console.log('\n⚠️  Migration completed with errors.');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

async function checkStatus(dir: string) {
  const CONTROL_SET_DIR = dir;
  
  if (!existsSync(CONTROL_SET_DIR)) {
    console.log(`❌ Directory does not exist: ${CONTROL_SET_DIR}`);
    return;
  }
  
  const migrationUtil = new MigrationUtility({ baseDir: CONTROL_SET_DIR });
  const status = await migrationUtil.checkMigrationStatus();
  
  console.log(`\n📊 Migration Status for: ${CONTROL_SET_DIR}\n`);
  console.log(`Legacy files (controls.yaml): ${status.hasLegacyFiles ? '✅ Found' : '❌ Not found'}`);
  console.log(`Individual files: ${status.hasIndividualFiles ? '✅ Found' : '❌ Not found'}`);
  console.log(`Controls in legacy file: ${status.controlCount}`);
  console.log(`Individual control files: ${status.individualFileCount}`);
  console.log(`Migration needed: ${status.needsMigration ? '⚠️  YES' : '✅ NO'}\n`);
  
  if (status.needsMigration) {
    console.log(`💡 Run \`cya migrate --dir ${CONTROL_SET_DIR}\` to migrate to individual files.`);
  } else if (status.individualFileCount > 0) {
    console.log('✅ Using individual control files. Ready for Git-friendly version control!');
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
    const shortId = await serverState!.fileStore.saveControl(control);
    
    // Update in-memory cache
    serverState!.controlsCache.set(control.id, control);
    addToIndexes(control);
    
    res.json({ ...control, _shortId: shortId });
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
      const content = await fs.readFile(controlSetFile, 'utf8');
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

// Git history for mapping files by family
app.get('/api/mappings/:family/history', async (req, res) => {
  try {
    const family = req.params.family;
    const limit = parseInt(req.query.limit as string) || 50;
    
    console.log(`Getting git history for mappings family: ${family}`);
    
    const mappingFilePath = join(serverState!.CONTROL_SET_DIR, 'mappings', family, `${family}-mappings.yaml`);
    
    // Check if file exists
    const { existsSync } = await import('fs');
    if (!existsSync(mappingFilePath)) {
      console.log(`Mapping file does not exist: ${mappingFilePath}`);
      return res.status(404).json({ error: 'Mapping file does not exist' });
    }
    
    // Get git history
    const history = await serverState!.gitHistory.getFileHistory(mappingFilePath, limit);
    
    console.log(`Git history for ${family} mappings: ${history.commits.length} commits found`);
    
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
    
    const family = control['control-acronym'].split('-')[0];
    
    // Get mappings for this control
    const mappings = Array.from(serverState!.mappingsCache.values())
      .filter(mapping => mapping.control_id === controlId)
      .sort((a, b) => a.uuid.localeCompare(b.uuid));
    
    // Get control file history
    const metadata = serverState!.fileStore.getControlMetadata(controlId);
    let controlHistory: GitFileHistory | undefined;
    let controlFilePath: string | undefined;
    
    if (metadata) {
      controlFilePath = join(serverState!.CONTROL_SET_DIR, 'controls', family, metadata.filename);
      const { existsSync } = await import('fs');
      if (existsSync(controlFilePath)) {
        controlHistory = await serverState!.gitHistory.getFileHistory(controlFilePath, limit);
      }
    }
    
    // Get mapping file history
    const mappingFilePath = join(serverState!.CONTROL_SET_DIR, 'mappings', family, `${family}-mappings.yaml`);
    let mappingHistory: GitFileHistory | undefined;
    
    const { existsSync } = await import('fs');
    if (existsSync(mappingFilePath)) {
      mappingHistory = await serverState!.gitHistory.getFileHistory(mappingFilePath, limit);
    }
    
    // Merge and sort commits chronologically
    const allCommits: GitCommit[] = [];
    let controlCommits = 0;
    let mappingCommits = 0;
    
    // Add control commits with type indicator
    if (controlHistory?.commits) {
      controlHistory.commits.forEach(commit => {
        allCommits.push({
          ...commit,
          type: 'control',
          fileType: 'Control File'
        } as GitCommit & { type: string; fileType: string });
        controlCommits++;
      });
    }
    
    // Add mapping commits with type indicator  
    if (mappingHistory?.commits) {
      mappingHistory.commits.forEach(commit => {
        allCommits.push({
          ...commit,
          type: 'mapping',
          fileType: 'Mappings'
        } as GitCommit & { type: string; fileType: string });
        mappingCommits++;
      });
    }
    
    // Sort by date (newest first)
    allCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
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
      if (!family) {
        return res.status(400).json({ error: 'Family required for mapping file' });
      }
      filePath = join('mappings', family, `${family}-mappings.yaml`);
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
