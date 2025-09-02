import { existsSync } from 'fs';
import open from 'open';
import { join } from 'path';
import { startServer } from '..';

export interface ServeOptions {
	dir: string;
	port: number;
	openBrowser?: boolean;
}

export class ServeCommand {
	async run(options: ServeOptions): Promise<void> {
		const { dir, port, openBrowser } = options;

		// Check if lula.yaml exists in the directory
		const controlSetPath = join(dir, 'lula.yaml');
		const hasControlSet = existsSync(controlSetPath);

		// Start server with wizard mode if no control set exists
		await startServer(dir, port, { wizardMode: !hasControlSet });

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
