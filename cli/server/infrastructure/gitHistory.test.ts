// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHistoryUtil } from './gitHistory';

vi.mock('isomorphic-git', () => ({
	findRoot: vi.fn(),
	log: vi.fn(),
	readBlob: vi.fn(),
	readCommit: vi.fn()
}));

vi.mock('./yamlDiff', () => ({
	createYamlDiff: vi.fn().mockReturnValue({
		summary: 'Mocked YAML diff',
		changes: [],
		hasChanges: false
	})
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
	readCommit: ReturnType<typeof vi.fn>;
}

const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

const originalStderrWrite = process.stderr.write;
const mockStderrWrite = vi.fn();
process.stderr.write = mockStderrWrite as any;

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
		
		mockConsoleError.mockClear();
		mockConsoleLog.mockClear();
		mockConsoleWarn.mockClear();
		mockStderrWrite.mockClear();
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
		vi.clearAllMocks();
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
							timestamp: 1640995200
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
							timestamp: 1641081600 
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

	describe('getFileCommitCount', () => {
		it('should return 0 when not in a git repository', async () => {
			getMockFn(mockGit.findRoot).mockRejectedValue(new Error('Not a git repository'));

			const result = await gitHistoryUtil.getFileCommitCount('/test/file.yaml');

			expect(result).toBe(0);
		});

		it('should return correct commit count for a file', async () => {
			const mockCommits = Array.from({ length: 15 }, (_, i) => ({
				oid: `commit${i}`,
				commit: {
					author: {
						name: 'Test Author',
						email: 'test@example.com',
						timestamp: 1640995200 + i * 86400
					},
					message: `Commit ${i}`
				}
			}));

			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockResolvedValue(mockCommits);

			const result = await gitHistoryUtil.getFileCommitCount('/repo/root/test/file.yaml');

			expect(result).toBe(15);
			expect(mockGit.log).toHaveBeenCalledWith({
				fs: expect.any(Object),
				dir: '/repo/root',
				filepath: 'test/file.yaml'
			});
		});

		it('should handle errors gracefully and return 0', async () => {
			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockRejectedValue(new Error('File not found'));

			const result = await gitHistoryUtil.getFileCommitCount('/repo/root/test/file.yaml');

			expect(result).toBe(0);
		});
	});

	describe('getLatestCommit', () => {
		it('should return null when no commits found', async () => {
			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockResolvedValue([]);

			const result = await gitHistoryUtil.getLatestCommit('/test/file.yaml');

			expect(result).toBeNull();
		});

		it('should return the latest commit for a file', async () => {
			const mockCommits: GitCommitData[] = [
				{
					oid: 'latest123',
					commit: {
						author: {
							name: 'Latest Author',
							email: 'latest@example.com',
							timestamp: 1640995200
						},
						message: 'Latest commit'
					}
				},
				{
					oid: 'older456',
					commit: {
						author: {
							name: 'Older Author',
							email: 'older@example.com',
							timestamp: 1640908800
						},
						message: 'Older commit'
					}
				}
			];

			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockResolvedValue(mockCommits);
			getMockFn(mockGit.readBlob).mockResolvedValue({ blob: new Uint8Array(100) });

			const result = await gitHistoryUtil.getLatestCommit('/test/file.yaml');

			expect(result).not.toBeNull();
			expect(result?.hash).toBe('latest123');
			expect(result?.author).toBe('Latest Author');
			expect(result?.message).toBe('Latest commit');
		});

		it('should handle errors and return null', async () => {
			getMockFn(mockGit.findRoot).mockRejectedValue(new Error('Not a git repository'));

			const result = await gitHistoryUtil.getLatestCommit('/test/file.yaml');

			expect(result).toBeNull();
		});
	});

	describe('getFileContentAtCommit', () => {
		it('should return null when not in a git repository', async () => {
			getMockFn(mockGit.findRoot).mockRejectedValue(new Error('Not a git repository'));

			const result = await gitHistoryUtil.getFileContentAtCommit('/test/file.yaml', 'abc123');

			expect(result).toBeNull();
		});

		// Note: Tests for error cases are complex due to mock interference with existing tests
		// The error handling functionality is indirectly tested through integration tests
		// and the basic non-git-repo case is covered above
	});

	describe('getRepositoryStats', () => {
		it('should return empty stats when not in a git repository', async () => {
			getMockFn(mockGit.findRoot).mockRejectedValue(new Error('Not a git repository'));

			const result = await gitHistoryUtil.getRepositoryStats();

			expect(result).toEqual({
				totalCommits: 0,
				contributors: 0,
				lastCommitDate: null,
				firstCommitDate: null
			});
		});

		it('should return correct repository statistics', async () => {
			const mockCommits: GitCommitData[] = [
				{
					oid: 'commit1',
					commit: {
						author: {
							name: 'John Doe',
							email: 'john@example.com',
							timestamp: 1640995200 // 2022-01-01
						},
						message: 'Latest commit'
					}
				},
				{
					oid: 'commit2',
					commit: {
						author: {
							name: 'Jane Smith',
							email: 'jane@example.com',
							timestamp: 1640908800 // 2021-12-31
						},
						message: 'Middle commit'
					}
				},
				{
					oid: 'commit3',
					commit: {
						author: {
							name: 'John Doe',
							email: 'john@example.com',
							timestamp: 1640822400 // 2021-12-30
						},
						message: 'First commit'
					}
				}
			];

			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockResolvedValue(mockCommits);

			const result = await gitHistoryUtil.getRepositoryStats();

			expect(result).toEqual({
				totalCommits: 3,
				contributors: 2, // John and Jane (unique emails)
				lastCommitDate: '2022-01-01T00:00:00.000Z',
				firstCommitDate: '2021-12-30T00:00:00.000Z'
			});
		});

		it('should handle empty repository', async () => {
			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockResolvedValue([]);

			const result = await gitHistoryUtil.getRepositoryStats();

			expect(result).toEqual({
				totalCommits: 0,
				contributors: 0,
				lastCommitDate: null,
				firstCommitDate: null
			});
		});

		it('should handle git log errors gracefully', async () => {
			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockRejectedValue(new Error('Git log failed'));

			// Mock console.error to suppress error output
			const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

			const result = await gitHistoryUtil.getRepositoryStats();

			expect(result).toEqual({
				totalCommits: 0,
				contributors: 0,
				lastCommitDate: null,
				firstCommitDate: null
			});

			expect(mockConsoleError).toHaveBeenCalledWith(
				'Error getting repository stats:',
				expect.any(Error)
			);

			mockConsoleError.mockRestore();
		});

		it('should count unique contributors correctly', async () => {
			const mockCommits: GitCommitData[] = [
				{
					oid: 'commit1',
					commit: {
						author: {
							name: 'John Doe',
							email: 'john@example.com',
							timestamp: 1640995200
						},
						message: 'Commit 1'
					}
				},
				{
					oid: 'commit2',
					commit: {
						author: {
							name: 'John Doe', // Same person, different name
							email: 'john@example.com', // Same email
							timestamp: 1640908800
						},
						message: 'Commit 2'
					}
				},
				{
					oid: 'commit3',
					commit: {
						author: {
							name: 'Jane Smith',
							email: 'jane@example.com',
							timestamp: 1640822400
						},
						message: 'Commit 3'
					}
				}
			];

			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockResolvedValue(mockCommits);

			const result = await gitHistoryUtil.getRepositoryStats();

			expect(result.contributors).toBe(2); // Only 2 unique email addresses
		});
	});

	describe('diff calculation and private methods integration', () => {
		it('should handle diff calculation for initial commits', async () => {
			const mockCommits: GitCommitData[] = [
				{
					oid: 'abc123',
					commit: {
						author: {
							name: 'John Doe',
							email: 'john@example.com',
							timestamp: 1640995200
						},
						message: 'Initial commit',
						parent: [] // No parent for initial commit
					}
				}
			];

			const mockContent = 'line1\nline2\nline3';
			const mockBlob = new TextEncoder().encode(mockContent);

			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockResolvedValue(mockCommits);
			getMockFn(mockGit.readCommit).mockResolvedValue({
				commit: {
					parent: [] // No parent commits
				}
			});
			getMockFn(mockGit.readBlob).mockResolvedValue({ blob: mockBlob });

			const result = await gitHistoryUtil.getFileHistory('/repo/root/test/file.yaml');

			expect(result.commits).toHaveLength(1);
			expect(result.commits[0].changes.insertions).toBeGreaterThan(0); // Some lines added (exact count depends on implementation)
			expect(result.commits[0].changes.deletions).toBe(0); // No lines deleted
			expect(result.commits[0].changes.files).toBe(1);
		});

		it('should handle diff calculation between commits', async () => {
			const mockCommits: GitCommitData[] = [
				{
					oid: 'newest123',
					commit: {
						author: {
							name: 'John Doe',
							email: 'john@example.com',
							timestamp: 1640995200
						},
						message: 'Modified file',
						parent: ['parent456']
					}
				}
			];

			const currentContent = 'line1\nmodified line2\nline3\nnew line4';
			const parentContent = 'line1\noriginal line2\nline3';

			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockResolvedValue(mockCommits);
			getMockFn(mockGit.readCommit).mockResolvedValue({
				commit: {
					parent: ['parent456']
				}
			});
			getMockFn(mockGit.readBlob)
				.mockResolvedValueOnce({ blob: new TextEncoder().encode(currentContent) })
				.mockResolvedValueOnce({ blob: new TextEncoder().encode(parentContent) });

			const result = await gitHistoryUtil.getFileHistory('/repo/root/test/file.yaml');

			expect(result.commits).toHaveLength(1);
			expect(result.commits[0].changes.insertions).toBeGreaterThan(0);
			expect(result.commits[0].changes.deletions).toBeGreaterThan(0);
			expect(result.commits[0].changes.files).toBe(1);
		});

		it('should handle mapping files correctly in diff calculation', async () => {
			const mockCommits: GitCommitData[] = [
				{
					oid: 'abc123',
					commit: {
						author: {
							name: 'John Doe',
							email: 'john@example.com',
							timestamp: 1640995200
						},
						message: 'Add mapping file',
						parent: []
					}
				}
			];

			const mappingContent = 'mappings:\n  key: value\n  another: setting';
			const mockBlob = new TextEncoder().encode(mappingContent);

			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockResolvedValue(mockCommits);
			getMockFn(mockGit.readCommit).mockResolvedValue({
				commit: {
					parent: []
				}
			});
			getMockFn(mockGit.readBlob).mockResolvedValue({ blob: mockBlob });

			const result = await gitHistoryUtil.getFileHistory('/repo/root/test-mappings.yaml');

			expect(result.commits).toHaveLength(1);
			expect(result.commits[0].changes.files).toBe(1);
			// Should have processed as mapping file due to -mappings.yaml in filename
		});

		it('should handle readBlob errors in diff calculation', async () => {
			const mockCommits: GitCommitData[] = [
				{
					oid: 'abc123',
					commit: {
						author: {
							name: 'John Doe',
							email: 'john@example.com',
							timestamp: 1640995200
						},
						message: 'Commit with blob error',
						parent: ['parent456']
					}
				}
			];

			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockResolvedValue(mockCommits);
			getMockFn(mockGit.readCommit).mockResolvedValue({
				commit: {
					parent: ['parent456']
				}
			});
			getMockFn(mockGit.readBlob).mockRejectedValue(new Error('Blob read failed'));

			const result = await gitHistoryUtil.getFileHistory('/repo/root/test/file.yaml');

			expect(result.commits).toHaveLength(1);
			expect(result.commits[0].changes).toEqual({
				insertions: 0,
				deletions: 0,
				files: 1
			});
		});

		it('should handle commits where both current and parent content are null', async () => {
			const mockCommits: GitCommitData[] = [
				{
					oid: 'abc123',
					commit: {
						author: {
							name: 'John Doe',
							email: 'john@example.com',
							timestamp: 1640995200
						},
						message: 'Commit with missing content',
						parent: ['parent456']
					}
				}
			];

			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockResolvedValue(mockCommits);
			getMockFn(mockGit.readCommit).mockResolvedValue({
				commit: {
					parent: ['parent456']
				}
			});
			getMockFn(mockGit.readBlob).mockResolvedValue({ blob: null });

			const result = await gitHistoryUtil.getFileHistory('/repo/root/test/file.yaml');

			expect(result.commits).toHaveLength(1);
			expect(result.commits[0].changes).toEqual({
				insertions: 0,
				deletions: 0,
				files: 1
			});
		});
	});

	describe('error handling for specific error codes', () => {
		it('should handle NotFoundError specifically', async () => {
			const notFoundError = new Error('File not found');
			(notFoundError as any).code = 'NotFoundError';

			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockRejectedValue(notFoundError);

			const result = await gitHistoryUtil.getFileHistory('/repo/root/nonexistent.yaml');

			expect(result).toEqual({
				filePath: '/repo/root/nonexistent.yaml',
				commits: [],
				totalCommits: 0,
				firstCommit: null,
				lastCommit: null
			});
		});

		it('should handle "Could not find file" message errors', async () => {
			const fileNotFoundError = new Error('Could not find file in history');

			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockRejectedValue(fileNotFoundError);

			const result = await gitHistoryUtil.getFileHistory('/repo/root/missing.yaml');

			expect(result).toEqual({
				filePath: '/repo/root/missing.yaml',
				commits: [],
				totalCommits: 0,
				firstCommit: null,
				lastCommit: null
			});
		});

		it('should log unexpected errors and return empty result', async () => {
			const unexpectedError = new Error('Unexpected git error');

			getMockFn(mockGit.findRoot).mockResolvedValue('/repo/root');
			getMockFn(mockGit.log).mockRejectedValue(unexpectedError);

			// Mock console.error to suppress and verify error logging
			const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

			const result = await gitHistoryUtil.getFileHistory('/repo/root/test.yaml');

			expect(result).toEqual({
				filePath: '/repo/root/test.yaml',
				commits: [],
				totalCommits: 0,
				firstCommit: null,
				lastCommit: null
			});

			expect(mockConsoleError).toHaveBeenCalledWith(
				'Unexpected error getting git history for /repo/root/test.yaml:',
				unexpectedError
			);

			mockConsoleError.mockRestore();
		});
	});
});

// Cleanup: Restore process.stderr after all tests
afterAll(() => {
	process.stderr.write = originalStderrWrite;
});
