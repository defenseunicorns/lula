#!/usr/bin/env node

import { program } from 'commander';
import { startServer } from './cli/index.js';
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

// Import command - import controls from OSCAL files (auto-detects catalog vs profile)
program
  .command('import')
  .description('Import OSCAL catalog or profile from file or URL (auto-detected)')
  .argument('<source>', 'Path to OSCAL file or URL (JSON/YAML)')
  .argument('<output-dir>', 'Output directory for processed controls')
  .option('--overwrite', 'Overwrite existing files', false)
  .option('--dry-run', 'Show what would be processed without writing files', false)
  .option('--preserve-oscal', 'Preserve original OSCAL references and parameter insertions', false)
  .action(async (source: string, outputDir: string, options) => {
    try {
      const processor = new OSCALProcessor();
      const resolver = new OSCALResolver();
      
      const processOptions = {
        overwrite: options.overwrite,
        dryRun: options.dryRun,
        includeLinks: options.preserveOscal,
        flattenReferences: !options.preserveOscal,
        resolveParameters: !options.preserveOscal
      };

      // Get file content from URL or local file
      let fileContent: string;
      let baseDir: string;
      
      if (source.startsWith('http://') || source.startsWith('https://')) {
        console.log(`📥 Fetching OSCAL file from ${source}...`);
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${source}: ${response.status} ${response.statusText}`);
        }
        fileContent = await response.text();
        // Extract the base URL for resolving relative references
        const url = new URL(source);
        baseDir = url.origin + url.pathname.replace(/\/[^\/]*$/, '/');
      } else {
        const fs = await import('fs');
        fileContent = await fs.promises.readFile(source, 'utf8');
        baseDir = path.dirname(source);
      }

      // Auto-detect if it's a catalog or profile and process accordingly
      const isProfile = fileContent.includes('"profile"') || fileContent.includes('profile:');
      
      if (source.startsWith('http://') || source.startsWith('https://')) {
        // For URLs, we need to write the content to a temporary file since the processor expects file paths
        const fs = await import('fs');
        const os = await import('os');
        const tempFile = path.join(os.tmpdir(), `oscal-import-${Date.now()}.json`);
        
        try {
          await fs.promises.writeFile(tempFile, fileContent, 'utf8');
          
          if (isProfile) {
            const catalogResolver = async (href: string, backMatterResources?: Map<string, any>) => {
              return await resolver.resolveCatalogReference(href, baseDir, backMatterResources);
            };
            await processor.processProfile(tempFile, outputDir, catalogResolver, processOptions);
            console.log('✅ OSCAL profile import completed successfully');
            
            const stats = resolver.getCacheStats();
            console.log(`📊 Cache stats: ${stats.catalogs} catalogs, ${stats.resources} resources`);
          } else {
            await processor.processCatalog(tempFile, outputDir, processOptions);
            console.log('✅ OSCAL catalog import completed successfully');
          }
        } finally {
          // Clean up temporary file
          try {
            await fs.promises.unlink(tempFile);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      } else {
        // Local file processing
        if (isProfile) {
          const catalogResolver = async (href: string, backMatterResources?: Map<string, any>) => {
            return await resolver.resolveCatalogReference(href, baseDir, backMatterResources);
          };
          await processor.processProfile(source, outputDir, catalogResolver, processOptions);
          console.log('✅ OSCAL profile import completed successfully');
          
          const stats = resolver.getCacheStats();
          console.log(`📊 Cache stats: ${stats.catalogs} catalogs, ${stats.resources} resources`);
        } else {
          await processor.processCatalog(source, outputDir, processOptions);
          console.log('✅ OSCAL catalog import completed successfully');
        }
      }
    } catch (error) {
      console.error('❌ Error importing OSCAL file:', error);
      process.exit(1);
    }
  });

// For backward compatibility, if no command is specified, run serve
const knownCommands = ['serve', 'import'];
const hasKnownCommand = knownCommands.some(cmd => process.argv.includes(cmd));
const hasHelpFlag = process.argv.includes('--help') || process.argv.includes('-h');

if ((process.argv.length === 2 || !hasKnownCommand) && !hasHelpFlag) {
  process.argv.splice(2, 0, 'serve');
}

program.parse();
