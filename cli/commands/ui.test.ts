// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import * as fs from 'fs';
import open from 'open';
import * as server from '../server';
import * as debug from '../utils/debug';
import { UICommand } from './ui';

vi.mock('fs', () => ({ existsSync: vi.fn() }));
vi.mock('open', () => ({ default: vi.fn() }));
vi.mock('path', () => ({ join: (...parts: string[]) => parts.join('/') }));
vi.mock('../server', () => ({ startServer: vi.fn() }));
vi.mock('../utils/debug', () => ({ setDebugMode: vi.fn() }));

const existsSync = fs.existsSync as unknown as ReturnType<typeof vi.fn>;
const openMock = open as unknown as ReturnType<typeof vi.fn>;
const startServer = server.startServer as unknown as ReturnType<typeof vi.fn>;
const setDebugMode = debug.setDebugMode as unknown as ReturnType<typeof vi.fn>;

describe('UICommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('runs with existing lula.yaml and opens base URL', async () => {
		existsSync.mockReturnValue(true);

		const program = new Command();
		UICommand.register(program, () => false);

		await program.parseAsync(['ui', '--dir', '/my/dir', '--port', '4000'], { from: 'user' });

		expect(startServer).toHaveBeenCalledWith({ controlSetDir: '/my/dir', port: 4000 });
		expect(openMock).toHaveBeenCalledWith('http://localhost:4000');
	});

	it('runs with no lula.yaml and opens setup URL', async () => {
		existsSync.mockReturnValue(false);

		const program = new Command();
		UICommand.register(program, () => false);

		await program.parseAsync(['ui', '--dir', '/empty/dir', '--port', '1234'], { from: 'user' });

		expect(startServer).toHaveBeenCalledWith({ controlSetDir: '/empty/dir', port: 1234 });
		expect(openMock).toHaveBeenCalledWith('http://localhost:1234/setup');
	});
	it('defaults to process.cwd() when --dir is not provided', async () => {
		existsSync.mockReturnValue(true);

		const program = new Command();
		UICommand.register(program, () => false);

		const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/fake/cwd');

		await program.parseAsync(['ui', '--port', '9999'], { from: 'user' });

		expect(startServer).toHaveBeenCalledWith({ controlSetDir: '/fake/cwd', port: 9999 });
		cwdSpy.mockRestore();
	});
	it('skips opening browser when --no-open-browser is passed', async () => {
		existsSync.mockReturnValue(true);

		const program = new Command();
		UICommand.register(program, () => false);

		await program.parseAsync(['ui', '--dir', '/nobrowser', '--no-open-browser'], { from: 'user' });

		expect(startServer).toHaveBeenCalled();
		expect(openMock).not.toHaveBeenCalled();
	});

	it('enables debug mode when parentDebugGetter returns true', async () => {
		existsSync.mockReturnValue(true);

		const program = new Command();
		UICommand.register(program, () => true);

		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		await program.parseAsync(['ui', '--dir', '/debug'], { from: 'user' });

		expect(setDebugMode).toHaveBeenCalledWith(true);
		expect(logSpy).toHaveBeenCalledWith('Debug mode enabled');

		logSpy.mockRestore();
	});
});
