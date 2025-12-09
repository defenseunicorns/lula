// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer, startServer } from './server';

type UseMiddleware = (mw: unknown, ...rest: unknown[]) => void;
type RouteHandler = (
	req: unknown,
	res: { sendFile: (file: string, opts: { root: string }) => void }
) => void;
type GetRoute = (path: string, handler: RouteHandler) => void;
type PostRoute = (path: string, handler: RouteHandler) => void;

type ExpressAppMock = {
	use: UseMiddleware;
	get: GetRoute;
	post: PostRoute;
};

type ExpressFactory = (() => ExpressAppMock) & {
	json: (opts: { limit: string }) => unknown;
	static: (dir: string) => unknown;
};

type ListenFn = (port: number, cb: () => void) => void;

type StdinRW = {
	isTTY?: boolean;
	setRawMode: (mode: boolean) => void;
	resume: () => void;
	setEncoding: (enc: string) => void;
	on: (event: string, handler: (chunk: unknown) => void) => unknown;
};

const h = vi.hoisted(() => {
	const mockServer = { listen: vi.fn<ListenFn>() };
	return {
		existsSync: vi.fn(),
		mkdirSync: vi.fn(),

		expressUse: vi.fn<UseMiddleware>(),
		expressGet: vi.fn<GetRoute>(),
		expressPost: vi.fn<PostRoute>(),
		expressJson: vi.fn<(opts: { limit: string }) => unknown>(),
		expressStatic: vi.fn<(dir: string) => unknown>(),

		cors: vi.fn<() => unknown>(() => 'cors-mw'),
		rateLimit: vi.fn<(_: { windowMs: number; max: number }) => unknown>(() => 'limiter-mw'),

		httpListen: mockServer.listen,
		httpServer: mockServer,

		initializeServerState: vi.fn<(dir: string) => void>(),
		loadAllData: vi.fn<() => Promise<void>>(),
		saveMappingsToFile: vi.fn<() => Promise<void>>(),

		spreadsheetRoutes: vi.fn<() => unknown>(() => 'routes-mw'),
		wsInitialize: vi.fn<(server: { listen: ListenFn }) => void>(),

		sigintHandler: undefined as undefined | (() => Promise<void> | void)
	};
});

vi.mock('fs', async (importOriginal) => {
	const actual = await importOriginal<typeof import('fs')>();
	return {
		...actual,
		default: {
			...actual,
			existsSync: h.existsSync,
			mkdirSync: h.mkdirSync
		},
		existsSync: h.existsSync,
		mkdirSync: h.mkdirSync
	};
});

vi.mock('express', () => {
	const app: ExpressAppMock = { use: h.expressUse, get: h.expressGet, post: h.expressPost };

	const expressFn = vi.fn(() => app) as unknown as ExpressFactory;

	h.expressJson.mockReturnValue('json-mw');
	h.expressStatic.mockReturnValue('static-mw');

	expressFn.json = h.expressJson;
	expressFn.static = h.expressStatic;

	return { default: expressFn };
});

vi.mock('cors', () => ({ default: h.cors }));
vi.mock('express-rate-limit', () => ({ default: h.rateLimit }));

vi.mock('http', async (importOriginal) => {
	const actual = await importOriginal<typeof import('http')>();
	return {
		...actual,
		default: {
			...actual,
			createServer: vi.fn(() => h.httpServer)
		},
		createServer: vi.fn(() => h.httpServer)
	};
});

vi.mock('./serverState', () => ({
	initializeServerState: h.initializeServerState,
	loadAllData: h.loadAllData,
	saveMappingsToFile: h.saveMappingsToFile
}));

vi.mock('./spreadsheetRoutes', () => ({ default: h.spreadsheetRoutes }));

vi.mock('./websocketServer', () => ({
	wsManager: { initialize: h.wsInitialize }
}));

