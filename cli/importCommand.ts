import { existsSync } from 'fs';
import * as path from 'path';
import { OSCALProcessor } from './oscal/processor.js';
import { OSCALResolver } from './oscal/resolver.js';

export interface ImportOptions {
  file: string;
  dir: string;
  format: string; // Kept for backward compatibility, but auto-detected now
  dryRun?: boolean;
  overwrite?: boolean;
}

export async function runImport(options: ImportOptions): Promise<void> {
  const { file: sourceFile, dir: targetDir, format, dryRun = false, overwrite = false } = options;

  if (!sourceFile) {
    console.error('❌ Error: --file option is required');
    console.log('Usage: lula import --file <path-to-oscal-document.json> [--format oscal-import] [--dir <target-directory>]');
    console.log('Note: Auto-detects OSCAL catalogs and profiles');
    process.exit(1);
  }

  console.log(`\n🚀 Starting OSCAL import from: ${sourceFile}`);
  console.log(`📁 Target directory: ${targetDir}`);
  if (dryRun) console.log('🧪 Dry run mode - no files will be changed');
  console.log();

  try {
    // Check if source file exists
    if (!existsSync(sourceFile)) {
      console.error(`❌ Source file not found: ${sourceFile}`);
      process.exit(1);
    }

    // Read and parse source file to detect type
    console.log('📖 Reading and analyzing OSCAL document...');
    const fs = await import('fs');
    const sourceData = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));

    const processor = new OSCALProcessor();
    const processOptions = { 
      overwrite, 
      dryRun, 
      includeLinks: false,  // Default to no internal links
      flattenReferences: false 
    };

    // Auto-detect document type and process accordingly
    if (sourceData.catalog) {
      console.log('📋 Detected: OSCAL Catalog');
      await processor.processCatalog(sourceFile, targetDir, processOptions);
      console.log('✅ OSCAL catalog import completed successfully');
      
    } else if (sourceData.profile) {
      console.log('📊 Detected: OSCAL Profile');
      
      // Create catalog resolver for profile
      const resolver = new OSCALResolver();
      const catalogResolver = async (href: string, backMatterResources?: Map<string, any>) => {
        const baseDir = path.dirname(sourceFile);
        return await resolver.resolveCatalogReference(href, baseDir, backMatterResources);
      };

      await processor.processProfile(sourceFile, targetDir, catalogResolver, processOptions);
      console.log('✅ OSCAL profile import completed successfully');
      
      const stats = resolver.getCacheStats();
      console.log(`📊 Cache stats: ${stats.catalogs} catalogs, ${stats.resources} resources`);
      
    } else {
      console.error('❌ Unsupported document format');
      console.log('Expected: OSCAL catalog or profile (JSON format)');
      console.log('Document should contain either a "catalog" or "profile" root element');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Import failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
