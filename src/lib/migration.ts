/**
 * Migration Utility for Converting Single YAML to Individual Control Files
 * 
 * Converts existing controls.yaml and mappings.yaml files to the new 
 * individual file structure with timestamp-based short IDs.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import YAML from 'yaml';
import { FileStore } from './fileStore.js';
import { generateShortId, getControlFamily, getControlFilename } from './shortId.js';
import type { Control, Mapping } from './types.js';

export interface MigrationResult {
  controlsProcessed: number;
  mappingsProcessed: number;
  controlsSkipped: number;
  errors: string[];
  shortIdMap: Map<string, string>; // controlId -> shortId
}

export interface MigrationOptions {
  baseDir: string;
  backupExisting?: boolean;
  dryRun?: boolean;
  overwriteExisting?: boolean;
}

export class MigrationUtility {
  private fileStore: FileStore;
  private options: MigrationOptions;

  constructor(options: MigrationOptions) {
    this.options = options;
    this.fileStore = new FileStore({ baseDir: options.baseDir });
  }

  /**
   * Performs the migration from single YAML files to individual files
   */
  async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      controlsProcessed: 0,
      mappingsProcessed: 0,
      controlsSkipped: 0,
      errors: [],
      shortIdMap: new Map()
    };

    console.log('Starting migration from single YAML to individual files...');
    
    try {
      // Create backup if requested
      if (this.options.backupExisting) {
        await this.createBackup();
      }

      // Migrate controls
      await this.migrateControls(result);

      // Migrate mappings
      await this.migrateMappings(result);

      console.log('Migration completed successfully!');
      console.log(`Controls processed: ${result.controlsProcessed}`);
      console.log(`Controls skipped: ${result.controlsSkipped}`);
      console.log(`Mappings processed: ${result.mappingsProcessed}`);
      
      if (result.errors.length > 0) {
        console.warn(`Errors encountered: ${result.errors.length}`);
        result.errors.forEach(error => console.warn(`  - ${error}`));
      }

    } catch (error) {
      result.errors.push(`Migration failed: ${error}`);
      console.error('Migration failed:', error);
    }

    return result;
  }

  /**
   * Migrates controls from controls.yaml to individual files
   */
  private async migrateControls(result: MigrationResult): Promise<void> {
    const controlsFile = join(this.options.baseDir, 'controls.yaml');
    
    if (!existsSync(controlsFile)) {
      console.log('No controls.yaml file found, skipping control migration');
      return;
    }

    try {
      console.log('Reading controls.yaml...');
      const content = readFileSync(controlsFile, 'utf8');
      const data = YAML.parse(content);
      
      if (!data.controls || !Array.isArray(data.controls)) {
        result.errors.push('Invalid controls.yaml format: missing or invalid controls array');
        return;
      }

      const controls = data.controls as Control[];
      console.log(`Found ${controls.length} controls to migrate`);

      for (const control of controls) {
        try {
          // Check if individual file already exists
          const existingControl = await this.fileStore.loadControl(control.id);
          
          if (existingControl && !this.options.overwriteExisting) {
            console.log(`Skipping ${control.id} (already exists)`);
            result.controlsSkipped++;
            continue;
          }

          if (!this.options.dryRun) {
            // Generate short ID and save control
            const shortId = await this.fileStore.saveControl(control);
            result.shortIdMap.set(control.id, shortId);
            const family = getControlFamily(control.id);
            const filename = getControlFilename(control.id, shortId);
            console.log(`Migrated ${control.id} -> ${family}/${filename}`);
          } else {
            // Dry run: just generate the short ID
            const shortId = generateShortId(control.id);
            result.shortIdMap.set(control.id, shortId);
            const family = getControlFamily(control.id);
            const filename = getControlFilename(control.id, shortId);
            console.log(`[DRY RUN] Would migrate ${control.id} -> ${family}/${filename}`);
          }

          result.controlsProcessed++;
        } catch (error) {
          const errorMsg = `Failed to migrate control ${control.id}: ${error}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

    } catch (error) {
      result.errors.push(`Failed to read controls.yaml: ${error}`);
      throw error;
    }
  }

  /**
   * Migrates mappings from mappings.yaml (keeps single file)
   */
  private async migrateMappings(result: MigrationResult): Promise<void> {
    const mappingsFile = join(this.options.baseDir, 'mappings.yaml');
    
    if (!existsSync(mappingsFile)) {
      console.log('No mappings.yaml file found, skipping mapping migration');
      return;
    }

    try {
      console.log('Processing mappings.yaml...');
      const content = readFileSync(mappingsFile, 'utf8');
      const data = YAML.parse(content);
      
      if (!data.mappings || !Array.isArray(data.mappings)) {
        result.errors.push('Invalid mappings.yaml format: missing or invalid mappings array');
        return;
      }

      const mappings = data.mappings as Mapping[];
      console.log(`Found ${mappings.length} mappings`);

      if (!this.options.dryRun) {
        // Save mappings using the file store (same format, but processed)
        await this.fileStore.saveMappings(mappings);
        console.log(`Processed ${mappings.length} mappings`);
      } else {
        console.log(`[DRY RUN] Would process ${mappings.length} mappings`);
      }

      result.mappingsProcessed = mappings.length;

    } catch (error) {
      result.errors.push(`Failed to process mappings.yaml: ${error}`);
      throw error;
    }
  }

  /**
   * Creates backup copies of existing files
   */
  private async createBackup(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = join(this.options.baseDir, `backup-${timestamp}`);
    
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    const filesToBackup = ['controls.yaml', 'mappings.yaml'];
    
    for (const filename of filesToBackup) {
      const sourcePath = join(this.options.baseDir, filename);
      if (existsSync(sourcePath)) {
        const backupPath = join(backupDir, filename);
        const content = readFileSync(sourcePath, 'utf8');
        writeFileSync(backupPath, content, 'utf8');
        console.log(`Backed up ${filename} to ${backupPath}`);
      }
    }

    // Also backup existing controls directory if it exists
    const controlsDir = join(this.options.baseDir, 'controls');
    if (existsSync(controlsDir)) {
      const backupControlsDir = join(backupDir, 'controls');
      mkdirSync(backupControlsDir, { recursive: true });
      
      const files = readdirSync(controlsDir);
      for (const file of files) {
        if (file.endsWith('.yaml')) {
          const sourcePath = join(controlsDir, file);
          const backupPath = join(backupControlsDir, file);
          const content = readFileSync(sourcePath, 'utf8');
          writeFileSync(backupPath, content, 'utf8');
        }
      }
      console.log(`Backed up controls directory to ${backupControlsDir}`);
    }
  }

  /**
   * Generates a migration report showing what would be migrated
   */
  async generateReport(): Promise<string> {
    const result = await this.migrate();
    
    let report = '# Migration Report\n\n';
    report += `## Summary\n`;
    report += `- Controls to process: ${result.controlsProcessed}\n`;
    report += `- Controls to skip: ${result.controlsSkipped}\n`;
    report += `- Mappings to process: ${result.mappingsProcessed}\n`;
    report += `- Errors: ${result.errors.length}\n\n`;

    if (result.shortIdMap.size > 0) {
      report += `## Control ID Mapping\n`;
      for (const [controlId, shortId] of result.shortIdMap) {
        const family = getControlFamily(controlId);
        const filename = getControlFilename(controlId, shortId);
        report += `- ${controlId} -> ${family}/${filename}\n`;
      }
      report += '\n';
    }

    if (result.errors.length > 0) {
      report += `## Errors\n`;
      for (const error of result.errors) {
        report += `- ${error}\n`;
      }
      report += '\n';
    }

    report += `## File Structure After Migration\n`;
    report += `\`\`\`\n`;
    report += `${this.options.baseDir}/\n`;
    report += `├── controls/\n`;
    
    // Group by family for the report
    const familyMap = new Map<string, Array<{controlId: string, shortId: string}>>();
    for (const [controlId, shortId] of result.shortIdMap) {
      const family = getControlFamily(controlId);
      if (!familyMap.has(family)) {
        familyMap.set(family, []);
      }
      familyMap.get(family)!.push({ controlId, shortId });
    }
    
    const sortedFamilies = Array.from(familyMap.keys()).sort();
    for (let i = 0; i < sortedFamilies.length; i++) {
      const family = sortedFamilies[i];
      const controls = familyMap.get(family)!;
      const isLast = i === sortedFamilies.length - 1;
      
      report += `│   ${isLast ? '└──' : '├──'} ${family}/\n`;
      for (let j = 0; j < Math.min(controls.length, 3); j++) {
        const { controlId, shortId } = controls[j];
        const filename = getControlFilename(controlId, shortId);
        const prefix = isLast ? '    ' : '│   ';
        report += `${prefix}    ├── ${filename}\n`;
      }
      if (controls.length > 3) {
        const prefix = isLast ? '    ' : '│   ';
        report += `${prefix}    └── ... (${controls.length - 3} more)\n`;
      }
    }
    
    report += `└── mappings.yaml\n`;
    report += `\`\`\`\n`;

    return report;
  }

  /**
   * Validates the current state and checks if migration is needed
   */
  async checkMigrationStatus(): Promise<{
    needsMigration: boolean;
    hasLegacyFiles: boolean;
    hasIndividualFiles: boolean;
    controlCount: number;
    individualFileCount: number;
  }> {
    const controlsFile = join(this.options.baseDir, 'controls.yaml');
    const controlsDir = join(this.options.baseDir, 'controls');
    
    const hasLegacyFiles = existsSync(controlsFile);
    const hasIndividualFiles = existsSync(controlsDir);
    
    let controlCount = 0;
    let individualFileCount = 0;
    
    if (hasLegacyFiles) {
      try {
        const content = readFileSync(controlsFile, 'utf8');
        const data = YAML.parse(content);
        controlCount = data.controls?.length || 0;
      } catch (error) {
        console.warn('Error reading controls.yaml:', error);
      }
    }
    
    if (hasIndividualFiles) {
      try {
        const files = readdirSync(controlsDir);
        individualFileCount = files.filter(f => f.endsWith('.yaml')).length;
      } catch (error) {
        console.warn('Error reading controls directory:', error);
      }
    }
    
    const needsMigration = hasLegacyFiles && (individualFileCount === 0 || controlCount > individualFileCount);
    
    return {
      needsMigration,
      hasLegacyFiles,
      hasIndividualFiles,
      controlCount,
      individualFileCount
    };
  }
}