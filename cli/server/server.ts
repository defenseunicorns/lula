// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import cors from 'cors';
import express from 'express';
import ratelimit from 'express-rate-limit';
import { existsSync, mkdirSync } from 'fs';
import { createServer as createHttpServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializeServerState, loadAllData, saveMappingsToFile } from './serverState';
import spreadsheetRoutes from './spreadsheetRoutes';
import { wsManager } from './websocketServer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ServerOptions {
	controlSetDir: string;
	port: number;
}

export async function createServer(options: ServerOptions): Promise<{
	app: express.Application;
	start: () => Promise<void>;
}> {
	const { controlSetDir, port } = options;

	// Ensure control set directory exists
	if (!existsSync(controlSetDir)) {
		mkdirSync(controlSetDir, { recursive: true });
	}
	const limiter = ratelimit({
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 200 // max requests per windowMs
	});
	// Initialize server state
	initializeServerState(controlSetDir);

	// Load all data into memory
	await loadAllData();

	// Create Express app
	const app = express();

	// Middleware
	app.use(cors());
	app.use(express.json({ limit: '50mb' }));
	app.use(limiter);

	// Serve static files from dist directory (build output)
	const distPath = join(__dirname, '../dist');
	app.use(express.static(distPath));

	// API Routes
	app.use('/api', spreadsheetRoutes);

	// Serve frontend for all other routes (SPA fallback)
	app.get('/*splat', (req, res) => {
		res.sendFile(join(distPath, 'index.html'));
	});

	// Create HTTP server for both Express and WebSocket
	const httpServer = createHttpServer(app);

	// Initialize WebSocket server
	wsManager.initialize(httpServer);

	return {
		app,
		start: () => {
			return new Promise<void>((resolve) => {
				httpServer.listen(port, () => {
					console.log(`\n✨ Lula is running at http://localhost:${port}`);
					resolve();
				});
			});
		}
	};
}

export async function startServer(options: ServerOptions) {
	const server = await createServer(options);
	await server.start();

	// Set up keyboard input handling
	if (process.stdin.isTTY) {
		process.stdin.setRawMode(true);
		process.stdin.resume();
		process.stdin.setEncoding('utf8');

		console.log('\nPress ESC to close the app\n');

		process.stdin.on('data', async (key) => {
			const keyStr = key.toString();
			// ESC key or Ctrl+C
			if (keyStr === '\u001b' || keyStr === '\u0003') {
				console.log('\n\nShutting down server...');
				try {
					await saveMappingsToFile();
					console.log('Changes saved successfully');
				} catch (error) {
					console.error('Error saving changes:', error);
				}
				process.exit(0);
			}
		});
	}

	// Graceful shutdown
	process.on('SIGINT', async () => {
		try {
			await saveMappingsToFile();
		} catch (error) {
			console.error('Error saving changes:', error);
		}
		process.exit(0);
	});
}
