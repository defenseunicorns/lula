/**
 * Git History Utilities
 * 
 * Provides utilities for retrieving git history for control files
 * Now uses isomorphic-git for better reliability and cross-platform support
 */

import * as git from 'isomorphic-git';
import * as fs from 'fs';
import { relative, join } from 'path';
import { createYamlDiff, type YamlDiffResult } from './yamlDiff.js';

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  authorEmail: string;
  date: string;
  message: string;
  changes: {
    insertions: number;
    deletions: number;
    files: number;
  };
}

export interface GitFileHistory {
  filePath: string;
  commits: GitCommit[];
  totalCommits: number;
  firstCommit: GitCommit | null;
  lastCommit: GitCommit | null;
}

export class GitHistoryUtil {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  /**
   * Check if the directory is a git repository
   */
  async isGitRepository(): Promise<boolean> {
    try {
      const gitDir = await git.findRoot({ fs, filepath: process.cwd() });
      return !!gitDir;
    } catch {
      return false;
    }
  }

  /**
   * Get git history for a specific file
   */
  async getFileHistory(filePath: string, limit: number = 50): Promise<GitFileHistory> {
    const isGitRepo = await this.isGitRepository();
    if (!isGitRepo) {
      console.log(`Not a git repository: ${this.baseDir}`);
      return {
        filePath,
        commits: [],
        totalCommits: 0,
        firstCommit: null,
        lastCommit: null
      };
    }

    try {
      const gitRoot = await git.findRoot({ fs, filepath: process.cwd() });
      const relativePath = relative(gitRoot, filePath);
      console.log(`Getting git history for relative path: ${relativePath} (from git root: ${gitRoot})`);

      // Get commit history using isomorphic-git
      const commits = await git.log({
        fs,
        dir: gitRoot,
        filepath: relativePath,
        depth: limit
      });

      if (!commits || commits.length === 0) {
        console.log(`No git history found for file: ${relativePath}`);
        return {
          filePath,
          commits: [],
          totalCommits: 0,
          firstCommit: null,
          lastCommit: null
        };
      }

      const gitCommits = await this.convertIsomorphicCommits(commits, relativePath, gitRoot);
      console.log(`Parsed ${gitCommits.length} commits for file: ${relativePath}`);

      return {
        filePath,
        commits: gitCommits,
        totalCommits: gitCommits.length,
        firstCommit: gitCommits[gitCommits.length - 1] || null,
        lastCommit: gitCommits[0] || null
      };
    } catch (error) {
      console.error(`Error getting git history for ${filePath}:`, error);
      return {
        filePath,
        commits: [],
        totalCommits: 0,
        firstCommit: null,
        lastCommit: null
      };
    }
  }

  /**
   * Get the total number of commits for a file
   */
  async getFileCommitCount(filePath: string): Promise<number> {
    const isGitRepo = await this.isGitRepository();
    if (!isGitRepo) {
      return 0;
    }

    try {
      const gitRoot = await git.findRoot({ fs, filepath: process.cwd() });
      const relativePath = relative(gitRoot, filePath);
      const commits = await git.log({
        fs,
        dir: gitRoot,
        filepath: relativePath
      });
      return commits.length;
    } catch {
      return 0;
    }
  }

  /**
   * Get the latest commit info for a file
   */
  async getLatestCommit(filePath: string): Promise<GitCommit | null> {
    const history = await this.getFileHistory(filePath, 1);
    return history.lastCommit;
  }

  /**
   * Get file content at a specific commit (public method)
   */
  async getFileContentAtCommit(filePath: string, commitHash: string): Promise<string | null> {
    const isGitRepo = await this.isGitRepository();
    if (!isGitRepo) {
      return null;
    }

    try {
      const gitRoot = await git.findRoot({ fs, filepath: process.cwd() });
      const relativePath = relative(gitRoot, filePath);
      return await this.getFileAtCommit(commitHash, relativePath, gitRoot);
    } catch (error) {
      console.error(`Error getting file content at commit ${commitHash}:`, error);
      return null;
    }
  }

  /**
   * Convert isomorphic-git commits to our GitCommit format
   */
  private async convertIsomorphicCommits(commits: any[], relativePath: string, gitRoot: string): Promise<GitCommit[]> {
    const gitCommits: GitCommit[] = [];

    // Process up to the first 5 commits for diffs to avoid performance issues
    const commitsToProcess = commits.slice(0, Math.min(5, commits.length));

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      const includeDiff = i < 5; // Only get diffs for first 5 commits

      let changes = { insertions: 0, deletions: 0, files: 1 };
      let diff: string | undefined;
      let yamlDiff: YamlDiffResult | undefined;

      if (includeDiff) {
        try {
          // Get the diff for this commit
          const diffResult = await this.getCommitDiff(commit.oid, relativePath, gitRoot);
          changes = diffResult.changes;
          diff = diffResult.diff;
          yamlDiff = diffResult.yamlDiff;
        } catch (error) {
          console.warn(`Could not get diff for commit ${commit.oid.substring(0, 7)}:`, error);
        }
      }

      gitCommits.push({
        hash: commit.oid,
        shortHash: commit.oid.substring(0, 7),
        author: commit.commit.author.name,
        authorEmail: commit.commit.author.email,
        date: new Date(commit.commit.author.timestamp * 1000).toISOString(),
        message: commit.commit.message,
        changes,
        ...(diff && { diff }),
        ...(yamlDiff && { yamlDiff })
      });
    }

