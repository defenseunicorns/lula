#!/usr/bin/env node

import { program } from 'commander';
import { ServeCommand } from './cli/commands/serve';

// CLI setup
program
	.name('lula')
	.description('Lula - Git-friendly compliance control management')
	.version('2.0.0');

// Serve command - start the web server
program
	.command('serve [directory]')
	.description('Start the web server with control management and import wizard')
	.option('--dir <directory>', 'Control set directory path (alternative to positional argument)')
	.option('--port <port>', 'Server port', '3000')
	.option('--debug', 'Enable debug logging')
	.action(async (directory: string | undefined, options) => {
		// Set debug mode if flag is present
		const { setDebugMode } = await import('./cli/utils/debug');
		setDebugMode(options.debug || false);
		
		const serveCommand = new ServeCommand();
		const controlSetDir = directory || options.dir || process.cwd();
		await serveCommand.run({
			dir: controlSetDir,
			port: parseInt(options.port),
			openBrowser: false // Always open browser
		});
	});

// For backward compatibility, if no command is specified, run serve
const knownCommands = ['serve'];
const hasKnownCommand = knownCommands.some((cmd) => process.argv.includes(cmd));
const hasHelpFlag = process.argv.includes('--help') || process.argv.includes('-h');

if ((process.argv.length === 2 || !hasKnownCommand) && !hasHelpFlag) {
	process.argv.splice(2, 0, 'serve');
}

program.parse();
