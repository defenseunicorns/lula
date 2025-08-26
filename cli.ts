#!/usr/bin/env node

import { program } from 'commander';
import { InitCommand } from './cli/commands/init';
import { FrameworksCommand } from './cli/commands/frameworks';
import { ServeCommand } from './cli/commands/serve';
import { ImportCommand } from './cli/commands/import';
import { StatusCommand } from './cli/commands/status';

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
			withCci:
				options.withCci !== undefined
					? options.withCci === true || options.withCci === 'true'
					: undefined,
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
		await frameworksCommand.run({
			verbose: options.verbose
		});

		if (options.verbose) {
			frameworksCommand.getRecommendations();
		}
	});

// Serve command - start the web server
program
	.command('serve [directory]')
	.description('Start the web server')
	.option('--dir <directory>', 'Control set directory path (alternative to positional argument)')
	.option('--port <port>', 'Server port', '3000')
	.action(async (directory: string | undefined, options) => {
		const serveCommand = new ServeCommand();
		const controlSetDir = directory || options.dir || './examples/nist-800-53-rev4';
		await serveCommand.run({
			dir: controlSetDir,
			port: parseInt(options.port)
		});
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
			const importCommand = new ImportCommand();
			await importCommand.run(
				{ source, outputDir },
				{
					overwrite: options.overwrite,
					dryRun: options.dryRun,
					preserveOscal: options.preserveOscal
				}
			);
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
			const statusCommand = new StatusCommand();
			await statusCommand.run({ directory: dir });
		} catch (error) {
			console.error('❌ Error analyzing control set:', error);
			process.exit(1);
		}
	});

// For backward compatibility, if no command is specified, run serve
const knownCommands = ['init', 'frameworks', 'serve', 'import', 'status'];
const hasKnownCommand = knownCommands.some((cmd) => process.argv.includes(cmd));
const hasHelpFlag = process.argv.includes('--help') || process.argv.includes('-h');

if ((process.argv.length === 2 || !hasKnownCommand) && !hasHelpFlag) {
	process.argv.splice(2, 0, 'serve');
}

program.parse();