    return gitCommits;
  }

  /**
   * Get diff for a specific commit and file
   */
  private async getCommitDiff(commitOid: string, relativePath: string, gitRoot: string): Promise<{ changes: { insertions: number; deletions: number; files: number }, diff?: string, yamlDiff?: YamlDiffResult }> {
    try {
      // Get the parent commit to compare against
      const commit = await git.readCommit({ fs, dir: gitRoot, oid: commitOid });
      const parentOid = commit.commit.parent.length > 0 ? commit.commit.parent[0] : null;

      if (!parentOid) {
        // This is the initial commit, compare against empty
        const currentContent = await this.getFileAtCommit(commitOid, relativePath, gitRoot);
        if (currentContent) {
          const lines = currentContent.split('\n');
          const yamlDiff = createYamlDiff('', currentContent);
          return {
            changes: { insertions: lines.length, deletions: 0, files: 1 },
            diff: `--- /dev/null\n+++ b/${relativePath}\n@@ -0,0 +1,${lines.length} @@\n` +
              lines.map(line => '+' + line).join('\n'),
            yamlDiff
          };
        }
        return { changes: { insertions: 0, deletions: 0, files: 1 } };
      }

      // Get file content from both commits
      const currentContent = await this.getFileAtCommit(commitOid, relativePath, gitRoot);
      const parentContent = await this.getFileAtCommit(parentOid, relativePath, gitRoot);

      if (!currentContent && !parentContent) {
        return { changes: { insertions: 0, deletions: 0, files: 1 } };
      }

      // Simple diff calculation
      const currentLines = currentContent ? currentContent.split('\n') : [];
      const parentLines = parentContent ? parentContent.split('\n') : [];

      // Basic line-based diff
      const diff = this.createSimpleDiff(parentLines, currentLines, relativePath);
      const { insertions, deletions } = this.countChanges(parentLines, currentLines);

      // Create intelligent YAML diff
      const yamlDiff = createYamlDiff(parentContent || '', currentContent || '');

      return {
        changes: { insertions, deletions, files: 1 },
        diff,
        yamlDiff
      };
    } catch (error) {
      console.warn(`Error getting diff for commit ${commitOid.substring(0, 7)}:`, error);
      return { changes: { insertions: 0, deletions: 0, files: 1 } };
    }
  }

  /**
   * Get file content at a specific commit
   */
  private async getFileAtCommit(commitOid: string, filepath: string, gitRoot: string): Promise<string | null> {
    try {
      const { blob } = await git.readBlob({
        fs,
        dir: gitRoot,
        oid: commitOid,
        filepath
      });
      return new TextDecoder().decode(blob);
    } catch (error) {
      // File might not exist at this commit
      return null;
    }
  }

  /**
   * Create a simple unified diff between two file versions
   */
  private createSimpleDiff(oldLines: string[], newLines: string[], filepath: string): string {
    const diffLines: string[] = [];
    diffLines.push(`--- a/${filepath}`);
    diffLines.push(`+++ b/${filepath}`);

    // Add hunk header for the entire file
    const oldCount = oldLines.length;
    const newCount = newLines.length;
    diffLines.push(`@@ -1,${oldCount} +1,${newCount} @@`);

    // Simple approach: show context around changes
    let i = 0, j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        // Lines are the same
        diffLines.push(` ${oldLines[i]}`);
        i++;
        j++;
      } else if (i < oldLines.length && (j >= newLines.length || oldLines[i] !== newLines[j])) {
        // Line was removed
        diffLines.push(`-${oldLines[i]}`);
        i++;
      } else if (j < newLines.length) {
        // Line was added
        diffLines.push(`+${newLines[j]}`);
        j++;
      }
    }

    return diffLines.join('\n');
  }

  /**
   * Count insertions and deletions between two file versions
   */
  private countChanges(oldLines: string[], newLines: string[]): { insertions: number; deletions: number } {
    let insertions = 0;
    let deletions = 0;

    // Simple approach: count different lines
    const maxLines = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLines; i++) {
      const oldLine = i < oldLines.length ? oldLines[i] : null;
      const newLine = i < newLines.length ? newLines[i] : null;

      if (oldLine === null) {
        insertions++;
      } else if (newLine === null) {
        deletions++;
      } else if (oldLine !== newLine) {
        insertions++;
        deletions++;
      }
    }

    return { insertions, deletions };
  }

  /**
   * Get git stats for the entire repository
   */
  async getRepositoryStats(): Promise<{
    totalCommits: number;
    contributors: number;
    lastCommitDate: string | null;
    firstCommitDate: string | null;
  }> {
    const isGitRepo = await this.isGitRepository();
    if (!isGitRepo) {
      return {
        totalCommits: 0,
        contributors: 0,
        lastCommitDate: null,
        firstCommitDate: null
      };
    }

    try {
      const gitRoot = await git.findRoot({ fs, filepath: process.cwd() });

      // Get all commits
      const commits = await git.log({ fs, dir: gitRoot });

      // Get unique contributors
      const contributorEmails = new Set<string>();
      commits.forEach(commit => {
        contributorEmails.add(commit.commit.author.email);
      });

      const firstCommit = commits[commits.length - 1];
      const lastCommit = commits[0];

      return {
        totalCommits: commits.length,
        contributors: contributorEmails.size,
        lastCommitDate: lastCommit ? new Date(lastCommit.commit.author.timestamp * 1000).toISOString() : null,
        firstCommitDate: firstCommit ? new Date(firstCommit.commit.author.timestamp * 1000).toISOString() : null
      };
    } catch (error) {
      console.error('Error getting repository stats:', error);
      return {
        totalCommits: 0,
        contributors: 0,
        lastCommitDate: null,
        firstCommitDate: null
      };
    }
  }
}
