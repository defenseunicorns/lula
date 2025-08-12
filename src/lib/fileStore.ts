/**
 * File Storage Utilities for Individual Control Files
 * 
 * Manages the file structure: controls/{short_id}.yaml
 * Provides utilities for reading, writing, and managing individual control files.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import YAML from 'yaml';
import { generateShortId, extractIdsFromFilename, extractShortIdFromFilename, getControlFilename, getControlFamily, isValidShortId } from './shortId.js';
import type { Control, Mapping } from './types.js';

export interface ControlMetadata {
  shortId: string;
  controlId: string;
  filename: string;
  lastModified: Date;
  created: Date;
}

export interface FileStoreConfig {
  baseDir: string;
  controlsDir?: string;
  mappingsFile?: string;
}

export class FileStore {
  private baseDir: string;
  private controlsDir: string;
  private mappingsFile: string;
  private controlsCache = new Map<string, Control>();
  private metadataCache = new Map<string, ControlMetadata>();
  private shortIdToControlId = new Map<string, string>();
  private controlIdToShortId = new Map<string, string>();
  constructor(config: FileStoreConfig) {
    this.baseDir = config.baseDir;
    this.controlsDir = config.controlsDir || join(this.baseDir, 'controls');
    this.mappingsFile = config.mappingsFile || join(this.baseDir, 'mappings.yaml');
    
    this.ensureDirectoriesExist();
  }

  private ensureDirectoriesExist(): void {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
    if (!existsSync(this.controlsDir)) {
      mkdirSync(this.controlsDir, { recursive: true });
    }
  }

  private ensureFamilyDirExists(family: string): void {
    const familyDir = join(this.controlsDir, family);
    if (!existsSync(familyDir)) {
      mkdirSync(familyDir, { recursive: true });
    }
  }

  /**
   * Loads all controls from individual files
   */
  async loadAllControls(): Promise<Control[]> {
    this.refreshCache();
    return Array.from(this.controlsCache.values());
  }

  /**
   * Loads a specific control by ID
   */
  async loadControl(controlId: string): Promise<Control | null> {
    const shortId = this.controlIdToShortId.get(controlId);
    if (!shortId) {
      // Try to refresh cache in case file was added externally
      this.refreshCache();
      const refreshedShortId = this.controlIdToShortId.get(controlId);
      if (!refreshedShortId) {
        return null;
      }
      return this.controlsCache.get(controlId) || null;
    }
    
    return this.controlsCache.get(controlId) || null;
  }

  /**
   * Loads a control by its short ID
   */
  async loadControlByShortId(shortId: string): Promise<Control | null> {
    if (!isValidShortId(shortId)) {
      return null;
    }
    
    const controlId = this.shortIdToControlId.get(shortId);
    if (!controlId) {
      this.refreshCache();
      const refreshedControlId = this.shortIdToControlId.get(shortId);
      if (!refreshedControlId) {
        return null;
      }
      return this.controlsCache.get(refreshedControlId) || null;
    }
    
    return this.controlsCache.get(controlId) || null;
  }

  /**
   * Saves or updates a control
   */
  async saveControl(control: Control): Promise<string> {
    let shortId = this.controlIdToShortId.get(control.id);
    
    // Generate new short ID if this is a new control
    if (!shortId) {
      shortId = generateShortId(control.id);
      // Ensure uniqueness by checking if short ID already exists
      while (this.shortIdToControlId.has(shortId)) {
        shortId = generateShortId(control.id, new Date(Date.now() + Math.random() * 1000));
      }
    }
    
    const family = getControlFamily(control.id);
    this.ensureFamilyDirExists(family);
    
    const filename = getControlFilename(control.id, shortId);
    const filepath = join(this.controlsDir, family, filename);
    
    try {
      // Create control file with metadata header
      const controlWithMetadata = {
        _metadata: {
          shortId,
          controlId: control.id,
          family,
          created: this.metadataCache.get(control.id)?.created || new Date(),
          lastModified: new Date()
        },
        ...control
      };
      
      const yamlContent = YAML.stringify(controlWithMetadata, {
        indent: 2,
        lineWidth: 0,
        minContentWidth: 0
      });
      
      writeFileSync(filepath, yamlContent, 'utf8');
      
      // Update caches
      this.controlsCache.set(control.id, control);
      this.shortIdToControlId.set(shortId, control.id);
      this.controlIdToShortId.set(control.id, shortId);
      
      const stats = statSync(filepath);
      this.metadataCache.set(control.id, {
        shortId,
        controlId: control.id,
        filename,
        lastModified: stats.mtime,
        created: this.metadataCache.get(control.id)?.created || stats.birthtime
      });
      
      return shortId;
    } catch (error) {
      throw new Error(`Failed to save control ${control.id}: ${error}`);
    }
  }

  /**
   * Deletes a control file
   */
  async deleteControl(controlId: string): Promise<boolean> {
    const shortId = this.controlIdToShortId.get(controlId);
    if (!shortId) {
      return false;
    }
    
    const filename = getControlFilename(shortId);
    const filepath = join(this.controlsDir, filename);
    
    try {
      if (existsSync(filepath)) {
        // Note: We don't actually delete the file to preserve Git history
        // Instead, we could move it to a deleted folder or add a deleted flag
        // For now, we'll just remove from cache
        this.controlsCache.delete(controlId);
        this.shortIdToControlId.delete(shortId);
        this.controlIdToShortId.delete(controlId);
        this.metadataCache.delete(controlId);
        return true;
      }
      return false;
    } catch (error) {
      throw new Error(`Failed to delete control ${controlId}: ${error}`);
    }
  }

  /**
   * Gets metadata for all controls
   */
  getAllControlMetadata(): ControlMetadata[] {
    this.refreshCache();
    return Array.from(this.metadataCache.values());
  }

  /**
   * Gets metadata for a specific control
   */
  getControlMetadata(controlId: string): ControlMetadata | null {
    return this.metadataCache.get(controlId) || null;
  }

  /**
   * Loads mappings from the mappings file
   */
  async loadMappings(): Promise<Mapping[]> {
    if (!existsSync(this.mappingsFile)) {
      return [];
    }
    
    try {
      const content = readFileSync(this.mappingsFile, 'utf8');
      const data = YAML.parse(content);
      return data.mappings || [];
    } catch (error) {
      console.error('Error loading mappings:', error);
      return [];
    }
  }

  /**
   * Saves mappings to the mappings file
   */
  async saveMappings(mappings: Mapping[]): Promise<void> {
    try {
      const yamlContent = YAML.stringify({ mappings }, {
        indent: 2,
        lineWidth: 0,
        minContentWidth: 0
      });
      writeFileSync(this.mappingsFile, yamlContent, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save mappings: ${error}`);
    }
  }

  /**
   * Refreshes the internal cache by scanning the controls directory
   */
  private refreshCache(): void {
    this.controlsCache.clear();
    this.metadataCache.clear();
    this.shortIdToControlId.clear();
    this.controlIdToShortId.clear();
    
    if (!existsSync(this.controlsDir)) {
      return;
    }
    
    // Scan family directories
    const familyDirs = readdirSync(this.controlsDir, { withFileTypes: true });
    
    for (const familyDir of familyDirs) {
      if (!familyDir.isDirectory()) {
        continue;
      }
      
      const familyPath = join(this.controlsDir, familyDir.name);
      const files = readdirSync(familyPath);
      
      for (const filename of files) {
        if (!filename.endsWith('.yaml')) {
          continue;
        }
        
        try {
          // Try new format first, fall back to old format
          let controlId: string;
          let shortId: string;
          
          try {
            const ids = extractIdsFromFilename(filename);
            controlId = ids.controlId;
            shortId = ids.shortId;
          } catch {
            // Fall back to old format for backward compatibility
            shortId = extractShortIdFromFilename(filename);
            // We'll need to read the file to get the control ID
            const filepath = join(familyPath, filename);
            const content = readFileSync(filepath, 'utf8');
            const data = YAML.parse(content);
            controlId = data.id || data._metadata?.controlId;
            
            if (!controlId) {
              console.error(`Could not determine control ID for file ${filename}`);
              continue;
            }
          }
          
          const filepath = join(familyPath, filename);
          const content = readFileSync(filepath, 'utf8');
          const data = YAML.parse(content);
          
          // Extract control data (remove metadata)
          const { _metadata, ...controlData } = data;
          const control = controlData as Control;
          
          // Update caches
          this.controlsCache.set(control.id, control);
          this.shortIdToControlId.set(shortId, control.id);
          this.controlIdToShortId.set(control.id, shortId);
          
          const stats = statSync(filepath);
          this.metadataCache.set(control.id, {
            shortId,
            controlId: control.id,
            filename,
            lastModified: stats.mtime,
            created: _metadata?.created ? new Date(_metadata.created) : stats.birthtime
          });
        } catch (error) {
          console.error(`Error loading control file ${familyDir.name}/${filename}:`, error);
        }
      }
    }
  }

  /**
   * Gets statistics about the file store
   */
  getStats(): { controlFiles: number; totalSize: number; oldestFile: Date | null; newestFile: Date | null; families: string[] } {
    this.refreshCache();
    
    let totalSize = 0;
    let oldestFile: Date | null = null;
    let newestFile: Date | null = null;
    const families = new Set<string>();
    
    // Scan family directories to get accurate stats
    if (existsSync(this.controlsDir)) {
      const familyDirs = readdirSync(this.controlsDir, { withFileTypes: true });
      
      for (const familyDir of familyDirs) {
        if (!familyDir.isDirectory()) continue;
        
        families.add(familyDir.name);
        const familyPath = join(this.controlsDir, familyDir.name);
        const files = readdirSync(familyPath);
        
        for (const file of files) {
          if (!file.endsWith('.yaml')) continue;
          
          const filepath = join(familyPath, file);
          if (existsSync(filepath)) {
            const stats = statSync(filepath);
            totalSize += stats.size;
            
            if (!oldestFile || stats.birthtime < oldestFile) {
              oldestFile = stats.birthtime;
            }
            if (!newestFile || stats.birthtime > newestFile) {
              newestFile = stats.birthtime;
            }
          }
        }
      }
    }
    
    return {
      controlFiles: this.metadataCache.size,
      totalSize,
      oldestFile,
      newestFile,
      families: Array.from(families).sort()
    };
  }
}