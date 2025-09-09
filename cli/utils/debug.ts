// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * Debug logging utility
 * Only outputs when DEBUG environment variable or --debug flag is set
 */

let debugEnabled = false;

export function setDebugMode(enabled: boolean): void {
	debugEnabled = enabled || process.env.DEBUG === 'true' || process.env.DEBUG === '1';
}

export function debug(...args: any[]): void {
	if (debugEnabled) {
		console.log('[DEBUG]', ...args);
	}
}

export function debugError(...args: any[]): void {
	if (debugEnabled) {
		console.error('[DEBUG ERROR]', ...args);
	}
}

export function isDebugEnabled(): boolean {
	return debugEnabled;
}
