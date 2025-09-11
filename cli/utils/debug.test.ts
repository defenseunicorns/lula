// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setDebugMode, debug, debugError, isDebugEnabled } from './debug';

describe('debug utility', () => {
	const originalDEBUG = process.env.DEBUG;
	let logSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		// reset env and state to a known baseline
		process.env.DEBUG = undefined;
		setDebugMode(false);

		logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
		errorSpy.mockRestore();
		process.env.DEBUG = originalDEBUG;
		process.env.DEBUG = undefined;
		setDebugMode(false);
	});

	it('does not log when disabled', () => {
		setDebugMode(false);
		expect(isDebugEnabled()).toBe(false);

		debug('a', 'b', 'c');
		debugError('x', 'y', 'z');

		expect(logSpy).not.toHaveBeenCalled();
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it('logs to console.log when enabled via setDebugMode(true)', () => {
		setDebugMode(true);
		expect(isDebugEnabled()).toBe(true);

		debug('hello', 42);
		expect(logSpy).toHaveBeenCalledTimes(1);
		expect(logSpy).toHaveBeenCalledWith('[DEBUG]', 'hello', 42);

		debugError('oops');
		expect(errorSpy).toHaveBeenCalledTimes(1);
		expect(errorSpy).toHaveBeenCalledWith('[DEBUG ERROR]', 'oops');
	});

	it('enables when DEBUG=1 in env even if setDebugMode(false) is called', () => {
		process.env.DEBUG = '1';
		setDebugMode(false);
		expect(isDebugEnabled()).toBe(true);

		debug('env-one');
		expect(logSpy).toHaveBeenCalledWith('[DEBUG]', 'env-one');
	});

	it('enables when DEBUG=true in env even if setDebugMode(false) is called', () => {
		process.env.DEBUG = 'true';
		setDebugMode(false);
		expect(isDebugEnabled()).toBe(true);

		debug('env-one');
		expect(logSpy).toHaveBeenCalledWith('[DEBUG]', 'env-one');
	});

	it('enables when DEBUG=true in env even if setDebugMode(false) is called', () => {
		process.env.DEBUG = 'true';
		setDebugMode(false);
		expect(isDebugEnabled()).toBe(true);

		debugError('env-true');
		expect(errorSpy).toHaveBeenCalledWith('[DEBUG ERROR]', 'env-true');
	});

	it('does not enable for other DEBUG values', () => {
		process.env.DEBUG = '0';
		setDebugMode(false);
		expect(isDebugEnabled()).toBe(false);

		debug('nope');
		debugError('still-nope');

		expect(logSpy).not.toHaveBeenCalled();
		expect(errorSpy).not.toHaveBeenCalled();
	});
});
