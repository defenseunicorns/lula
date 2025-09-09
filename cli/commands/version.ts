// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Get the current version from package.json
 *
 * @returns The current version
 */
export function getVersion() {
	const pkgPath = path.resolve(__dirname, '../package.json'); // adjust path if index.ts is in src/
	const packageJson = fs.readFileSync(pkgPath, 'utf8');
	const { version } = JSON.parse(packageJson);
	return version;
}
