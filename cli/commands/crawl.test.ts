// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as crypto from 'crypto';
import fs from 'fs';
import { Octokit } from '@octokit/rest';
import {
	getPRContext,
	fetchRawFileViaAPI,
	extractMapBlocks,
	getChangedBlocks,
	crawlCommand
} from './crawl';

vi.mock('fs', () => {
	const readFileSync = vi.fn();
	return { default: { readFileSync } };
});

const pullsGet = vi.fn();
const pullsListFiles = vi.fn();
const reposGetContent = vi.fn();
const issuesCreateComment = vi.fn();

const mockOctokitInstance = {
	pulls: { get: pullsGet, listFiles: pullsListFiles },
	repos: { getContent: reposGetContent },
	issues: { createComment: issuesCreateComment }
};

vi.mock('@octokit/rest', () => {
	const Octokit = vi.fn().mockImplementation(() => mockOctokitInstance);
	return { Octokit };
});
const fsMock = fs as unknown as { readFileSync: ReturnType<typeof vi.fn> };

const originalEnv = { ...process.env };
const resetEnv = () => {
	process.env = { ...originalEnv };
	delete process.env.GITHUB_EVENT_PATH;
	delete process.env.GITHUB_REPOSITORY;
	delete process.env.OWNER;
	delete process.env.REPO;
	delete process.env.PULL_NUMBER;
	delete process.env.GITHUB_TOKEN;
};

beforeEach(() => {
	vi.clearAllMocks();
	resetEnv();
});
afterEach(() => {
	resetEnv();
});

describe('getPRContext', () => {
	it('throws error if required env vars are missing (no event payload, no fallbacks)', () => {
		expect(() => getPRContext()).toThrow(
			'Set OWNER, REPO, and PULL_NUMBER in the environment for local use.'
		);
	});

	it('reads from GitHub event payload when GITHUB_EVENT_PATH and GITHUB_REPOSITORY are set', () => {
		process.env.GITHUB_EVENT_PATH = '/path/to/event.json';
		process.env.GITHUB_REPOSITORY = 'octo-org/octo-repo';
		fsMock.readFileSync.mockReturnValueOnce(JSON.stringify({ pull_request: { number: 42 } }));

		const ctx = getPRContext();
		expect(ctx).toEqual({ owner: 'octo-org', repo: 'octo-repo', pull_number: 42 });
		expect(fsMock.readFileSync).toHaveBeenCalledWith('/path/to/event.json', 'utf8');
	});

	it('throws when GitHub event payload lacks PR number', () => {
		process.env.GITHUB_EVENT_PATH = '/path/to/event.json';
		process.env.GITHUB_REPOSITORY = 'octo-org/octo-repo';
		fsMock.readFileSync.mockReturnValueOnce(JSON.stringify({ pull_request: {} }));

		expect(() => getPRContext()).toThrow('PR number not found in GitHub event payload.');
	});

	it('falls back to OWNER/REPO/PULL_NUMBER env vars when event payload is absent', () => {
		process.env.OWNER = 'me';
		process.env.REPO = 'mine';
		process.env.PULL_NUMBER = '123';

		const ctx = getPRContext();
		expect(ctx).toEqual({ owner: 'me', repo: 'mine', pull_number: 123 });
	});
});

describe('fetchRawFileViaAPI', () => {
	it('returns string data directly when GitHub API returns raw string', async () => {
		const octokit = new Octokit();
		reposGetContent.mockResolvedValueOnce({ data: 'plain text file content' });

		const out = await fetchRawFileViaAPI({
			octokit,
			owner: 'o',
			repo: 'r',
			path: 'p.txt',
			ref: 'main'
		});

		expect(out).toBe('plain text file content');
		expect(reposGetContent).toHaveBeenCalledWith({
			owner: 'o',
			repo: 'r',
			path: 'p.txt',
			ref: 'main',
			headers: { accept: 'application/vnd.github.v3.raw' }
		});
	});

	it('decodes base64 when GitHub API returns a content object', async () => {
		const octokit = new Octokit();
		const content = Buffer.from('decoded content here', 'utf8').toString('base64');
		reposGetContent.mockResolvedValueOnce({ data: { content } });

		const out = await fetchRawFileViaAPI({
			octokit,
			owner: 'o',
			repo: 'r',
			path: 'p.txt',
			ref: 'main'
		});

		expect(out).toBe('decoded content here');
	});

	it('throws on unexpected shape', async () => {
		const octokit = new Octokit();
		reposGetContent.mockResolvedValueOnce({ data: { weird: true } });

		await expect(
			fetchRawFileViaAPI({
				octokit,
				owner: 'o',
				repo: 'r',
				path: 'p.txt',
				ref: 'main'
			})
		).rejects.toThrow('Unexpected GitHub API response shape');
	});
});

