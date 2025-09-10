// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('getVersion', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('returns version when ../package.json exists', async () => {
		vi.doMock('fs', () => {
			return {
				default: {
					existsSync: vi.fn().mockReturnValue(true),
					readFileSync: vi.fn().mockReturnValue(JSON.stringify({ version: '1.2.3' }))
				}
			};
		});

		const { getVersion } = await import('./version');
		expect(getVersion()).toBe('1.2.3');
	});

	it('falls back to ../../package.json when ../package.json does not exist', async () => {
		vi.doMock('fs', () => {
			return {
				default: {
					existsSync: vi.fn().mockReturnValue(false),
					readFileSync: vi.fn().mockReturnValue(JSON.stringify({ version: '9.9.9' }))
				}
			};
		});

		const { getVersion } = await import('./version');
		expect(getVersion()).toBe('9.9.9');
	});
});
