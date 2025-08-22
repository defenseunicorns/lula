// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors
import cors from 'cors';
import express from 'express';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './apiRoutes.js';
import gitRoutes from './gitRoutes.js';
import { initializeServerState, loadAllData, saveMappingsToFile } from './serverState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ServerOptions {
  controlSetDir: string;
  port: number;
}

export async function createServer(options: ServerOptions) {
  const { controlSetDir, port } = options;

  // Ensure control set directory exists
  if (!existsSync(controlSetDir)) {
    mkdirSync(controlSetDir, { recursive: true });
  }

  // Initialize server state
  initializeServerState(controlSetDir);

  // Load all data into memory
  await loadAllData();

  // Create Express app
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Serve static files from dist directory (build output)
  const distPath = join(__dirname, '../../../dist');
  app.use(express.static(distPath));

  // API Routes
  app.use('/api', apiRoutes);
  app.use('/api', gitRoutes);

  // Serve frontend for all other routes (SPA fallback)
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });

  return {
    app,
    start: () => {
      return new Promise<void>((resolve) => {
        app.listen(port, () => {
          console.log(`Compliance Manager running on http://localhost:${port}`);
          console.log(`Control set directory: ${controlSetDir}`);
          console.log(`Using individual control files in: ${controlSetDir}/controls/`);
          resolve();
        });
      });
    }
  };
}

export async function startServer(controlSetDir: string, port: number) {
  const server = await createServer({ controlSetDir, port });
  await server.start();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nSaving any pending changes...');
    try {
      await saveMappingsToFile();
      console.log('All changes saved.');
    } catch (error) {
      console.error('Error saving changes:', error);
    }
    console.log('Shutdown complete.');
    process.exit(0);
  });
}
