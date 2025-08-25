// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { promises as fsPromises } from 'fs';
import { join } from 'path';
import * as YAML from 'yaml';
import { getServerState, addControlToIndexes, addMappingToIndexes, saveMappingsToFile } from './serverState.js';
import type { Control } from './types/index.js';

// Transform control for UI compatibility (map definition to statement)
function transformControlForUI(control: Control): Control {
  const transformed = { ...control };
  
  // Map definition field to statement for UI compatibility
  if (transformed.definition && !('statement' as any in transformed)) {
    (transformed as any).statement = transformed.definition;
  }
  
  return transformed;
}


const router = Router();

// Basic data endpoints
router.get('/data/all', (req: Request, res: Response) => {
  try {
    const state = getServerState();
    const allControls = Array.from(state.controlsCache.values())
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(transformControlForUI);
    const allMappings = Array.from(state.mappingsCache.values()).sort((a, b) => a.control_id.localeCompare(b.control_id));
    
    res.json({ controls: allControls, mappings: allMappings });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Controls endpoints
router.get('/controls', (req: Request, res: Response) => {
  try {
    const state = getServerState();
    const allControls = Array.from(state.controlsCache.values())
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(transformControlForUI);
    res.json(allControls);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/controls/:id', async (req: Request, res: Response) => {
  try {
    const state = getServerState();
    let control = state.controlsCache.get(req.params.id);
    if (!control) {
      // Try loading from file store in case cache is stale
      const loadedControl = await state.fileStore.loadControl(req.params.id);
      if (loadedControl) {
        control = loadedControl;
        state.controlsCache.set(control.id, control);
        addControlToIndexes(control);
      }
    }
    
    if (!control) {
      return res.status(404).json({ error: 'Control not found' });
    }
    res.json(transformControlForUI(control));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/controls/:id', async (req: Request, res: Response) => {
  try {
    const state = getServerState();
    const control = req.body;
    
    // Save to file store
    await state.fileStore.saveControl(control);
    
    // Update in-memory cache
    state.controlsCache.set(control.id, control);
    addControlToIndexes(control);
    
    res.json(control);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.delete('/controls/:id', async (req: Request, res: Response) => {
  try {
    const state = getServerState();
    const control = state.controlsCache.get(req.params.id);
    if (!control) {
      return res.status(404).json({ error: 'Control not found' });
    }
    
    const family = control.family;
    
    // Delete from file store
    await state.fileStore.deleteControl(req.params.id);
    
    // Remove from caches
    state.controlsCache.delete(req.params.id);
    state.controlsByFamily.get(family)?.delete(req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Mappings endpoints
router.get('/mappings', (req: Request, res: Response) => {
  try {
    const state = getServerState();
    const allMappings = Array.from(state.mappingsCache.values()).sort((a, b) => a.control_id.localeCompare(b.control_id));
    res.json(allMappings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/mappings/:uuid', (req: Request, res: Response) => {
  try {
    const state = getServerState();
    const mapping = state.mappingsCache.get(req.params.uuid);
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }
    res.json(mapping);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/mappings', async (req: Request, res: Response) => {
  try {
    const mapping = {
      ...req.body,
      uuid: crypto.randomUUID()
    };
    
    const state = getServerState();
    
    // Update in-memory stores
    state.mappingsCache.set(mapping.uuid, mapping);
    addMappingToIndexes(mapping);
    
    // Save mappings to file
    await saveMappingsToFile();
    
    res.json(mapping);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/mappings/:uuid', async (req: Request, res: Response) => {
  try {
    const mapping = req.body;
    const state = getServerState();
    
    // Update in-memory stores
    state.mappingsCache.set(mapping.uuid, mapping);
    addMappingToIndexes(mapping);
    
    // Save mappings to file
    await saveMappingsToFile();
    
    res.json(mapping);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.delete('/mappings/:uuid', async (req: Request, res: Response) => {
  try {
    const state = getServerState();
    const mapping = state.mappingsCache.get(req.params.uuid);
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }
    
    const family = mapping.control_id.split('-')[0];
    
    // Remove from stores
    state.mappingsCache.delete(req.params.uuid);
    state.mappingsByFamily.get(family)?.delete(req.params.uuid);
    state.mappingsByControl.get(mapping.control_id)?.delete(req.params.uuid);
    
    // Save mappings to file
    await saveMappingsToFile();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Search endpoint
router.get('/search', (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json({ controls: [], mappings: [] });
    }
    
    const searchTerm = q.toString().toLowerCase();
    const state = getServerState();
    
    const matchingControls = Array.from(state.controlsCache.values()).filter(control => 
      JSON.stringify(control).toLowerCase().includes(searchTerm)
    ).sort((a, b) => a.id.localeCompare(b.id));
    
    const matchingMappings = Array.from(state.mappingsCache.values()).filter(mapping => 
      JSON.stringify(mapping).toLowerCase().includes(searchTerm)
    ).sort((a, b) => a.control_id.localeCompare(b.control_id));
    
    res.json({ controls: matchingControls, mappings: matchingMappings });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Stats endpoint
router.get('/stats', (req: Request, res: Response) => {
  try {
    const state = getServerState();
    const controlCount = state.controlsCache.size;
    const mappingCount = state.mappingsCache.size;
    const families = Array.from(state.controlsByFamily.keys()).sort();
    const fileStats = state.fileStore.getStats();
    
    res.json({
      controls: controlCount,
      mappings: mappingCount,
      families: families.length,
      familyList: families,
      fileStore: fileStats
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Control set endpoint
router.get('/control-set', async (req: Request, res: Response) => {
  try {
    const state = getServerState();
    const controlSetFile = join(state.CONTROL_SET_DIR, 'control-set.yaml');
    
    try {
      const content = await fsPromises.readFile(controlSetFile, 'utf8');
      const controlSet = YAML.parse(content);
      
      // Add derived families from directory structure
      const families = Array.from(state.controlsByFamily.keys()).sort();
      
      res.json({
        ...controlSet,
        families,
        path: state.CONTROL_SET_DIR
      });
    } catch (error) {
      console.error('Error reading control-set.yaml:', error);
      // If no control-set.yaml file, return basic info with minimal field_schema
      const families = Array.from(state.controlsByFamily.keys()).sort();
      res.json({
        id: 'unknown',
        name: 'Unknown Control Set',
        version: 'Unknown',
        description: 'Control set metadata not found',
        families,
        path: state.CONTROL_SET_DIR,
        field_schema: {
          fields: {
            id: {
              type: 'string',
              ui_type: 'short_text',
              is_array: false,
              max_length: 20,
              usage_count: 0,
              usage_percentage: 100,
              required: true,
              visible: true,
              show_in_table: true,
              editable: false,
              display_order: 1,
              category: 'core',
              examples: []
            },
            title: {
              type: 'string',
              ui_type: 'medium_text',
              is_array: false,
              max_length: 150,
              usage_count: 0,
              usage_percentage: 100,
              required: true,
              visible: true,
              show_in_table: true,
              editable: true,
              display_order: 2,
              category: 'core',
              examples: []
            },
            definition: {
              type: 'string',
              ui_type: 'textarea',
              is_array: false,
              max_length: 2000,
              usage_count: 0,
              usage_percentage: 100,
              required: false,
              visible: true,
              show_in_table: false,
              editable: true,
              display_order: 3,
              category: 'content',
              examples: []
            },
            implementation_status: {
              type: 'string',
              ui_type: 'select',
              is_array: false,
              max_length: 30,
              usage_count: 0,
              usage_percentage: 100,
              required: true,
              visible: true,
              show_in_table: true,
              editable: true,
              display_order: 4,
              category: 'core',
              options: [
                'not_implemented',
                'planned', 
                'partially_implemented',
                'implemented',
                'alternative_implementation',
                'not_applicable'
              ],
              examples: ['not_implemented']
            }
          },
          total_controls: 0,
          analyzed_at: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    console.error('Error in /api/control-set:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
