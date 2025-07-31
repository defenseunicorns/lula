#!/usr/bin/env node

import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { program } from 'commander';
import open from 'open';
import cors from 'cors';
import { debounce } from 'lodash-es';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CLI setup
program
  .option('--dir <directory>', 'Compliance directory path', './compliance')
  .option('--port <port>', 'Server port', '3000')
  .parse();

const options = program.opts();
const COMPLIANCE_DIR = options.dir;
const PORT = parseInt(options.port);

// Ensure compliance directory exists
if (!existsSync(COMPLIANCE_DIR)) {
  mkdirSync(COMPLIANCE_DIR, { recursive: true });
}

// In-memory data stores
const controls = new Map(); // id -> control object
const mappings = new Map(); // uuid -> mapping object
const controlsByFamily = new Map(); // family -> Set of control ids
const mappingsByFamily = new Map(); // family -> Set of mapping uuids
const mappingsByControl = new Map(); // control_id -> Set of mapping uuids

// Debounced save functions per family
const debouncedSaves = new Map();

function getDebouncedSave(key, type) {
  const saveKey = `${key}-${type}`;
  if (!debouncedSaves.has(saveKey)) {
    debouncedSaves.set(saveKey, debounce(() => {
      saveAllToYAML();
    }, 1000));
  }
  return debouncedSaves.get(saveKey);
}

function saveAllToYAML() {
  try {
    // Save all controls
    const allControls = Array.from(controls.values());
    if (allControls.length > 0) {
      const yamlContent = YAML.stringify({ controls: allControls });
      writeFileSync(join(COMPLIANCE_DIR, 'controls.yaml'), yamlContent);
      console.log(`Saved ${allControls.length} controls`);
    }
    
    // Save all mappings
    const allMappings = Array.from(mappings.values());
    if (allMappings.length > 0) {
      const yamlContent = YAML.stringify({ mappings: allMappings });
      writeFileSync(join(COMPLIANCE_DIR, 'mappings.yaml'), yamlContent);
      console.log(`Saved ${allMappings.length} mappings`);
    }
  } catch (error) {
    console.error('Error saving to YAML:', error);
  }
}

function addToIndexes(control) {
  const family = control['control-acronym'].split('-')[0];
  
  // Add to family index
  if (!controlsByFamily.has(family)) {
    controlsByFamily.set(family, new Set());
  }
  controlsByFamily.get(family).add(control.id);
}

function addMappingToIndexes(mapping) {
  const family = mapping.control_id.split('-')[0];
  
  // Add to family index
  if (!mappingsByFamily.has(family)) {
    mappingsByFamily.set(family, new Set());
  }
  mappingsByFamily.get(family).add(mapping.uuid);
  
  // Add to control index
  if (!mappingsByControl.has(mapping.control_id)) {
    mappingsByControl.set(mapping.control_id, new Set());
  }
  mappingsByControl.get(mapping.control_id).add(mapping.uuid);
}

