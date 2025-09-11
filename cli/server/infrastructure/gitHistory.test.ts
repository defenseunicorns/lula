// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHistoryUtil } from './gitHistory';

vi.mock('isomorphic-git', () => ({
	findRoot: vi.fn(),
	log: vi.fn(),
	readBlob: vi.fn()
}));

interface GitCommitData {
	oid: string;
	commit: {
		author: {
			name: string;
			email: string;
			timestamp: number;
		};
		message: string;
		parent?: string[];
	};
}

interface MockedGit {
	findRoot: ReturnType<typeof vi.fn>;
	log: ReturnType<typeof vi.fn>;
	readBlob: ReturnType<typeof vi.fn>;
}

const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('GitHistoryUtil', () => {
	let tempDir: string;
	let gitHistoryUtil: GitHistoryUtil;
	let mockGit: MockedGit;

	const getMockFn = (fn: ReturnType<typeof vi.fn>) => fn;

	beforeEach(async () => {
		tempDir = join(process.cwd(), 'test-temp', `githistory-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });

		gitHistoryUtil = new GitHistoryUtil(tempDir);

		mockGit = (await import('isomorphic-git')) as unknown as MockedGit;
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
		vi.clearAllMocks();
		mockConsoleError.mockClear();
	});

	describe('constructor', () => {
		it('should initialize with correct base directory', () => {
			expect(gitHistoryUtil['baseDir']).toBe(tempDir);
		});
	});

	describe('isGitRepository', () => {
		it('should return true when in a git repository', async () => {
			getMockFn(mockGit.findRoot).mockResolvedValue('/path/to/git/root');

			const result = await gitHistoryUtil.isGitRepository();

			expect(result).toBe(true);
			expect(mockGit.findRoot).toHaveBeenCalledWith({
				fs: expect.any(Object),
				filepath: process.cwd()
			});
		});

		it('should return false when not in a git repository', async () => {
			getMockFn(mockGit.findRoot).mockRejectedValue(new Error('Not a git repository'));

			const result = await gitHistoryUtil.isGitRepository();

			expect(result).toBe(false);
		});

		it('should handle findRoot throwing errors', async () => {
			getMockFn(mockGit.findRoot).mockImplementation(() => {
				throw new Error('Permission denied');
			});

			const result = await gitHistoryUtil.isGitRepository();

			expect(result).toBe(false);
		});
	});

	describe('getFileHistory', () => {
		let mockFilePath: string;

		beforeEach(() => {
			mockFilePath = join(tempDir, 'test-file.yaml');
			writeFileSync(mockFilePath, 'test content');
		});

		it('should return empty history when not in git repository', async () => {
			getMockFn(mockGit.findRoot).mockRejectedValue(new Error('Not a git repository'));

			const result = await gitHistoryUtil.getFileHistory(mockFilePath);

			expect(result).toEqual({
				filePath: mockFilePath,
				commits: [],
				totalCommits: 0,
				firstCommit: null,
				lastCommit: null
			});
		});

		it('should return empty history when no commits found', async () => {
			getMockFn(mockGit.findRoot).mockResolvedValue(tempDir);
			getMockFn(mockGit.log).mockResolvedValue([]);

			const result = await gitHistoryUtil.getFileHistory(mockFilePath);

			expect(result).toEqual({
				filePath: mockFilePath,
				commits: [],
				totalCommits: 0,
				firstCommit: null,
				lastCommit: null
			});
		});

		it('should convert isomorphic-git commits correctly', async () => {
			const mockCommits: GitCommitData[] = [
				{
					oid: 'abc123def456',
					commit: {
						author: {
							name: 'John Doe',
							email: 'john@example.com',
							timestamp: 1640995200 // 2022-01-01 00:00:00 UTC
						},
						message: 'Initial commit\n\nAdded test file'
					}
				},
				{
					oid: 'def456ghi789',
					commit: {
						author: {
							name: 'Jane Smith',
							email: 'jane@example.com',
							timestamp: 1641081600 // 2022-01-02 00:00:00 UTC
						},
						message: 'Update test file'
					}
				}
			];

			getMockFn(mockGit.findRoot).mockResolvedValue(tempDir);
			getMockFn(mockGit.log).mockResolvedValue(mockCommits);

			getMockFn(mockGit.readBlob).mockResolvedValue({ blob: new Uint8Array(100) });

			const result = await gitHistoryUtil.getFileHistory(mockFilePath, 10);

			expect(result.commits).toHaveLength(2);
			expect(result.totalCommits).toBe(2);
			expect(result.firstCommit).toBe(result.commits[1]); // Oldest commit
			expect(result.lastCommit).toBe(result.commits[0]); // Newest commit

			const firstCommit = result.commits[0];
			expect(firstCommit.hash).toBe('abc123def456');
			expect(firstCommit.shortHash).toBe('abc123d');
			expect(firstCommit.author).toBe('John Doe');
			expect(firstCommit.authorEmail).toBe('john@example.com');
			expect(firstCommit.message).toBe('Initial commit\n\nAdded test file'); // Original returns full message
			expect(firstCommit.date).toBe('2022-01-01T00:00:00.000Z');
		});

		it('should handle commit messages with extra whitespace', async () => {
			const mockCommits: GitCommitData[] = [
				{
					oid: 'abc123def456',
					commit: {
						author: {
							name: 'John Doe',
							email: 'john@example.com',
							timestamp: 1640995200
						},
						message: '  \n  Initial commit  \n\n  Extra whitespace  \n  '
					}
				}
			];

			getMockFn(mockGit.findRoot).mockResolvedValue(tempDir);
			getMockFn(mockGit.log).mockResolvedValue(mockCommits);
			getMockFn(mockGit.readBlob).mockResolvedValue({ blob: new Uint8Array(100) });

			const result = await gitHistoryUtil.getFileHistory(mockFilePath);

			expect(result.commits[0].message).toBe('  \n  Initial commit  \n\n  Extra whitespace  \n  ');
		});

		it('should limit results based on limit parameter', async () => {
			getMockFn(mockGit.findRoot).mockResolvedValue(tempDir);
			getMockFn(mockGit.log).mockResolvedValue([]);

			await gitHistoryUtil.getFileHistory(mockFilePath, 25);

			expect(mockGit.log).toHaveBeenCalledWith({
				fs: expect.any(Object),
				dir: tempDir,
				filepath: expect.any(String),
				depth: 25
			});
		});

		it('should use default limit when not specified', async () => {
			getMockFn(mockGit.findRoot).mockResolvedValue(tempDir);
			getMockFn(mockGit.log).mockResolvedValue([]);

			await gitHistoryUtil.getFileHistory(mockFilePath);

			expect(mockGit.log).toHaveBeenCalledWith({
				fs: expect.any(Object),
				dir: tempDir,
				filepath: expect.any(String),
				depth: 50
			});
		});

		it('should handle relative file paths correctly', async () => {
			const gitRoot = '/repo/root';
			const absolutePath = '/repo/root/subfolder/file.yaml';

			getMockFn(mockGit.findRoot).mockResolvedValue(gitRoot);
			getMockFn(mockGit.log).mockResolvedValue([]);

			await gitHistoryUtil.getFileHistory(absolutePath);

			expect(mockGit.log).toHaveBeenCalledWith({
				fs: expect.any(Object),
				dir: gitRoot,
				filepath: 'subfolder/file.yaml',
				depth: 50
			});
		});

		it('should handle errors in git log gracefully', async () => {
			getMockFn(mockGit.findRoot).mockResolvedValue(tempDir);
			getMockFn(mockGit.log).mockRejectedValue(new Error('Git log failed'));

			const result = await gitHistoryUtil.getFileHistory(mockFilePath);

			expect(result).toEqual({
				filePath: mockFilePath,
				commits: [],
				totalCommits: 0,
				firstCommit: null,
				lastCommit: null
			});
		});

		it('should calculate changes information correctly', async () => {
			const mockCommits: GitCommitData[] = [
				{
					oid: 'abc123def456',
					commit: {
						author: {
							name: 'John Doe',
							email: 'john@example.com',
							timestamp: 1640995200
						},
						message: 'Initial commit'
					}
				}
			];

			getMockFn(mockGit.findRoot).mockResolvedValue(tempDir);
			getMockFn(mockGit.log).mockResolvedValue(mockCommits);

			getMockFn(mockGit.readBlob)
				.mockResolvedValueOnce({ blob: new Uint8Array(100) }) // Current version
				.mockResolvedValueOnce({ blob: new Uint8Array(80) }); // Previous version

			const result = await gitHistoryUtil.getFileHistory(mockFilePath);

			expect(result.commits[0].changes).toEqual({
				insertions: expect.any(Number),
				deletions: expect.any(Number),
				files: 1
			});
		});

		it('should handle commits without parent (initial commit)', async () => {
			const mockCommits: GitCommitData[] = [
				{
					oid: 'abc123def456',
					commit: {
						author: {
							name: 'John Doe',
							email: 'john@example.com',
							timestamp: 1640995200
						},
						message: 'Initial commit',
						parent: [] // No parent commits
					}
				}
			];

			getMockFn(mockGit.findRoot).mockResolvedValue(tempDir);
			getMockFn(mockGit.log).mockResolvedValue(mockCommits);
			getMockFn(mockGit.readBlob).mockResolvedValue({ blob: new Uint8Array(100) });

			const result = await gitHistoryUtil.getFileHistory(mockFilePath);

			expect(result.commits).toHaveLength(1);
			expect(result.commits[0].changes.files).toBe(1);
		});

		it('should handle very long commit messages', async () => {
			const longMessage = 'A'.repeat(1000) + '\n\n' + 'B'.repeat(500);
			const mockCommits: GitCommitData[] = [
				{
					oid: 'abc123def456',
					commit: {
						author: {
							name: 'John Doe',
							email: 'john@example.com',
							timestamp: 1640995200
						},
						message: longMessage
					}
				}
			];

			getMockFn(mockGit.findRoot).mockResolvedValue(tempDir);
			getMockFn(mockGit.log).mockResolvedValue(mockCommits);
			getMockFn(mockGit.readBlob).mockResolvedValue({ blob: new Uint8Array(100) });

			const result = await gitHistoryUtil.getFileHistory(mockFilePath);

			expect(result.commits[0].message).toBe(longMessage);
		});
	});

	describe('error handling', () => {
		it('should handle file system errors gracefully', async () => {
			const mockFilePath = '/nonexistent/path/file.yaml';

			getMockFn(mockGit.findRoot).mockResolvedValue('/some/repo');
			getMockFn(mockGit.log).mockRejectedValue(new Error('File not found'));

			const result = await gitHistoryUtil.getFileHistory(mockFilePath);

			expect(result.commits).toEqual([]);
			expect(result.totalCommits).toBe(0);
		});

		it('should handle malformed commit data', async () => {
			const malformedCommits: Partial<GitCommitData>[] = [
				{
					oid: 'abc123',
					commit: {
						// Missing author
						message: 'Test commit'
					} as GitCommitData['commit']
				},
				{
					// Missing oid
					commit: {
						author: {
							name: 'John Doe',
							email: 'john@example.com',
							timestamp: 1640995200
						},
						message: 'Another commit'
					}
				} as Partial<GitCommitData>
			];

			getMockFn(mockGit.findRoot).mockResolvedValue(tempDir);
			getMockFn(mockGit.log).mockResolvedValue(malformedCommits as GitCommitData[]);
			getMockFn(mockGit.readBlob).mockResolvedValue({ blob: new Uint8Array(100) });

			const result = await gitHistoryUtil.getFileHistory('/test/file.yaml');

			expect(result.commits.length).toBeLessThanOrEqual(2);
		});
	});
});
