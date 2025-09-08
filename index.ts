#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crawl from './cli/commands/crawl';
import { ServeCommand } from './cli/commands/serve';

const program = new Command();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Get the current version from package.json
 *
 * @returns The current version
 */
export function getVersion() {
	// Try to find package.json in current dir or parent dir (for dist builds)
	let pkgPath = path.resolve(__dirname, 'package.json');
	if (!fs.existsSync(pkgPath)) {
		pkgPath = path.resolve(__dirname, '..', 'package.json');
	}
	const packageJson = fs.readFileSync(pkgPath, 'utf8');
	const { version } = JSON.parse(packageJson);
	return version;
}

program
	.name('lula2')
	.description('Lula - Git-friendly compliance control management')
	.version(getVersion(), '-v, --version', 'output the current version')
	.option('--dir <directory>', 'Control set directory path')
	.option('--port <port>', 'Server port', '3000')
	.option('--debug', 'Enable debug logging')
	.option('--open-browser', 'Open browser when starting the server', true)
	.addCommand(crawl())
	.action(async (options) => {
		// Set debug mode if flag is present
		const { setDebugMode } = await import('./cli/utils/debug');
		setDebugMode(options.debug || false);

		const serveCommand = new ServeCommand();
		const controlSetDir = options.dir || process.cwd();
		await serveCommand.run({
			dir: controlSetDir,
			port: parseInt(options.port),
			openBrowser: options.openBrowser
		});
	});

program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(1).length) {
	program.help();
}
