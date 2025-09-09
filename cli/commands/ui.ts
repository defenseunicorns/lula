// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import type { Command } from 'commander';
import { existsSync } from 'fs';
import open from 'open';
import { join } from 'path';
import { startServer } from '../server';

export interface UIOptions {
	dir: string;
	port: number;
	openBrowser?: boolean;
}

export class UICommand {
	/**
	 * Register the serve command with Commander
	 * @param program The Commander program instance
	 * @param parentDebugGetter Function to get debug flag from parent command
	 */
	static register(program: Command, parentDebugGetter: () => boolean): Command {
		return program
			.command('ui', { isDefault: true })
			.description('Start the Lula web interface (default)')
			.option('--dir <directory>', 'Control set directory path')
			.option('--port <port>', 'Server port', '3000')
			.option('--no-open-browser', 'Do not open browser when starting the server')
			.action(async (options) => {
				// Set debug mode if flag is present from parent command
				if (parentDebugGetter()) {
					console.log('Debug mode enabled');
					const { setDebugMode } = await import('../utils/debug');
					setDebugMode(true);
				}

				const uiCommand = new UICommand();
				const controlSetDir = options.dir || process.cwd();
				await uiCommand.run({
					dir: controlSetDir,
					port: parseInt(options.port),
					openBrowser: options.openBrowser !== false // Default to true unless explicitly disabled
				});
			});
	}

	async run(options: UIOptions): Promise<void> {
		const { dir, port, openBrowser } = options;

		// Check if lula.yaml exists in the directory
		const controlSetPath = join(dir, 'lula.yaml');
		const hasControlSet = existsSync(controlSetPath);

		// Start server with wizard mode if no control set exists
		await startServer({ controlSetDir: dir, port });

		// Open browser if requested
		if (openBrowser) {
			const url = `http://localhost:${port}`;
			if (!hasControlSet) {
				// Open directly to the setup wizard
				await open(`${url}/setup`);
			} else {
				await open(url);
			}
		}
	}
}
