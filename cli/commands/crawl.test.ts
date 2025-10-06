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
	getRemovedBlocks,
	crawlCommand,
	postFinding,
	deleteOldIssueComments,
	deleteOldReviewComments,
	dismissOldReviews,
	containsLulaAnnotations,
	LULA_SIGNATURE
} from './crawl';

// ---- fs mock ----
vi.mock('fs', () => {
	const readFileSync = vi.fn();
	return { default: { readFileSync } };
});
const fsMock = fs as unknown as { readFileSync: ReturnType<typeof vi.fn> };

// ---- Octokit mocks ----
const pullsGet = vi.fn();
const pullsListFiles = vi.fn();
const pullsCreateReview = vi.fn();
const pullsListReviewComments = vi.fn();
const pullsDeleteReviewComment = vi.fn();
const pullsListReviews = vi.fn();
const pullsDismissReview = vi.fn();

const reposGetContent = vi.fn();

const issuesCreateComment = vi.fn();
const issuesListComments = vi.fn();
const issuesDeleteComment = vi.fn();

const mockOctokitInstance = {
	pulls: {
		get: pullsGet,
		listFiles: pullsListFiles,
		createReview: pullsCreateReview,
		listReviewComments: pullsListReviewComments,
		deleteReviewComment: pullsDeleteReviewComment,
		listReviews: pullsListReviews,
		dismissReview: pullsDismissReview
	},
	repos: { getContent: reposGetContent },
	issues: {
		createComment: issuesCreateComment,
		listComments: issuesListComments,
		deleteComment: issuesDeleteComment
	}
};

vi.mock('@octokit/rest', () => {
	const Octokit = vi.fn().mockImplementation(() => mockOctokitInstance);
	return { Octokit };
});

// ---- env helpers ----
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

// ---- log mocks ----
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	vi.clearAllMocks();

	// defaults so loops terminate (intentionally no default for pullsListReviewComments)
	issuesListComments.mockResolvedValue({ data: [] });
	issuesDeleteComment.mockResolvedValue({});

	pullsDeleteReviewComment.mockResolvedValue({});
	pullsListReviews.mockResolvedValue({ data: [] });
	pullsDismissReview.mockResolvedValue({});

	pullsGet.mockResolvedValue({ data: { head: { ref: 'main' } } });
	pullsListFiles.mockResolvedValue({ data: [] });

	reposGetContent.mockResolvedValue({ data: '' });

	// silence console output during tests
	logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
	errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

	resetEnv();
});