describe('extractMapBlocks & getChangedBlocks', () => {
	const uuid = '123e4567-e89b-12d3-a456-426614174000';
	const oldText = [
		'header',
		`// @lulaStart ${uuid}`,
		'old line',
		`// @lulaEnd ${uuid}`,
		'footer'
	].join('\n');

	const newTextChanged = [
		'header',
		`// @lulaStart ${uuid}`,
		'new line changed',
		`// @lulaEnd ${uuid}`,
		'footer'
	].join('\n');

	const newTextUnchanged = oldText;

	it('extracts blocks with correct line ranges', () => {
		const blocks = extractMapBlocks(oldText);
		expect(blocks).toHaveLength(1);
		const [b] = blocks;
		expect(b.startLine).toBe(1);
		expect(b.endLine).toBe(4);
		expect(b.uuid).toBe(uuid);
	});

	it('detects changes in blocks between texts', () => {
		const changed = getChangedBlocks(oldText, newTextChanged);
		expect(changed).toHaveLength(1);
		expect(changed[0].uuid).toBe(uuid);

		const unchanged = getChangedBlocks(oldText, newTextUnchanged);
		expect(unchanged).toHaveLength(0);
	});

	it('skips new blocks that have no matching old block (no oldMatch)', () => {
		const uuid = '123e4567-e89b-12d3-a456-426614174000';
		const oldText = 'header\nfooter';
		const newText = [
			'header',
			`// @lulaStart ${uuid}`,
			'new content',
			`// @lulaEnd ${uuid}`,
			'footer'
		].join('\n');

		const changed = getChangedBlocks(oldText, newText);
		expect(changed).toHaveLength(0);
	});
});

describe('crawl command (integration)', () => {
	it('comments only for changed blocks, skips added files, and handles errors', async () => {
		process.env.OWNER = 'octo-org';
		process.env.REPO = 'octo-repo';
		process.env.PULL_NUMBER = '77';
		process.env.GITHUB_TOKEN = 'test-token';

		pullsGet.mockResolvedValueOnce({ data: { head: { ref: 'feature-branch' } } });

		pullsListFiles.mockResolvedValueOnce({
			data: [
				{ filename: 'src/file1.txt', status: 'modified' },
				{ filename: 'src/added.txt', status: 'added' },
				{ filename: 'src/broken.txt', status: 'modified' }
			]
		});

		const uuid = '123e4567-e89b-12d3-a456-426614174000';
		const oldText = [
			'header',
			`// @lulaStart ${uuid}`,
			'old line',
			`// @lulaEnd ${uuid}`,
			'footer'
		].join('\n');

		const newText = [
			'header',
			`// @lulaStart ${uuid}`,
			'new line changed',
			`// @lulaEnd ${uuid}`,
			'footer'
		].join('\n');

		reposGetContent.mockImplementation(({ path, ref }) => {
			if (path === 'src/file1.txt' && ref === 'main') return Promise.resolve({ data: oldText });
			if (path === 'src/file1.txt' && ref === 'feature-branch') {
				const content = Buffer.from(newText, 'utf8').toString('base64');
				return Promise.resolve({ data: { content } });
			}
			if (path === 'src/broken.txt') return Promise.reject(new Error('Fetch failed'));
			throw new Error(`Unexpected getContent call for ${path} @ ${ref}`);
		});

		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const command = crawlCommand();

		await command.parseAsync([], { from: 'user' });

		expect(issuesCreateComment).toHaveBeenCalledTimes(1);
		const call = issuesCreateComment.mock.calls[0][0];

		expect(call.owner).toBe('octo-org');
		expect(call.repo).toBe('octo-repo');
		expect(call.issue_number).toBe(77);

		const changedBlockText = [
			`// @lulaStart ${uuid}`,
			'new line changed',
			`// @lulaEnd ${uuid}`
		].join('\n');
		const expectedSha = crypto.createHash('sha256').update(changedBlockText).digest('hex');

		expect(call.body).toContain('**Compliance Alert**:');
		expect(call.body).toContain('src/file1.txt');
		expect(call.body).toMatch(/lines 2–4\./);
		expect(call.body).toContain(`UUID \`${uuid}\``);
		expect(call.body).toContain(expectedSha);

		const fetchedPaths = reposGetContent.mock.calls.map((c) => c[0].path);
		expect(fetchedPaths).not.toContain('src/added.txt');

		expect(errSpy).toHaveBeenCalled();
		const errMsgs = errSpy.mock.calls.map((c) => c[0] as string);
		expect(errMsgs.some((m) => m.includes('Error processing src/broken.txt'))).toBe(true);

		logSpy.mockRestore();
		errSpy.mockRestore();
	});
});