function loadYAMLFiles() {
  console.log('Loading YAML files into memory...');
  
  // Load controls
  const controlsFile = join(COMPLIANCE_DIR, 'controls.yaml');
  if (existsSync(controlsFile)) {
    try {
      const controlsData = YAML.parse(readFileSync(controlsFile, 'utf8'));
      if (controlsData.controls) {
        for (const control of controlsData.controls) {
          controls.set(control.id, control);
          addToIndexes(control);
        }
        console.log(`Loaded ${controlsData.controls.length} controls`);
      }
    } catch (error) {
      console.error('Error loading controls.yaml:', error);
    }
  }
  
  // Load mappings
  const mappingsFile = join(COMPLIANCE_DIR, 'mappings.yaml');
  if (existsSync(mappingsFile)) {
    try {
      const mappingsData = YAML.parse(readFileSync(mappingsFile, 'utf8'));
      if (mappingsData.mappings) {
        for (const mapping of mappingsData.mappings) {
          mappings.set(mapping.uuid, mapping);
          addMappingToIndexes(mapping);
        }
        console.log(`Loaded ${mappingsData.mappings.length} mappings`);
      }
    } catch (error) {
      console.error('Error loading mappings.yaml:', error);
    }
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
    const allControls = Array.from(controls.values()).sort((a, b) => a.id.localeCompare(b.id));
    const allMappings = Array.from(mappings.values()).sort((a, b) => a.control_id.localeCompare(b.control_id));
    
    res.json({ controls: allControls, mappings: allMappings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/controls', (req, res) => {
  try {
    const allControls = Array.from(controls.values()).sort((a, b) => a.id.localeCompare(b.id));
    res.json(allControls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/controls/:id', (req, res) => {
  try {
    const control = controls.get(req.params.id);
    if (!control) {
      return res.status(404).json({ error: 'Control not found' });
    }
    res.json(control);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/controls/:id', (req, res) => {
  try {
    const control = req.body;
    const family = control['control-acronym'].split('-')[0];
    
    // Update in-memory store immediately
    controls.set(control.id, control);
    addToIndexes(control);
    
    // Trigger debounced YAML save
    getDebouncedSave('all', 'controls')();
    
    res.json(control);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/controls/:id', (req, res) => {
  try {
    const control = controls.get(req.params.id);
    if (!control) {
      return res.status(404).json({ error: 'Control not found' });
    }
    
    const family = control['control-acronym'].split('-')[0];
    
    // Remove from stores
    controls.delete(req.params.id);
    controlsByFamily.get(family)?.delete(req.params.id);
    
    // Trigger debounced YAML save
    getDebouncedSave('all', 'controls')();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mappings', (req, res) => {
  try {
    const allMappings = Array.from(mappings.values()).sort((a, b) => a.control_id.localeCompare(b.control_id));
    res.json(allMappings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mappings/:uuid', (req, res) => {
  try {
    const mapping = mappings.get(req.params.uuid);
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }
    res.json(mapping);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mappings', (req, res) => {
  try {
    const mapping = {
      ...req.body,
      uuid: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    
    // Update in-memory stores
    mappings.set(mapping.uuid, mapping);
    addMappingToIndexes(mapping);
    
    // Trigger debounced YAML save
    getDebouncedSave('all', 'mappings')();
    
    res.json(mapping);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/mappings/:uuid', (req, res) => {
  try {
    const mapping = req.body;
    
    // Update in-memory stores
    mappings.set(mapping.uuid, mapping);
    addMappingToIndexes(mapping);
    
    // Trigger debounced YAML save
    getDebouncedSave('all', 'mappings')();
    
    res.json(mapping);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/mappings/:uuid', (req, res) => {
  try {
    const mapping = mappings.get(req.params.uuid);
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }
    
    const family = mapping.control_id.split('-')[0];
    
    // Remove from stores
    mappings.delete(req.params.uuid);
    mappingsByFamily.get(family)?.delete(req.params.uuid);
    mappingsByControl.get(mapping.control_id)?.delete(req.params.uuid);
    
    // Trigger debounced YAML save
    getDebouncedSave('all', 'mappings')();
    
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
    
    const searchTerm = q.toLowerCase();
    
    const matchingControls = Array.from(controls.values()).filter(control => 
      JSON.stringify(control).toLowerCase().includes(searchTerm)
    ).sort((a, b) => a.id.localeCompare(b.id));
    
    const matchingMappings = Array.from(mappings.values()).filter(mapping => 
      JSON.stringify(mapping).toLowerCase().includes(searchTerm)
    ).sort((a, b) => a.control_id.localeCompare(b.control_id));
    
    res.json({ controls: matchingControls, mappings: matchingMappings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const controlCount = controls.size;
    const mappingCount = mappings.size;
    const families = Array.from(controlsByFamily.keys()).sort();
    
    res.json({
      controls: controlCount,
      mappings: mappingCount,
      families: families.length,
      familyList: families
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Initialize and start server
loadYAMLFiles();

app.listen(PORT, () => {
  console.log(`Compliance Manager running on http://localhost:${PORT}`);
  console.log(`Compliance directory: ${COMPLIANCE_DIR}`);
  
  // Auto-open browser
  open(`http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nSaving any pending changes...');
  // Force save all debounced changes
  for (const [key, debouncedFn] of debouncedSaves) {
    debouncedFn.flush();
  }
  console.log('Shutdown complete.');
  process.exit(0);
});