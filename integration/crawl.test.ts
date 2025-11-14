// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Octokit } from '@octokit/rest';
import { execSync } from "node:child_process";

const OWNER = "defenseunicorns";
const REPO = "lula";
const PULL_NUMBER = 126;
let GITHUB_TOKEN: string;
let octokit: Octokit;
let comment_ids: number[] = [];
let command_output = "";
let testStartTime: Date;

describe('crawl', () => {
  beforeAll(() => {
    if (!process.env.GITHUB_TOKEN) {
      try {
        GITHUB_TOKEN = execSync(`gh auth token`, { encoding: 'utf8' }).trim();
      } catch (error) {
        console.log('No GitHub token available, skipping integration test');
        throw error;
      }
    } else {
      GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
    }

    octokit = new Octokit({ auth: GITHUB_TOKEN });
    testStartTime = new Date();

    try {
      // Run in comment mode (so we can fetch issue comments below)
      command_output = execSync(
        `OWNER=${OWNER} REPO=${REPO} PULL_NUMBER=${PULL_NUMBER} GITHUB_TOKEN=${GITHUB_TOKEN} npx lula2 crawl --post-mode=comment`,
        {
          encoding: 'utf8',
          timeout: 60000
        }
      );
    } catch (error) {
      console.error('Failed to run crawl command:', error);
      throw error;
    }
  }, 120000);

  afterAll(async () => {
    for (const comment_id of comment_ids) {
      try {
        await octokit.request(`DELETE /repos/${OWNER}/${REPO}/issues/comments/${comment_id}`, {
          owner: OWNER,
          repo: REPO,
          comment_id,
          headers: { 'X-GitHub-Api-Version': '2022-11-28' }
        });
        console.log(`Deleted comment ${comment_id}`);
      } catch (error) {
        console.error(`Failed to delete comment ${comment_id}:`, error);
      }
    }
  }, 120000);

  it("should console log the Lula overview, table with lines changed, uuid and sha256sum when content changes between annotations", { timeout: 2 * 60 * 1000 }, () => {
    if (!command_output || command_output.length === 0) {
      throw new Error('No command output received - the crawl command may have failed or produced no output');
    }

    // New header and structure
    expect(command_output).toContain("Posted (comment)");
    expect(command_output).toContain("## Lula Compliance Overview");
    expect(command_output).toContain("Please review the changes to ensure they meet compliance standards.");
    expect(command_output).toContain("### Reviewed Changes");
    expect(command_output).toMatch(/\| File \| Lines Changed \|\s*\n\| ---- \| ------------- \|/);

    // Expect file rows for both example files (filenames in backticks in the table)
    expect(command_output).toContain("`integration/test-files/ex.ts`");
    expect(command_output).toContain("`integration/test-files/ex.yaml`");

    // Expect a backticked line range like `20–31` and `1–5` in the table
    expect(command_output).toMatch(/`20–31`/);
    expect(command_output).toMatch(/`1–5`/);

    // Expect uuid + sha256 sections (blockquote for uuid line)
    // ex.ts block
    expect(command_output).toContain("> **uuid**-`123e4567-e89b-12d3-a456-426614174000`");
    expect(command_output).toContain("**sha256** `f889702fd3330d939fadb5f37087948e42a840d229646523989778e2b1586926`");
    // ex.yaml block
    expect(command_output).toContain("> **uuid**-`123e4567-e89b-12d3-a456-426614174001`");
    expect(command_output).toContain("**sha256** `f6b6f51335248062b003696623bfe21cea977ca7f4e4163b182b0036fa699eb4`");
  });

  it('posts a PR comment with the Lula overview and block metadata', { timeout: 2 * 60 * 1000 }, async () => {
    // Give GitHub a moment to persist comments
    await sleep(10);

    const { data: comments } = await octokit.request(
      `GET /repos/${OWNER}/${REPO}/issues/${PULL_NUMBER}/comments`,
      {
        owner: OWNER,
        repo: REPO,
        issue_number: PULL_NUMBER,
        headers: { 'X-GitHub-Api-Version': '2022-11-28' }
      }
    );

    interface IssueComment {
      id: number;
      created_at: string;
      body: string;
      [key: string]: unknown;
    }

    const relevantComments: IssueComment[] = (comments as IssueComment[]).filter((comment: IssueComment) => {
      comment_ids.push(comment.id);
      const created: Date = new Date(comment.created_at);
      return created >= testStartTime && comment.body.includes("## Lula Compliance Overview");
    });

    expect(relevantComments.length).toBeGreaterThan(0);

    for (const c of relevantComments) {
      const body = c.body;

      expect(body).toContain("## Lula Compliance Overview");
      expect(body).toContain("Please review the changes to ensure they meet compliance standards.");
      expect(body).toMatch(/\| File \| Lines Changed \|\s*\n\| ---- \| ------------- \|/);

      expect(body).toContain("`integration/test-files/ex.ts`");
      expect(body).toContain("`integration/test-files/ex.yaml`");
      expect(body).toMatch(/`20–31`/);
      expect(body).toMatch(/`1–5`/);

      expect(body).toMatch(/> \*\*uuid\*\*-\`[-a-f0-9]{36}\`/);
      expect(body).toMatch(/\*\*sha256\*\* \`[a-f0-9]{64}\`/);

      const commentTime = new Date(c.created_at);
      const secs = (commentTime.getTime() - testStartTime.getTime()) / 1000;
      expect(secs).toBeLessThanOrEqual(60);
      expect(secs).toBeGreaterThanOrEqual(0);
    }

    console.log(`Found ${relevantComments.length} relevant comments created by this test`);
  });

  it('should detect when @lulaStart/@lulaEnd annotations are DELETED from an existing file', { timeout: 2 * 60 * 1000 }, async () => {
    // Test scenario: A file exists with Lula annotations, then the annotations are removed but file remains
    
    // Create a mock scenario by testing the getRemovedBlocks function directly
    const { getRemovedBlocks } = await import('../cli/commands/crawl.js');
    
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    
    const oldFileContent = [
      'function example() {',
      `  // @lulaStart ${uuid}`,
      '  const data = "sensitive info";',
      '  return data;',
      `  // @lulaEnd ${uuid}`,
      '}'
    ].join('\n');
    
    const newFileContent = [
      'function example() {',
      '  const data = "sensitive info";',
      '  return data;',
      '}'
    ].join('\n');
    
    const removedBlocks = getRemovedBlocks(oldFileContent, newFileContent);
    
    expect(removedBlocks).toHaveLength(1);
    expect(removedBlocks[0].uuid).toBe(uuid);
    expect(removedBlocks[0].startLine).toBe(1); // @lulaStart line
    expect(removedBlocks[0].endLine).toBe(5); // @lulaEnd line + 1
  });

  it('should detect when a whole file with annotations is DELETED', { timeout: 2 * 60 * 1000 }, async () => {
    // Test scenario: An entire file containing Lula annotations is deleted
    
    const { containsLulaAnnotations, analyzeDeletedFiles } = await import('../cli/commands/crawl.js');
    
    // Test the containsLulaAnnotations function
    const fileWithAnnotations = [
      'const config = {',
      '  // @lulaStart 123e4567-e89b-12d3-a456-426614174000',
      '  apiKey: "secret-key",',
      '  // @lulaEnd 123e4567-e89b-12d3-a456-426614174000',
      '};'
    ].join('\n');
    
    const fileWithoutAnnotations = [
      'const config = {',
      '  apiKey: "secret-key",',
      '};'
    ].join('\n');
    
    expect(containsLulaAnnotations(fileWithAnnotations)).toBe(true);
    expect(containsLulaAnnotations(fileWithoutAnnotations)).toBe(false);
    
    // Test with partial annotations (should still detect)
    const fileWithOnlyStart = [
      'const config = {',
      '  // @lulaStart 123e4567-e89b-12d3-a456-426614174000',
      '  apiKey: "secret-key",',
      '};'
    ].join('\n');
    
    const fileWithOnlyEnd = [
      'const config = {',
      '  apiKey: "secret-key",',
      '  // @lulaEnd 123e4567-e89b-12d3-a456-426614174000',
      '};'
    ].join('\n');
    
    expect(containsLulaAnnotations(fileWithOnlyStart)).toBe(true);
    expect(containsLulaAnnotations(fileWithOnlyEnd)).toBe(true);
  });

  it('should NOT detect changes when content above annotations changes but annotation content is unchanged', { timeout: 2 * 60 * 1000 }, async () => {
    // Test scenario: Lines are added/changed above the UUID block, but content between markers is identical
    
    const { getChangedBlocks } = await import('../cli/commands/crawl.js');
    
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    
    const originalFile = [
      'function example() {',
      '  console.log("original header");',
      `  // @lulaStart ${uuid}`,
      '  const sensitiveData = "unchanged content";',
      '  return sensitiveData;',
      `  // @lulaEnd ${uuid}`,
      '}'
    ].join('\n');
    
    const modifiedFileWithChangesAbove = [
      'function example() {',
      '  console.log("MODIFIED header");', // This line changed
      '  const newVariable = "added";',    // This line added
      `  // @lulaStart ${uuid}`,
      '  const sensitiveData = "unchanged content";', // Content between markers is identical
      '  return sensitiveData;',                      // Content between markers is identical
      `  // @lulaEnd ${uuid}`,
      '}'
    ].join('\n');
    
    const changedBlocks = getChangedBlocks(originalFile, modifiedFileWithChangesAbove);
    
    // Should be 0 because content between @lulaStart and @lulaEnd is identical
    expect(changedBlocks).toHaveLength(0);
    
    // Test the opposite case: content between markers actually changes
    const modifiedFileWithChangesInside = [
      'function example() {',
      '  console.log("MODIFIED header");', 
      '  const newVariable = "added";',    
      `  // @lulaStart ${uuid}`,
      '  const sensitiveData = "CHANGED content";', // This line changed inside the block
      '  return sensitiveData;',                    
      `  // @lulaEnd ${uuid}`,
      '}'
    ].join('\n');
    
    const changedBlocksInside = getChangedBlocks(originalFile, modifiedFileWithChangesInside);
    
    // Should be 1 because content between @lulaStart and @lulaEnd actually changed
    expect(changedBlocksInside).toHaveLength(1);
    expect(changedBlocksInside[0].uuid).toBe(uuid);
  });
});

function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
