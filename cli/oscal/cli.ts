#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { OSCALProcessor } from './processor.js';
import { OSCALResolver } from './resolver.js';

const program = new Command();

program
  .name('oscal-processor')
  .description('Feature-complete OSCAL processor for catalogs and profiles')
  .version('1.0.0');

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
        includeLinks: !options.noLinks,
        flattenReferences: options.flattenRefs
      };
      await processor.processCatalog(catalogFile, outputDir, processOptions);
      console.log('✅ Catalog import completed successfully');
    } catch (error) {
      console.error('❌ Error importing catalog:', error);
      process.exit(1);
    }
  });

program
  .command('import-profile')
  .description('Import an OSCAL profile to YAML format')
  .argument('<profile-file>', 'Path to OSCAL profile file (JSON/YAML)')
  .argument('<output-dir>', 'Output directory for processed controls')
  .option('--overwrite', 'Overwrite existing files', false)
  .option('--dry-run', 'Show what would be processed without writing files', false)
  .option('--no-links', 'Remove internal reference links')
  .option('--flatten-refs', 'Resolve back-matter references to actual content', false)
  .option('--cache-dir <dir>', 'Directory for caching resolved catalogs', '.oscal-cache')
  .action(async (profileFile: string, outputDir: string, options) => {
    try {
      const processor = new OSCALProcessor();
      const resolver = new OSCALResolver();
      
      // Create catalog resolver function
      const catalogResolver = async (href: string) => {
        const baseDir = path.dirname(profileFile);
        return await resolver.resolveCatalogReference(href, baseDir);
      };

      await processor.processProfile(profileFile, outputDir, catalogResolver, options);
      console.log('✅ Profile import completed successfully');
      
      const stats = resolver.getCacheStats();
      console.log(`📊 Cache stats: ${stats.catalogs} catalogs, ${stats.resources} resources`);
    } catch (error) {
      console.error('❌ Error importing profile:', error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate an OSCAL document structure')
  .argument('<oscal-file>', 'Path to OSCAL file to validate')
  .action(async (oscalFile: string) => {
    try {
      // Basic validation logic
      const fs = await import('fs');
      const content = fs.readFileSync(oscalFile, 'utf8');
      
      let data: any;
      if (oscalFile.endsWith('.json')) {
        data = JSON.parse(content);
      } else if (oscalFile.endsWith('.yaml') || oscalFile.endsWith('.yml')) {
        const { parse } = await import('yaml');
        data = parse(content);
      } else {
        throw new Error('Unsupported file format. Use JSON or YAML.');
      }

      // Check for required OSCAL structure
      if (data.catalog) {
        console.log('✅ Valid OSCAL catalog structure detected');
        console.log(`   UUID: ${data.catalog.uuid}`);
        console.log(`   Title: ${data.catalog.metadata.title}`);
        console.log(`   Version: ${data.catalog.metadata.version}`);
        console.log(`   OSCAL Version: ${data.catalog.metadata['oscal-version']}`);
        
        const controlCount = data.catalog.groups?.reduce((sum: number, group: any) => 
          sum + (group.controls?.length || 0), 0) || 0;
        console.log(`   Controls: ${controlCount}`);
        
        if (data.catalog['back-matter']?.resources) {
          console.log(`   Back-matter resources: ${data.catalog['back-matter'].resources.length}`);
        }
      } else if (data.profile) {
        console.log('✅ Valid OSCAL profile structure detected');
        console.log(`   UUID: ${data.profile.uuid}`);
        console.log(`   Title: ${data.profile.metadata.title}`);
        console.log(`   Version: ${data.profile.metadata.version}`);
        console.log(`   OSCAL Version: ${data.profile.metadata['oscal-version']}`);
        console.log(`   Imports: ${data.profile.imports?.length || 0}`);
        
        if (data.profile['back-matter']?.resources) {
          console.log(`   Back-matter resources: ${data.profile['back-matter'].resources.length}`);
        }
      } else {
        console.log('❌ Not a recognized OSCAL document format');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  });

program
  .command('info')
  .description('Show information about an OSCAL document')
  .argument('<oscal-file>', 'Path to OSCAL file')
  .action(async (oscalFile: string) => {
    try {
      const fs = await import('fs');
      const content = fs.readFileSync(oscalFile, 'utf8');
      
      let data: any;
      if (oscalFile.endsWith('.json')) {
        data = JSON.parse(content);
      } else {
        const { parse } = await import('yaml');
        data = parse(content);
      }

      if (data.catalog) {
        const catalog = data.catalog;
        console.log('📋 OSCAL Catalog Information');
        console.log('================================');
        console.log(`UUID: ${catalog.uuid}`);
        console.log(`Title: ${catalog.metadata.title}`);
        console.log(`Version: ${catalog.metadata.version}`);
        console.log(`Last Modified: ${catalog.metadata['last-modified']}`);
        console.log(`OSCAL Version: ${catalog.metadata['oscal-version']}`);
        
        if (catalog.groups) {
          console.log('\n📁 Control Families:');
          for (const group of catalog.groups) {
            const controlCount = group.controls?.length || 0;
            console.log(`   ${group.id}: ${group.title} (${controlCount} controls)`);
          }
        }

        if (catalog['back-matter']?.resources) {
          console.log('\n📚 Back-matter Resources:');
          for (const resource of catalog['back-matter'].resources.slice(0, 5)) {
            console.log(`   ${resource.uuid}: ${resource.title || resource.description || 'Untitled'}`);
          }
          if (catalog['back-matter'].resources.length > 5) {
            console.log(`   ... and ${catalog['back-matter'].resources.length - 5} more`);
          }
        }

      } else if (data.profile) {
        const profile = data.profile;
        console.log('📊 OSCAL Profile Information');
        console.log('================================');
        console.log(`UUID: ${profile.uuid}`);
        console.log(`Title: ${profile.metadata.title}`);
        console.log(`Version: ${profile.metadata.version}`);
        console.log(`Last Modified: ${profile.metadata['last-modified']}`);
        console.log(`OSCAL Version: ${profile.metadata['oscal-version']}`);
        
        if (profile.imports) {
          console.log('\n📥 Imports:');
          for (const imp of profile.imports) {
            console.log(`   Catalog: ${imp.href}`);
            if (imp['include-controls']) {
              console.log(`     Includes: ${imp['include-controls'].length} specific controls`);
            } else if (imp['include-all']) {
              console.log(`     Includes: All controls`);
            }
          }
        }

        if (profile.modify?.alters) {
          console.log(`\n🔧 Modifications: ${profile.modify.alters.length} control alterations`);
        }
      }

    } catch (error) {
      console.error('❌ Error reading file:', error);
      process.exit(1);
    }
  });

// Handle unrecognized commands
program.on('command:*', () => {
  console.error('Invalid command: %s\nSee --help for available commands.', program.args.join(' '));
  process.exit(1);
});

if (process.argv.length === 2) {
  program.help();
}

program.parse();