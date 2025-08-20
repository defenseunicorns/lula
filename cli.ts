#!/usr/bin/env node

import { program } from 'commander';
import { startServer, runImport } from './cli/index.js';
import { OSCALProcessor } from './cli/oscal/processor.js';
import { OSCALResolver } from './cli/oscal/resolver.js';
import * as path from 'path';

// CLI setup
program
  .name('lula')
  .description('Lula - Git-friendly compliance control management')
  .version('1.0.0');

// Serve command - start the web server
program
  .command('serve')
  .description('Start the web server')
  .option('--dir <directory>', 'Control set directory path', './examples/nist-800-53-rev4')
  .option('--port <port>', 'Server port', '3000')
  .action(async (options) => {
    await startServer(options.dir, parseInt(options.port));
  });

// Import command - import controls from external formats
program
  .command('import')
  .description('Import controls from external formats (OSCAL, etc.)')
  .option('--format <format>', 'Source format (oscal-import)', 'oscal-import')
  .requiredOption('--file <file>', 'Source file path (required)')
  .option('--dir <directory>', 'Target control set directory path', './examples/nist-800-53-rev4')
  .option('--dry-run', 'Show what would be imported without making changes')
  .option('--overwrite', 'Overwrite existing controls')
  .action(async (options) => {
    await runImport({
      file: options.file,
      dir: options.dir,
      format: options.format,
      dryRun: options.dryRun,
      overwrite: options.overwrite
    });
  });

// OSCAL import-catalog command
program
  .command('import-catalog')
  .description('Import an OSCAL catalog to YAML format')
  .argument('<catalog-file>', 'Path to OSCAL catalog file (JSON/YAML)')
  .argument('<output-dir>', 'Output directory for processed controls')
  .option('--overwrite', 'Overwrite existing files', false)
  .option('--dry-run', 'Show what would be processed without writing files', false)
  .option('--no-links', 'Remove internal reference links')
  .option('--flatten-refs', 'Resolve back-matter references to actual content', false)
  .action(async (catalogFile: string, outputDir: string, options) => {
    try {
      const processor = new OSCALProcessor();
      const processOptions = {
        overwrite: options.overwrite,
        dryRun: options.dryRun,
        includeLinks: options.links !== false,
        flattenReferences: options.flattenRefs
      };
      await processor.processCatalog(catalogFile, outputDir, processOptions);
      console.log('✅ OSCAL catalog import completed successfully');
    } catch (error) {
      console.error('❌ Error importing OSCAL catalog:', error);
      process.exit(1);
    }
  });

// OSCAL import-profile command
program
  .command('import-profile')
  .description('Import an OSCAL profile to YAML format')
  .argument('<profile-file>', 'Path to OSCAL profile file (JSON/YAML)')
  .argument('<output-dir>', 'Output directory for processed controls')
  .option('--overwrite', 'Overwrite existing files', false)
  .option('--dry-run', 'Show what would be processed without writing files', false)
  .option('--no-links', 'Remove internal reference links')
  .option('--flatten-refs', 'Resolve back-matter references to actual content', false)
  .action(async (profileFile: string, outputDir: string, options) => {
    try {
      const processor = new OSCALProcessor();
      const resolver = new OSCALResolver();
      
      const catalogResolver = async (href: string, backMatterResources?: Map<string, any>) => {
        const baseDir = path.dirname(profileFile);
        return await resolver.resolveCatalogReference(href, baseDir, backMatterResources);
      };

      const processOptions = {
        overwrite: options.overwrite,
        dryRun: options.dryRun,
        includeLinks: options.links !== false,
        flattenReferences: options.flattenRefs
      };
      await processor.processProfile(profileFile, outputDir, catalogResolver, processOptions);
      console.log('✅ OSCAL profile import completed successfully');
      
      const stats = resolver.getCacheStats();
      console.log(`📊 Cache stats: ${stats.catalogs} catalogs, ${stats.resources} resources`);
    } catch (error) {
      console.error('❌ Error importing OSCAL profile:', error);
      process.exit(1);
    }
  });

// For backward compatibility, if no command is specified, run serve
const knownCommands = ['serve', 'import', 'import-catalog', 'import-profile'];
const hasKnownCommand = knownCommands.some(cmd => process.argv.includes(cmd));

if (process.argv.length === 2 || !hasKnownCommand) {
  process.argv.splice(2, 0, 'serve');
}

program.parse();
