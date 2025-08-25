#!/usr/bin/env node

import { program } from 'commander';
import { startServer } from './cli/index.js';
import { AtomicProcessor } from './cli/processors/atomicProcessor.js';
import { AtomicImportOptions } from './cli/types/atomicControl.js';
import { InitCommand } from './cli/commands/init.js';
import { FrameworksCommand } from './cli/commands/frameworks.js';
import * as path from 'path';

// CLI setup
program
  .name('lula')
  .description('Lula - Git-friendly compliance control management')
  .version('1.0.0');

// Init command - interactive project setup
program
  .command('init')
  .description('Create a new compliance project with guided setup')
  .option('--framework <id>', 'Framework ID (skip interactive selection)')
  .option('--with-cci [value]', 'Enable CCI tracking (true/false)')
  .option('--project-name <name>', 'Project name')
  .option('--directory <dir>', 'Project directory')
  .option('--non-interactive', 'Skip interactive prompts')
  .action(async (options) => {
    const initCommand = new InitCommand();
    await initCommand.run({
      framework: options.framework,
      withCci: options.withCci !== undefined ? (options.withCci === true || options.withCci === 'true') : undefined,
      projectName: options.projectName,
      directory: options.directory,
      interactive: !options.nonInteractive
    });
  });

// Frameworks command - list available frameworks
program
  .command('frameworks')
  .description('List available compliance frameworks')
  .option('-v, --verbose', 'Show detailed information and usage examples')
  .action(async (options) => {
    const frameworksCommand = new FrameworksCommand();
    await frameworksCommand.run({ verbose: options.verbose });
    
    if (options.verbose) {
      frameworksCommand.getRecommendations();
    }
  });

// Serve command - start the web server
program
  .command('serve')
  .description('Start the web server')
  .option('--dir <directory>', 'Control set directory path', './examples/nist-800-53-rev4')
  .option('--port <port>', 'Server port', '3000')
  .action(async (options) => {
    await startServer(options.dir, parseInt(options.port));
  });

