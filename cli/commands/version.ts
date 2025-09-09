// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Get the current version from package.json
 */
export function getVersion(): string {
	const __dirname = path.dirname(fileURLToPath(import.meta.url));
	// Try multiple paths to find package.json (for different build/run scenarios)
	const possiblePaths = [
		path.resolve(__dirname, '../../package.json'), // dev: cli/commands -> root
		path.resolve(__dirname, '../../../package.json'), // alt dev path
		path.resolve(__dirname, '../package.json'), // dist: dist/cli/commands -> dist -> root
		path.resolve(__dirname, './package.json'), // dist bundled
		path.resolve(process.cwd(), 'package.json') // current directory fallback
	];

	for (const pkgPath of possiblePaths) {
		if (fs.existsSync(pkgPath)) {
			const packageJson = fs.readFileSync(pkgPath, 'utf8');
			const { version } = JSON.parse(packageJson);
			return version;
		}
	}

	return 'unknown';
}