describe('server', () => {
	let logSpy: ReturnType<typeof vi.spyOn>;

	let originalIsTTY: boolean | undefined;
	let originalSetRawMode: StdinRW['setRawMode'] | undefined;
	let originalResume: StdinRW['resume'] | undefined;
	let originalSetEncoding: StdinRW['setEncoding'] | undefined;
	let originalOn: StdinRW['on'] | undefined;

	let setRawModeSpy: ReturnType<typeof vi.spyOn> | undefined;
	let resumeSpy: ReturnType<typeof vi.spyOn> | undefined;
	let setEncodingSpy: ReturnType<typeof vi.spyOn> | undefined;
	let onSpy: ReturnType<typeof vi.spyOn> | undefined;

	let dataHandler: ((chunk: unknown) => void) | undefined;

	beforeEach(() => {
		vi.clearAllMocks();

		// Set default behaviors for fs mocks
		h.existsSync.mockReturnValue(true); // By default, directories exist
		h.mkdirSync.mockImplementation(() => undefined); // Mock mkdir to do nothing

		h.httpListen.mockImplementation((_port: number, cb: () => void) => cb());
		h.loadAllData.mockResolvedValue(undefined);
		logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined as unknown as void);
		vi.spyOn(process, 'on').mockImplementation(((
			event: string,
			handler: (..._a: unknown[]) => unknown
		) => {
			if (event === 'SIGINT') h.sigintHandler = handler as () => Promise<void> | void;
			return process;
		}) as unknown as typeof process.on);

		const stdin = process.stdin as unknown as StdinRW;

		originalIsTTY = stdin.isTTY;
		originalSetRawMode = stdin.setRawMode;
		originalResume = stdin.resume;
		originalSetEncoding = stdin.setEncoding;
		originalOn = stdin.on;

		if (typeof stdin.setRawMode !== 'function') stdin.setRawMode = () => {};
		if (typeof stdin.resume !== 'function') stdin.resume = () => {};
		if (typeof stdin.setEncoding !== 'function') stdin.setEncoding = () => {};
		if (typeof stdin.on !== 'function') stdin.on = (() => stdin) as StdinRW['on'];

		Object.defineProperty(stdin, 'isTTY', { configurable: true, value: true });

		setRawModeSpy = vi.spyOn(stdin, 'setRawMode').mockImplementation(() => {});
		resumeSpy = vi.spyOn(stdin, 'resume').mockImplementation(() => {});
		setEncodingSpy = vi.spyOn(stdin, 'setEncoding').mockImplementation(() => {});
		onSpy = vi.spyOn(stdin, 'on').mockImplementation(((
			event: string,
			handler: (chunk: unknown) => void
		) => {
			if (event === 'data') dataHandler = handler;
			return stdin;
		}) as StdinRW['on']);
	});

	afterEach(() => {
		const stdin = process.stdin as unknown as StdinRW;
		Object.defineProperty(stdin, 'isTTY', { configurable: true, value: originalIsTTY });
		if (setRawModeSpy) setRawModeSpy.mockRestore();
		if (resumeSpy) resumeSpy.mockRestore();
		if (setEncodingSpy) setEncodingSpy.mockRestore();
		if (onSpy) onSpy.mockRestore();
		if (originalSetRawMode) stdin.setRawMode = originalSetRawMode;
		if (originalResume) stdin.resume = originalResume;
		if (originalSetEncoding) stdin.setEncoding = originalSetEncoding;
		if (originalOn) stdin.on = originalOn;

		logSpy.mockRestore();
	});

	it('startServer logs error when saveMappingsToFile fails in ESC/Ctrl+C data handler', async () => {
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('exit');
		});

		h.httpListen.mockImplementation((_p: number, cb: () => void) => cb());
		await startServer({ controlSetDir: '/ctrl', port: 3040 });
		const escErr = new Error('boom-esc');
		h.saveMappingsToFile.mockRejectedValueOnce(escErr);

		try {
			await (typeof dataHandler === 'function' ? dataHandler('\u001b') : Promise.resolve());
		} catch (e) {
			expect((e as Error).message).toBe('exit');
		}

		expect(errSpy).toHaveBeenCalledWith('Error saving changes:', escErr);
		expect(exitSpy).toHaveBeenCalledWith(0);

		errSpy.mockRestore();
		exitSpy.mockRestore();
	});

	it('startServer logs error when saveMappingsToFile fails on SIGINT', async () => {
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('exit');
		});

		h.httpListen.mockImplementation((_p: number, cb: () => void) => cb());
		await startServer({ controlSetDir: '/ctrl', port: 3041 });

		const sigErr = new Error('boom-sigint');
		h.saveMappingsToFile.mockRejectedValueOnce(sigErr);

		try {
			await h.sigintHandler?.();
		} catch (e) {
			expect((e as Error).message).toBe('exit');
		}

		expect(errSpy).toHaveBeenCalledWith('Error saving changes:', sigErr);
		expect(exitSpy).toHaveBeenCalledWith(0);

		errSpy.mockRestore();
		exitSpy.mockRestore();
	});

	it('startServer data handler ignores non-ESC / non-Ctrl+C keys (no save or exit)', async () => {
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('exit');
		});
		h.httpListen.mockImplementation((_p: number, cb: () => void) => cb());

		await startServer({ controlSetDir: '/ctrl', port: 3050 });

		await (typeof dataHandler === 'function' ? dataHandler('x') : Promise.resolve());

		expect(h.saveMappingsToFile).not.toHaveBeenCalled();
		expect(exitSpy).not.toHaveBeenCalled();

		exitSpy.mockRestore();
	});

	it('createServer wires app, middleware, static, routes, ws; start() listens', async () => {
		h.existsSync.mockReturnValue(true);

		const srv = await createServer({ controlSetDir: '/ctrl', port: 4321 });
		expect(h.existsSync).toHaveBeenCalledWith('/ctrl');
		expect(h.mkdirSync).not.toHaveBeenCalled();

		expect(h.initializeServerState).toHaveBeenCalledWith('/ctrl');
		expect(h.loadAllData).toHaveBeenCalledTimes(1);

		expect(h.cors).toHaveBeenCalled();
		expect(h.expressUse).toHaveBeenCalledWith('cors-mw');

		expect(h.expressJson).toHaveBeenCalledWith({ limit: '50mb' });
		expect(h.expressUse).toHaveBeenCalledWith('json-mw');

		expect(h.rateLimit).toHaveBeenCalledWith({
			windowMs: 15 * 60 * 1000,
			max: 200
		});
		expect(h.expressUse).toHaveBeenCalledWith('limiter-mw');

		expect(h.expressStatic).toHaveBeenCalled();
		expect(h.expressUse).toHaveBeenCalledWith('static-mw');

		expect(h.expressUse).toHaveBeenCalledWith('/api', h.spreadsheetRoutes);
		expect(h.spreadsheetRoutes).not.toHaveBeenCalled();

		expect(h.expressGet).toHaveBeenCalledTimes(1);
		const [route, handlerUnknown] = h.expressGet.mock.calls[0] as [string, RouteHandler];
		expect(route).toBe('/*splat');

		const res = { sendFile: vi.fn<(file: string, opts: { root: string }) => void>() };
		const handler = handlerUnknown as RouteHandler;
		await handler({}, res);
		expect(res.sendFile).toHaveBeenCalledWith('index.html', { root: expect.any(String) });

		expect(h.wsInitialize).toHaveBeenCalledWith(
			expect.objectContaining({
				listen: expect.any(Function)
			})
		);

		await srv.start();
		expect(h.httpListen).toHaveBeenCalledWith(4321, expect.any(Function));
		expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/http:\/\/localhost:4321/));
	});

	it('createServer creates the directory if missing', async () => {
		h.existsSync.mockReturnValue(false);

		await createServer({ controlSetDir: '/newdir', port: 9999 });

		expect(h.existsSync).toHaveBeenCalledWith('/newdir');
		expect(h.mkdirSync).toHaveBeenCalledWith('/newdir', { recursive: true });
	});

	it('startServer wires TTY hotkeys and SIGINT; saves then exits', async () => {
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('exit');
		});

		h.saveMappingsToFile.mockResolvedValue(undefined);
		h.httpListen.mockImplementation((_port: number, cb: () => void) => cb());

		await startServer({ controlSetDir: '/ctrl', port: 3000 });

		expect(setRawModeSpy).toHaveBeenCalledWith(true);
		expect(resumeSpy).toHaveBeenCalled();
		expect(setEncodingSpy).toHaveBeenCalledWith('utf8');
		expect(onSpy).toHaveBeenCalledWith('data', expect.any(Function));

		try {
			await (typeof dataHandler === 'function' ? dataHandler('\u001b') : Promise.resolve());
		} catch (e) {
			expect((e as Error).message).toBe('exit');
		}
		expect(h.saveMappingsToFile).toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(0);

		try {
			await h.sigintHandler?.();
		} catch (e) {
			expect((e as Error).message).toBe('exit');
		}
		expect(h.saveMappingsToFile).toHaveBeenCalledTimes(2);
		expect(exitSpy).toHaveBeenCalledWith(0);

		exitSpy.mockRestore();
	});
});