afterEach(() => {
	logSpy.mockRestore();
	errSpy.mockRestore();
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

describe('getRemovedBlocks', () => {
	it('detects blocks that exist in old text but not in new text', () => {
		const uuid1 = '123e4567-e89b-12d3-a456-426614174000';
		const uuid2 = '987fcdeb-51a2-43d1-b789-456789012345';

		const oldText = [
			'header',
			`// @lulaStart ${uuid1}`,
			'old content 1',
			`// @lulaEnd ${uuid1}`,
			'middle',
			`// @lulaStart ${uuid2}`,
			'old content 2',
			`// @lulaEnd ${uuid2}`,
			'footer'
		].join('\n');

		const newText = [
			'header',
			`// @lulaStart ${uuid1}`,
			'new content 1',
			`// @lulaEnd ${uuid1}`,
			'middle',
			'footer'
		].join('\n');

		const removed = getRemovedBlocks(oldText, newText);
		expect(removed).toHaveLength(1);
		expect(removed[0].uuid).toBe(uuid2);
		expect(removed[0].startLine).toBe(5);
		expect(removed[0].endLine).toBe(8);
	});

	it('returns empty array when no blocks are removed', () => {
		const uuid = '123e4567-e89b-12d3-a456-426614174000';

		const oldText = [
			'header',
			`// @lulaStart ${uuid}`,
			'old content',
			`// @lulaEnd ${uuid}`,
			'footer'
		].join('\n');

		const newText = [
			'header',
			`// @lulaStart ${uuid}`,
			'new content',
			`// @lulaEnd ${uuid}`,
			'footer'
		].join('\n');

		const removed = getRemovedBlocks(oldText, newText);
		expect(removed).toHaveLength(0);
	});

	it('detects all removed blocks when old text has annotations but new text has none', () => {
		const uuid1 = '123e4567-e89b-12d3-a456-426614174000';
		const uuid2 = '987fcdeb-51a2-43d1-b789-456789012345';

		const oldText = [
			'header',
			`// @lulaStart ${uuid1}`,
			'content 1',
			`// @lulaEnd ${uuid1}`,
			'middle',
			`// @lulaStart ${uuid2}`,
			'content 2',
			`// @lulaEnd ${uuid2}`,
			'footer'
		].join('\n');

		const newText = ['header', 'middle', 'footer'].join('\n');

		const removed = getRemovedBlocks(oldText, newText);
		expect(removed).toHaveLength(2);
		expect(removed.map((b) => b.uuid)).toContain(uuid1);
		expect(removed.map((b) => b.uuid)).toContain(uuid2);
	});
});

// ---- cleanup helpers (unit tests) ----
describe('cleanup helpers', () => {
	it('deleteOldIssueComments deletes only the first signed comment per page', async () => {
		const octokit = new Octokit();
		issuesListComments
			.mockResolvedValueOnce({
				data: [
					{ id: 1, body: `${LULA_SIGNATURE}\nSigned A` },
					{ id: 2, body: 'Not signed' },
					{ id: 3, body: `${LULA_SIGNATURE}\nSigned B` }
				]
			})
			.mockResolvedValueOnce({ data: [] }); // end pages

		await deleteOldIssueComments({ octokit, owner: 'o', repo: 'r', pull_number: 7 });

		expect(issuesDeleteComment).toHaveBeenCalledTimes(1);
		expect(issuesDeleteComment).toHaveBeenNthCalledWith(1, {
			owner: 'o',
			repo: 'r',
			comment_id: 1
		});
	});

	it('deleteOldReviewComments deletes only the first signed review comment per page', async () => {
		const octokit = new Octokit();

		// two pages: one with data, one empty
		pullsListReviewComments
			.mockResolvedValueOnce({
				data: [
					{ id: 11, body: `${LULA_SIGNATURE}\nRC A` },
					{ id: 12, body: 'other' },
					{ id: 13, body: `${LULA_SIGNATURE}\nRC B` }
				]
			})
			.mockResolvedValueOnce({ data: [] });

		await deleteOldReviewComments({ octokit, owner: 'o', repo: 'r', pull_number: 8 });

		expect(pullsDeleteReviewComment).toHaveBeenCalledTimes(1);
		expect(pullsDeleteReviewComment).toHaveBeenNthCalledWith(1, {
			owner: 'o',
			repo: 'r',
			comment_id: 11
		});
	});

	it('dismissOldReviews dismisses only the first signed review per page (handles null bodies)', async () => {
		const octokit = new Octokit();
		pullsListReviews
			.mockResolvedValueOnce({
				data: [
					{ id: 21, body: `${LULA_SIGNATURE}\nReview A` },
					{ id: 22, body: null },
					{ id: 23, body: 'not signed' },
					{ id: 24, body: `${LULA_SIGNATURE}\nReview B` }
				]
			})
			.mockResolvedValueOnce({ data: [] });

		await dismissOldReviews({ octokit, owner: 'o', repo: 'r', pull_number: 9 });

		expect(pullsDismissReview).toHaveBeenCalledTimes(1);
		expect(pullsDismissReview).toHaveBeenNthCalledWith(1, {
			owner: 'o',
			repo: 'r',
			pull_number: 9,
			review_id: 21,
			message: 'Superseded by a new Lula compliance review.'
		});
	});
});

// ---- cleanup helpers (null/undefined body edge cases to cover ?? checks) ----
describe('cleanup helpers (null/undefined body edge cases)', () => {
	it('deleteOldIssueComments skips when body is null (covers (c.body ?? ""))', async () => {
		const octokit = new Octokit();
		issuesListComments
			.mockResolvedValueOnce({ data: [{ id: 1, body: null }] })
			.mockResolvedValueOnce({ data: [] });

		await deleteOldIssueComments({ octokit, owner: 'o', repo: 'r', pull_number: 10 });

		expect(issuesDeleteComment).not.toHaveBeenCalled();
	});

	it('deleteOldReviewComments skips when body is undefined (covers (rc.body ?? ""))', async () => {
		const octokit = new Octokit();
		pullsListReviewComments
			.mockResolvedValueOnce({ data: [{ id: 2, body: undefined }] })
			.mockResolvedValueOnce({ data: [] });

		await deleteOldReviewComments({ octokit, owner: 'o', repo: 'r', pull_number: 11 });

		expect(pullsDeleteReviewComment).not.toHaveBeenCalled();
	});

	it('dismissOldReviews skips when body is null (covers (r.body ?? ""))', async () => {
		const octokit = new Octokit();
		pullsListReviews
			.mockResolvedValueOnce({ data: [{ id: 3, body: null }] })
			.mockResolvedValueOnce({ data: [] });

		await dismissOldReviews({ octokit, owner: 'o', repo: 'r', pull_number: 12 });

		expect(pullsDismissReview).not.toHaveBeenCalled();
	});
});

describe('crawl command (integration)', () => {
	it('detects deleted files with Lula annotations and adds warning', async () => {
		const uuid = '123e4567-e89b-12d3-a456-426614174000';
		process.env.OWNER = 'octo-org';
		process.env.REPO = 'octo-repo';
		process.env.PULL_NUMBER = '88';
		process.env.GITHUB_TOKEN = 'fake-token';

		pullsGet.mockResolvedValue({ data: { head: { ref: 'feature-branch' } } });

		pullsListReviewComments.mockResolvedValue({ data: [] });
		pullsListReviews.mockResolvedValue({ data: [] });
		issuesListComments.mockResolvedValue({ data: [] });
		pullsListFiles.mockResolvedValue({
			data: [
				{ filename: 'config/secrets.yaml', status: 'removed' },
				{ filename: 'src/regular.txt', status: 'modified' }
			]
		});
		const deletedFileContent = [
			'# Configuration file with secrets',
			`# @lulaStart ${uuid}`,
			'database:',
			'  password: "secret123"',
			'  host: "db.internal"',
			`# @lulaEnd ${uuid}`,
			'# End of config'
		].join('\n');

		const regularFileOld = 'const x = 1;';
		const regularFileNew = 'const x = 2;';

		reposGetContent.mockImplementation(({ path, ref }) => {
			if (path === 'config/secrets.yaml' && ref === 'main') {
				const content = Buffer.from(deletedFileContent, 'utf8').toString('base64');
				return Promise.resolve({ data: { content } });
			}
			if (path === 'src/regular.txt' && ref === 'main') {
				const content = Buffer.from(regularFileOld, 'utf8').toString('base64');
				return Promise.resolve({ data: { content } });
			}
			if (path === 'src/regular.txt' && ref === 'feature-branch') {
				const content = Buffer.from(regularFileNew, 'utf8').toString('base64');
				return Promise.resolve({ data: { content } });
			}
			throw new Error(`Unexpected getContent call for ${path} @ ${ref}`);
		});

		const command = crawlCommand();
		await command.parseAsync(['--post-mode', 'review'], { from: 'user' });

		expect(pullsCreateReview).toHaveBeenCalledTimes(1);

		const call = pullsCreateReview.mock.calls[0][0];
		expect(call.owner).toBe('octo-org');
		expect(call.repo).toBe('octo-repo');
		expect(call.pull_number).toBe(88);

		expect(call.body).toContain('## Lula Compliance Overview');
		expect(call.body).toContain('**Compliance Warning: Files with Lula annotations were deleted**');
		expect(call.body).toContain('config/secrets.yaml');
		expect(call.body).toContain('This may affect compliance coverage');
		expect(call.body).toContain('Please review whether:');
		expect(call.body).toContain('The compliance coverage provided by these files is still needed');
		expect(call.body).toContain('Alternative compliance measures have been implemented');
	});

	it('comments only for changed blocks, cleans old comments, skips added files, and handles errors (comment mode)', async () => {
		process.env.OWNER = 'octo-org';
		process.env.REPO = 'octo-repo';
		process.env.PULL_NUMBER = '77';
		process.env.GITHUB_TOKEN = 'test-token';

		// PR + files
		pullsGet.mockResolvedValueOnce({ data: { head: { ref: 'feature-branch' } } });
		pullsListFiles.mockResolvedValueOnce({
			data: [
				{ filename: 'src/file1.txt', status: 'modified' },
				{ filename: 'src/added.txt', status: 'added' },
				{ filename: 'src/broken.txt', status: 'modified' }
			]
		});

		// Old/LHS and New/RHS file bodies
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

		// Cleanup: there is one signed old issue comment to delete
		issuesListComments
			.mockResolvedValueOnce({ data: [{ id: 99, body: `${LULA_SIGNATURE}\nold content` }] })
			.mockResolvedValueOnce({ data: [] });

		const command = crawlCommand();
		await command.parseAsync(['--post-mode', 'comment'], { from: 'user' });

		// Cleanup happened
		expect(issuesDeleteComment).toHaveBeenCalledTimes(1);
		expect(issuesDeleteComment).toHaveBeenCalledWith({
			owner: 'octo-org',
			repo: 'octo-repo',
			comment_id: 99
		});

		expect(issuesCreateComment).toHaveBeenCalledTimes(1);
		expect(pullsCreateReview).not.toHaveBeenCalled();

		const call = issuesCreateComment.mock.calls[0][0];
		expect(call.owner).toBe('octo-org');
		expect(call.repo).toBe('octo-repo');
		expect(call.issue_number).toBe(77);

		expect(call.body).toContain('## Lula Compliance Overview');
		expect(call.body).toContain('src/file1.txt');

		expect(call.body).toMatch(/`2–4`/);

		const changedBlockText = [
			`// @lulaStart ${uuid}`,
			'new line changed',
			`// @lulaEnd ${uuid}`
		].join('\n');
		const expectedSha = crypto.createHash('sha256').update(changedBlockText).digest('hex');
		expect(call.body).toContain(uuid);
		expect(call.body).toContain(expectedSha);

		const fetchedPaths = reposGetContent.mock.calls.map((c) => c[0].path);
		expect(fetchedPaths).not.toContain('src/added.txt');
	});

	it('review mode: cleans old reviews & review comments, then posts REQUEST_CHANGES', async () => {
		process.env.OWNER = 'octo-org';
		process.env.REPO = 'octo-repo';
		process.env.PULL_NUMBER = '88';
		process.env.GITHUB_TOKEN = 'test-token';

		pullsGet.mockResolvedValueOnce({ data: { head: { ref: 'feat' } } });
		pullsListFiles.mockResolvedValueOnce({ data: [{ filename: 'x.txt', status: 'modified' }] });

		const uuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
		const oldText = ['a', `// @lulaStart ${uuid}`, 'old', `// @lulaEnd ${uuid}`, 'z'].join('\n');
		const newText = ['a', `// @lulaStart ${uuid}`, 'new', `// @lulaEnd ${uuid}`, 'z'].join('\n');

		reposGetContent.mockImplementation(({ path, ref }) => {
			if (path === 'x.txt' && ref === 'main') return Promise.resolve({ data: oldText });
			if (path === 'x.txt' && ref === 'feat') {
				const content = Buffer.from(newText, 'utf8').toString('base64');
				return Promise.resolve({ data: { content } });
			}
			throw new Error('unexpected getContent');
		});

		pullsListReviewComments
			.mockResolvedValueOnce({ data: [{ id: 55, body: '<!-- LULA_SIGNATURE:v1 -->\nline cmt' }] })
			.mockResolvedValueOnce({ data: [] }); // end pages

		pullsListReviews
			.mockResolvedValueOnce({ data: [{ id: 66, body: '<!-- LULA_SIGNATURE:v1 -->\nreview' }] })
			.mockResolvedValueOnce({ data: [] });

		const command = crawlCommand();
		await command.parseAsync(['--post-mode', 'review'], { from: 'user' });

		expect(pullsListReviewComments).toHaveBeenCalled();
		expect(pullsListReviews).toHaveBeenCalled();

		expect(pullsDeleteReviewComment).toHaveBeenCalledTimes(1);
		expect(pullsDeleteReviewComment).toHaveBeenCalledWith({
			owner: 'octo-org',
			repo: 'octo-repo',
			comment_id: 55
		});

		expect(pullsDismissReview).toHaveBeenCalledTimes(1);
		expect(pullsDismissReview).toHaveBeenCalledWith({
			owner: 'octo-org',
			repo: 'octo-repo',
			pull_number: 88,
			review_id: 66,
			message: 'Superseded by a new Lula compliance review.'
		});

		expect(pullsCreateReview).toHaveBeenCalledTimes(1);
		expect(issuesCreateComment).not.toHaveBeenCalled();
	});

	it('no changes found: runs cleanup but does not post anything', async () => {
		process.env.OWNER = 'o';
		process.env.REPO = 'r';
		process.env.PULL_NUMBER = '99';
		process.env.GITHUB_TOKEN = 'x';

		pullsGet.mockResolvedValueOnce({ data: { head: { ref: 'same' } } });
		pullsListFiles.mockResolvedValueOnce({ data: [{ filename: 'same.txt', status: 'modified' }] });

		const txt = [
			'h',
			'// @lulaStart 11111111-1111-1111-1111-111111111111',
			'x',
			'// @lulaEnd 11111111-1111-1111-1111-111111111111',
			'f'
		].join('\n');

		reposGetContent.mockImplementation(({ path }) => {
			if (path === 'same.txt') return Promise.resolve({ data: txt });
			throw new Error('unexpected');
		});

		issuesListComments.mockResolvedValueOnce({ data: [] });
		pullsListReviewComments.mockResolvedValueOnce({ data: [] });
		pullsListReviews.mockResolvedValueOnce({ data: [] });

		const command = crawlCommand();
		await command.parseAsync(['--post-mode', 'comment'], { from: 'user' });

		expect(issuesDeleteComment).not.toHaveBeenCalled();
		expect(pullsDeleteReviewComment).not.toHaveBeenCalled();
		expect(pullsDismissReview).not.toHaveBeenCalled();

		expect(issuesCreateComment).not.toHaveBeenCalled();
		expect(pullsCreateReview).not.toHaveBeenCalled();
	});
});

describe('postFinding', () => {
	it('creates a PR review with REQUEST_CHANGES when postMode is "review"', async () => {
		const octokit = new Octokit();

		await postFinding({
			octokit,
			postMode: 'review',
			owner: 'octo-org',
			repo: 'octo-repo',
			pull_number: 101,
			body: 'Review body'
		});

		expect(mockOctokitInstance.pulls.createReview).toHaveBeenCalledTimes(1);
		expect(mockOctokitInstance.pulls.createReview).toHaveBeenCalledWith({
			owner: 'octo-org',
			repo: 'octo-repo',
			pull_number: 101,
			body: 'Review body',
			event: 'REQUEST_CHANGES'
		});

		expect(mockOctokitInstance.issues.createComment).not.toHaveBeenCalled();
	});

	it('creates an issue comment when postMode is "comment"', async () => {
		const octokit = new Octokit();

		await postFinding({
			octokit,
			postMode: 'comment',
			owner: 'octo-org',
			repo: 'octo-repo',
			pull_number: 202,
			body: 'Comment body'
		});

		expect(mockOctokitInstance.issues.createComment).toHaveBeenCalledTimes(1);
		expect(mockOctokitInstance.issues.createComment).toHaveBeenCalledWith({
			owner: 'octo-org',
			repo: 'octo-repo',
			issue_number: 202,
			body: 'Comment body'
		});

		expect(mockOctokitInstance.pulls.createReview).not.toHaveBeenCalled();
	});
});

describe('containsLulaAnnotations', () => {
	it('returns true when text contains @lulaStart', () => {
		const text = `
			Some code here
			// @lulaStart 123e4567-e89b-12d3-a456-426614174000
			const config = { secret: true };
		`;
		expect(containsLulaAnnotations(text)).toBe(true);
	});

	it('returns true when text contains @lulaEnd', () => {
		const text = `
			const config = { secret: true };
			// @lulaEnd 123e4567-e89b-12d3-a456-426614174000
			Some other code here
		`;
		expect(containsLulaAnnotations(text)).toBe(true);
	});

	it('returns true when text contains both @lulaStart and @lulaEnd', () => {
		const text = `
			Some code here
			// @lulaStart 123e4567-e89b-12d3-a456-426614174000
			const config = { secret: true };
			// @lulaEnd 123e4567-e89b-12d3-a456-426614174000
			Some other code here
		`;
		expect(containsLulaAnnotations(text)).toBe(true);
	});

	it('returns false when text contains no Lula annotations', () => {
		const text = `
			Some regular code here
			const config = { public: true };
			// Just regular comments
		`;
		expect(containsLulaAnnotations(text)).toBe(false);
	});

	it('returns false for empty text', () => {
		expect(containsLulaAnnotations('')).toBe(false);
	});

	it('returns true when annotations are in different formats', () => {
		const text1 = `# @lulaStart abc123`;
		const text2 = `<!-- @lulaEnd def456 -->`;
		const text3 = `/* @lulaStart ghi789 */`;

		expect(containsLulaAnnotations(text1)).toBe(true);
		expect(containsLulaAnnotations(text2)).toBe(true);
		expect(containsLulaAnnotations(text3)).toBe(true);
	});
});