// Import command - import controls from OSCAL files
program
  .command('import')
  .description('Import controls from OSCAL catalog or profile files')
  .argument('<source>', 'Path to OSCAL file or URL')
  .argument('<output-dir>', 'Output directory for controls')
  .option('--overwrite', 'Overwrite existing files', false)
  .option('--dry-run', 'Show what would be processed without writing files', false)
  .option('--preserve-oscal', 'Preserve original OSCAL references and parameter insertions', false)
  .action(async (source: string, outputDir: string, options) => {
    try {
      console.log('🔄 Starting OSCAL import...');
      console.log(`📥 Source: ${source}`);
      console.log(`📤 Output: ${outputDir}`);
      
      const atomicOptions: AtomicImportOptions = {
        use_cci: true,  // Use CCI by default for NIST frameworks
        output_dir: outputDir,
        overwrite: options.overwrite,
        dry_run: options.dryRun,
        flatten_references: !options.preserveOscal,
        include_links: options.preserveOscal,
        resolve_parameters: !options.preserveOscal,
        nist_revision_filter: '4'  // Filter to Rev 4 only
      };
      
      const processor = new AtomicProcessor();
      
      // Handle URLs vs local files
      let tempFilePath: string | undefined;
      let sourceFilePath = source;
      
      if (source.startsWith('http://') || source.startsWith('https://')) {
        console.log(`📥 Fetching OSCAL file from ${source}...`);
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${source}: ${response.status} ${response.statusText}`);
        }
        
        const fileContent = await response.text();
        const fs = await import('fs');
        const os = await import('os');
        tempFilePath = path.join(os.tmpdir(), `oscal-import-${Date.now()}.json`);
        
        await fs.promises.writeFile(tempFilePath, fileContent, 'utf8');
        sourceFilePath = tempFilePath;
      }
      
      try {
        const result = await processor.processOSCAL(sourceFilePath, atomicOptions);
        
        console.log('✅ OSCAL import completed successfully');
        console.log(`📊 Framework: ${result.framework.name} (${result.framework.version})`);
        console.log(`📊 Controls: ${result.controls.length}`);
        
      } finally {
        // Clean up temporary file if created
        if (tempFilePath) {
          try {
            const fs = await import('fs');
            await fs.promises.unlink(tempFilePath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error importing OSCAL:', error);
      process.exit(1);
    }
  });

// Status command - check if a control set uses enriched format
program
  .command('status')
  .description('Check the format and structure of a control set')
  .argument('<dir>', 'Control set directory path')
  .action(async (dir: string) => {
    try {
      const fs = await import('fs');
      const fullPath = path.resolve(dir);
      
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ Directory not found: ${fullPath}`);
        process.exit(1);
      }
      
      console.log(`🔍 Analyzing control set: ${fullPath}`);
      
      // Check for enriched structure
      const controlsDir = path.join(fullPath, 'controls');
      const metadataDir = path.join(fullPath, 'metadata');
      const controlSetYaml = path.join(fullPath, 'control-set.yaml');
      
      // Check if controls directory has enriched format (flat structure with individual control files)
      let hasEnrichedControls = false;
      let hasLegacyControls = false;
      
      if (fs.existsSync(controlsDir)) {
        const controlsContent = fs.readdirSync(controlsDir);
        // Enriched format: flat directory with .yaml files (CCI-000001.yaml, AC-1.yaml, etc.)
        const yamlFiles = controlsContent.filter(f => f.endsWith('.yaml'));
        // Legacy format: subdirectories (AC/, AU/, etc.)
        const subdirs = controlsContent.filter(f => 
          fs.statSync(path.join(controlsDir, f)).isDirectory()
        );
        
        hasEnrichedControls = yamlFiles.length > 0 && subdirs.length === 0;
        hasLegacyControls = subdirs.length > 0 && yamlFiles.length === 0;
      }
      
      const hasMetadata = fs.existsSync(metadataDir);
      const hasControlSet = fs.existsSync(controlSetYaml);
      
      console.log('\n📋 Structure Analysis:');
      console.log(`   Enriched controls: ${hasEnrichedControls ? '✅ Present' : '❌ Missing'}`);
      console.log(`   Framework metadata: ${hasMetadata ? '✅ Present' : '❌ Missing'}`);
      console.log(`   Legacy structure: ${hasLegacyControls ? '⚠️  Present' : '✅ Not present'}`);
      console.log(`   Control set config: ${hasControlSet ? '✅ Present' : '❌ Missing'}`);
      
      let format: string;
      let recommendation: string;
      
      if (hasEnrichedControls && hasMetadata) {
        format = 'Enriched Format';
        recommendation = hasLegacyControls 
          ? 'Mixed format detected. Legacy structure should be migrated or removed.'
          : 'Control set is using modern enriched format.';
      } else if (hasLegacyControls && hasControlSet) {
        format = 'Legacy Format';
        recommendation = 'Consider migrating to enriched format using: import --with-cci=true command';
      } else {
        format = 'Unknown/Incomplete';
        recommendation = 'Directory structure is incomplete or unrecognized.';
      }
      
      console.log(`\n🏷️  Format: ${format}`);
      console.log(`💡 Recommendation: ${recommendation}`);
      
      // Count controls if enriched format
      if (hasEnrichedControls) {
        try {
          const controlFiles = fs.readdirSync(controlsDir).filter(f => f.endsWith('.yaml'));
          console.log(`📊 Enriched controls: ${controlFiles.length}`);
          
          if (controlFiles.length > 0) {
            // Sample a few files to determine types
            const sampleSize = Math.min(5, controlFiles.length);
            const typeCount = { cci: 0, nist: 0, iso: 0, cobit: 0, custom: 0 };
            
            for (let i = 0; i < sampleSize; i++) {
              const filePath = path.join(controlsDir, controlFiles[i]);
              const content = fs.readFileSync(filePath, 'utf8');
              const yaml = await import('yaml');
              const control = yaml.parse(content);
              if (control.type && typeCount.hasOwnProperty(control.type)) {
                typeCount[control.type as keyof typeof typeCount]++;
              }
            }
            
            console.log('   Types detected:');
            Object.entries(typeCount).forEach(([type, count]) => {
              if (count > 0) {
                console.log(`     - ${type.toUpperCase()}: ${count}/${sampleSize} samples`);
              }
            });
          }
        } catch (error) {
          console.log('   ⚠️  Could not analyze enriched controls');
        }
      }
      
      // Count legacy controls if present
      if (hasLegacyControls) {
        try {
          const families = fs.readdirSync(controlsDir).filter(f => 
            fs.statSync(path.join(controlsDir, f)).isDirectory()
          );
          let totalControls = 0;
          
          for (const family of families) {
            const familyDir = path.join(controlsDir, family);
            const controlFiles = fs.readdirSync(familyDir).filter(f => f.endsWith('.yaml'));
            totalControls += controlFiles.length;
          }
          
          console.log(`📊 Legacy controls: ${totalControls} across ${families.length} families`);
        } catch (error) {
          console.log('   ⚠️  Could not analyze legacy controls');
        }
      }
      
    } catch (error) {
      console.error('❌ Error analyzing control set:', error);
      process.exit(1);
    }
  });

// For backward compatibility, if no command is specified, run serve
const knownCommands = ['init', 'frameworks', 'serve', 'import', 'status'];
const hasKnownCommand = knownCommands.some(cmd => process.argv.includes(cmd));
const hasHelpFlag = process.argv.includes('--help') || process.argv.includes('-h');

if ((process.argv.length === 2 || !hasKnownCommand) && !hasHelpFlag) {
  process.argv.splice(2, 0, 'serve');
}

program.parse();
