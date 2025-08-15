#!/usr/bin/env tsx

/**
 * Clean metadata in control files - remove shortId and lastModified
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import * as YAML from 'yaml';

interface CleanOptions {
  baseDir: string;
  dryRun?: boolean;
}

async function cleanMetadata(options: CleanOptions) {
  const { baseDir, dryRun = false } = options;
  const controlsDir = join(baseDir, 'controls');

  if (!existsSync(controlsDir)) {
    console.log('No controls directory found, nothing to clean');
    return;
  }

  console.log(`🧹 Cleaning metadata in: ${controlsDir}`);
  console.log(`📋 Dry run mode: ${dryRun ? 'ON' : 'OFF'}`);

  let cleanedCount = 0;
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
      const filePath = join(familyPath, filename);
      
      try {
        // Read the file
        const content = readFileSync(filePath, 'utf8');
        const parsed = YAML.parse(content);

        if (!parsed._metadata) {
          console.log(`  ⏭️  Skipping (no metadata): ${filename}`);
          skippedCount++;
          continue;
        }

        // Check if we need to clean anything
        const needsCleaning = parsed._metadata.shortId || parsed._metadata.lastModified;
        
        if (!needsCleaning) {
          console.log(`  ⏭️  Skipping (already clean): ${filename}`);
          skippedCount++;
          continue;
        }

        console.log(`  🧹 Cleaning: ${filename}`);

        if (!dryRun) {
          // Remove unwanted metadata fields
          delete parsed._metadata.shortId;
          delete parsed._metadata.lastModified;

          // Ensure we have the essential metadata
          if (!parsed._metadata.controlId && parsed.id) {
            parsed._metadata.controlId = parsed.id;
          }
          if (!parsed._metadata.family) {
            parsed._metadata.family = family;
          }

          // Write back to file
          const yamlContent = YAML.stringify(parsed, {
            indent: 2,
            lineWidth: 0,
            minContentWidth: 0
          });

          writeFileSync(filePath, yamlContent, 'utf8');
        }

        cleanedCount++;

      } catch (error) {
        console.log(`  ❌ Error processing ${filename}: ${error}`);
        errorCount++;
      }
    }
  }

  console.log(`\n📊 Cleaning Summary:`);
  console.log(`  🧹 Cleaned: ${cleanedCount}`);
  console.log(`  ⏭️  Skipped: ${skippedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);

  if (dryRun) {
    console.log(`\n🧪 This was a dry run. Run without --dry-run to perform actual cleaning.`);
  } else {
    console.log(`\n✨ Metadata cleaning completed!`);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const baseDir = process.argv[2] || './examples/nist-800-53-rev4';
  const dryRun = process.argv.includes('--dry-run');

  console.log('🧹 Metadata Cleaning Tool');
  console.log('========================\n');

  cleanMetadata({ baseDir, dryRun })
    .then(() => {
      console.log('\n✅ Cleaning script completed');
    })
    .catch(error => {
      console.error('\n❌ Cleaning failed:', error);
      process.exit(1);
    });
}

export { cleanMetadata };