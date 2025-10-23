// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs before importing the module
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock('fs', () => ({
	default: {
		existsSync: mockExistsSync,
		readFileSync: mockReadFileSync
	}
}));

describe('getVersion', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	it('returns version when ../package.json exists', async () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.2.3' }));

		const { getVersion } = await import('./version');
		expect(getVersion()).toBe('1.2.3');
	});

	it('falls back to ../../package.json when ../package.json does not exist', async () => {
		mockExistsSync.mockReturnValueOnce(false).mockReturnValue(true);
		mockReadFileSync.mockReturnValue(JSON.stringify({ version: '9.9.9' }));

		const { getVersion } = await import('./version');
		expect(getVersion()).toBe('9.9.9');
	});
});
