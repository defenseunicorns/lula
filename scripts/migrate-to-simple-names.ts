#!/usr/bin/env tsx

/**
 * Migrate control files from complex short ID names to simple control ID names
 * e.g., AC-1_BORFPJAR.yaml -> AC-1.yaml
 */

import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import * as YAML from 'yaml';

interface MigrationOptions {
  baseDir: string;
  dryRun?: boolean;
}

function getControlFamily(controlId: string): string {
  return controlId.split('-')[0];
}

function sanitizeControlId(controlId: string): string {
  return controlId.replace(/[^\w\-\.]/g, '_');
}

function extractControlIdFromLegacyFilename(filename: string): string | null {
  const match = filename.match(/^([^_]+)_[A-Z0-9]+\.yaml$/);
  return match ? match[1] : null;
}

async function migrateControlFiles(options: MigrationOptions) {
  const { baseDir, dryRun = false } = options;
  const controlsDir = join(baseDir, 'controls');

  if (!existsSync(controlsDir)) {
    console.log('No controls directory found, nothing to migrate');
    return;
  }

  console.log(`🔄 Migrating control files in: ${controlsDir}`);
  console.log(`📋 Dry run mode: ${dryRun ? 'ON' : 'OFF'}`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Read all family directories
  const families = readdirSync(controlsDir).filter(name => {
    const familyPath = join(controlsDir, name);
    return statSync(familyPath).isDirectory();
  });

  for (const family of families) {
    const familyPath = join(controlsDir, family);
    const files = readdirSync(familyPath).filter(file => file.endsWith('.yaml'));

    console.log(`\n📁 Processing family: ${family} (${files.length} files)`);

    for (const filename of files) {
      const oldPath = join(familyPath, filename);
      
      try {
        // Check if this is already in the new format
        if (!filename.includes('_') || !filename.match(/_[A-Z0-9]+\.yaml$/)) {
          console.log(`  ⏭️  Skipping (already simple): ${filename}`);
          skippedCount++;
          continue;
        }

        // Extract control ID from legacy filename
        const controlId = extractControlIdFromLegacyFilename(filename);
        if (!controlId) {
          console.log(`  ❌ Could not extract control ID from: ${filename}`);
          errorCount++;
          continue;
        }

        // Generate new simple filename
        const sanitizedControlId = sanitizeControlId(controlId);
        const newFilename = `${sanitizedControlId}.yaml`;
        const newPath = join(familyPath, newFilename);

        console.log(`  📝 ${filename} -> ${newFilename}`);

        if (!dryRun) {
          // Check if target already exists
          if (existsSync(newPath)) {
            console.log(`  ⚠️  Target exists, skipping: ${newFilename}`);
            skippedCount++;
            continue;
          }

          // Read the old file
          const content = readFileSync(oldPath, 'utf8');
          const parsed = YAML.parse(content);

          // Update metadata if present
          if (parsed._metadata) {
            parsed._metadata.controlId = controlId;
            parsed._metadata.family = family;
            // Remove unwanted metadata fields
            delete parsed._metadata.shortId;
            delete parsed._metadata.lastModified;
          } else {
            // Add simple metadata
            parsed._metadata = {
              controlId: controlId,
              family: family
            };
          }

          // Write to new location
          const yamlContent = YAML.stringify(parsed, {
            indent: 2,
            lineWidth: 0,
            minContentWidth: 0
          });

          writeFileSync(newPath, yamlContent, 'utf8');

          // Remove old file
          unlinkSync(oldPath);
        }

        migratedCount++;

      } catch (error) {
        console.log(`  ❌ Error processing ${filename}: ${error}`);
        errorCount++;
      }
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`  ✅ Migrated: ${migratedCount}`);
  console.log(`  ⏭️  Skipped: ${skippedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);

  if (dryRun) {
    console.log(`\n🧪 This was a dry run. Run without --dry-run to perform actual migration.`);
  } else {
    console.log(`\n🎉 Migration completed!`);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const baseDir = process.argv[2] || './examples/nist-800-53-rev4';
  const dryRun = process.argv.includes('--dry-run');

  console.log('📂 Simple Filename Migration Tool');
  console.log('==================================\n');

  migrateControlFiles({ baseDir, dryRun })
    .then(() => {
      console.log('\n✅ Migration script completed');
    })
    .catch(error => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

export { migrateControlFiles };