import { promises as fs } from 'fs';
import path from 'path';
import * as YAML from 'yaml';
import type { ControlSet, ControlSetInfo } from './types';

export class ControlSetStore {
  private examplesDir: string;
  private cachedControlSets: ControlSet[] | null = null;
  private defaultControlSetId: string | null = null;

  constructor(baseDir: string) {
    // Look for examples directory, or fall back to baseDir itself
    this.examplesDir = path.join(baseDir, '../examples');
  }

  async loadControlSets(): Promise<ControlSet[]> {
    if (this.cachedControlSets) {
      return this.cachedControlSets;
    }

    try {
      // Check if examples directory exists
      try {
        await fs.access(this.examplesDir);
      } catch {
        return [];
      }
      
      // Scan for control set directories
      const entries = await fs.readdir(this.examplesDir, { withFileTypes: true });
      const controlSetDirs = entries.filter(entry => entry.isDirectory());
      
      const controlSets: ControlSet[] = [];
      for (const dir of controlSetDirs) {
        try {
          const controlSetFile = path.join(this.examplesDir, dir.name, 'control-set.yaml');
          const content = await fs.readFile(controlSetFile, 'utf8');
          const controlSet = YAML.parse(content) as ControlSet;
          
          // Set the path for this control set
          controlSet.path = path.join(this.examplesDir, dir.name);
          
          // Derive families from controls directory structure
          const controlsDir = path.join(this.examplesDir, dir.name, 'controls');
          try {
            const familyEntries = await fs.readdir(controlsDir, { withFileTypes: true });
            controlSet.families = familyEntries
              .filter(entry => entry.isDirectory())
              .map(entry => entry.name)
              .sort();
          } catch {
            controlSet.families = [];
          }
          
          controlSets.push(controlSet);
        } catch (error) {
          console.error(`Error loading control set ${dir.name}:`, error);
        }
      }
      
      this.cachedControlSets = controlSets;
      
      // Set default to first one if none specified
      if (controlSets.length > 0 && !this.defaultControlSetId) {
        this.defaultControlSetId = controlSets[0].id;
      }
      
      return controlSets;
    } catch (error) {
      console.error('Error loading control sets:', error);
      return [];
    }
  }

  async getControlSetInfo(): Promise<ControlSetInfo> {
    const availableSets = await this.loadControlSets();
    
    let currentSet = availableSets[0];
    if (this.defaultControlSetId) {
      const defaultSet = availableSets.find(set => set.id === this.defaultControlSetId);
      if (defaultSet) {
        currentSet = defaultSet;
      }
    }

    return {
      currentSet,
      availableSets
    };
  }

  async saveControlSet(controlSet: ControlSet): Promise<void> {
    const controlSetDir = path.join(this.examplesDir, controlSet.id);
    await fs.mkdir(controlSetDir, { recursive: true });
    
    // Create controls directory
    await fs.mkdir(path.join(controlSetDir, 'controls'), { recursive: true });
    
    controlSet.lastModified = new Date().toISOString();
    
    // Save control-set.yaml (without path and families fields)
    const { path: _, families: __, ...controlSetToSave } = controlSet;
    const yamlContent = YAML.stringify(controlSetToSave, { indent: 2 });
    await fs.writeFile(path.join(controlSetDir, 'control-set.yaml'), yamlContent, 'utf8');
    
    // Create empty mappings.yaml if it doesn't exist
    const mappingsFile = path.join(controlSetDir, 'mappings.yaml');
    try {
      await fs.access(mappingsFile);
    } catch {
      await fs.writeFile(mappingsFile, 'mappings: []\n', 'utf8');
    }
    
    // Update cache
    if (this.cachedControlSets) {
      const existingIndex = this.cachedControlSets.findIndex(set => set.id === controlSet.id);
      if (existingIndex >= 0) {
        this.cachedControlSets[existingIndex] = controlSet;
      } else {
        this.cachedControlSets.push(controlSet);
      }
    }
  }

  async deleteControlSet(controlSetId: string): Promise<void> {
    const controlSetDir = path.join(this.examplesDir, controlSetId);
    
    try {
      // Remove entire directory
      await fs.rm(controlSetDir, { recursive: true, force: true });
      
      // Update cache
      if (this.cachedControlSets) {
        this.cachedControlSets = this.cachedControlSets.filter(set => set.id !== controlSetId);
      }
      
      // Update default if necessary
      if (this.defaultControlSetId === controlSetId) {
        const remainingSets = await this.loadControlSets();
        if (remainingSets.length > 0) {
          this.defaultControlSetId = remainingSets[0].id;
        } else {
          this.defaultControlSetId = null;
        }
      }
    } catch (error) {
      throw new Error(`Failed to delete control set ${controlSetId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async setDefaultControlSet(controlSetId: string): Promise<void> {
    const controlSets = await this.loadControlSets();
    const exists = controlSets.some(set => set.id === controlSetId);
    
    if (!exists) {
      throw new Error(`Control set with ID ${controlSetId} does not exist`);
    }

    this.defaultControlSetId = controlSetId;
    // Note: Default control set is kept in memory only
  }

  // No longer need to save default to file - just keep in memory

  invalidateCache(): void {
    this.cachedControlSets = null;
  }
}