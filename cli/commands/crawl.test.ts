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
const comment_ids: number[] = [];
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
    expect(command_output).toContain("`integration/test-files/add.ts`");
    expect(command_output).toContain("`integration/test-files/remove-and-add.yaml`");

    // Expect a backticked line range like `20–31` and `1–5` in the table
    expect(command_output).toMatch(/`20–31`/);
    expect(command_output).toMatch(/`1–5`/);

    // Expect uuid + sha256 sections (now in new block format with separate lines)
    // add.ts blocks
    expect(command_output).toContain("**UUID:** `123e4567-e89b-12d3-a456-426614174000`");
    expect(command_output).toContain("**sha256:** `f889702fd3330d939fadb5f37087948e42a840d229646523989778e2b1586926`");
    // remove-and-add.yaml blocks
    expect(command_output).toContain("**UUID:** `123e4567-e89b-12d3-a456-426614174001`");
    expect(command_output).toContain("**sha256:** `f6b6f51335248062b003696623bfe21cea977ca7f4e4163b182b0036fa699eb4`");
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

      expect(body).toContain("`integration/test-files/add.ts`");
      expect(body).toContain("`integration/test-files/remove-and-add.yaml`");
      expect(body).toMatch(/`20–31`/);
      expect(body).toMatch(/`1–5`/);

      expect(body).toMatch(/\*\*UUID:\*\* \`[-a-f0-9]{36}\`/);
      expect(body).toMatch(/\*\*sha256:\*\* \`[a-f0-9]{64}\`/);

      const commentTime = new Date(c.created_at);
      const secs = (commentTime.getTime() - testStartTime.getTime()) / 1000;
      expect(secs).toBeLessThanOrEqual(60);
      expect(secs).toBeGreaterThanOrEqual(0);
    }

    console.log(`Found ${relevantComments.length} relevant comments created by this test`);
  });

  it('should detect when @lulaStart/@lulaEnd annotations are DELETED from an existing file', { timeout: 2 * 60 * 1000 }, async () => {
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
    expect(removedBlocks[0].startLine).toBe(1);
    expect(removedBlocks[0].endLine).toBe(5); 
  });

  it('should detect when a whole file with annotations is DELETED', { timeout: 2 * 60 * 1000 }, async () => {    
    const { containsLulaAnnotations } = await import('../cli/commands/crawl.js');

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
      '  console.log("MODIFIED header");',
      '  const newVariable = "added";',  
      `  // @lulaStart ${uuid}`,
      '  const sensitiveData = "unchanged content";',
      '  return sensitiveData;',
      `  // @lulaEnd ${uuid}`,
      '}'
    ].join('\n');
    
    const changedBlocks = getChangedBlocks(originalFile, modifiedFileWithChangesAbove);
    
    expect(changedBlocks).toHaveLength(0);
    
    // Test the opposite case: content between markers actually changes
    const modifiedFileWithChangesInside = [
      'function example() {',
      '  console.log("MODIFIED header");', 
      '  const newVariable = "added";',    
      `  // @lulaStart ${uuid}`,
      '  const sensitiveData = "CHANGED content";',
      '  return sensitiveData;',                    
      `  // @lulaEnd ${uuid}`,
      '}'
    ].join('\n');
    
    const changedBlocksInside = getChangedBlocks(originalFile, modifiedFileWithChangesInside);
    
    expect(changedBlocksInside).toHaveLength(1);
    expect(changedBlocksInside[0].uuid).toBe(uuid);
  });

  it('should generate properly formatted markdown tables for multiple blocks', { timeout: 2 * 60 * 1000 }, async () => {
    
    const { generateChangedBlocksContent, generateRemovedBlocksContent } = await import('../cli/commands/crawl.js');
    
    const changedBlocks = [
      { uuid: '96b7aa1b-b307-45c0-af40-8b57f3726693', startLine: 56, endLine: 65 },
      { uuid: 'e4ea044c-75fc-4acc-a552-8bba2aab1b12', startLine: 415, endLine: 424 }
    ];
    
    const newText = Array(500).fill(0).map((_, i) => `line ${i + 1}`).join('\n');
    const changedResult = generateChangedBlocksContent('src/keycloak/chart/values.yaml', changedBlocks, newText);
    
    // Should have ONE table header for changed blocks
    const changedTableHeaders = changedResult.match(/\| File \| Lines Changed \|/g);
    expect(changedTableHeaders).toHaveLength(1);
    
    // Should have both rows in the same table
    expect(changedResult).toContain('| `src/keycloak/chart/values.yaml` | `57–65` |');
    expect(changedResult).toContain('| `src/keycloak/chart/values.yaml` | `416–424` |');
    
    // Block and SHA256 info should be separate from table (not breaking it)
    expect(changedResult).toContain('**UUID:** `96b7aa1b-b307-45c0-af40-8b57f3726693`');
    expect(changedResult).toContain('**UUID:** `e4ea044c-75fc-4acc-a552-8bba2aab1b12`');
    expect(changedResult).toContain('**sha256:**');
    
    // multiple removed blocks
    const removedBlocks = [
      { uuid: '96b7aa1b-b307-45c0-af40-8b57f3726693', startLine: 56, endLine: 65 },
      { uuid: 'e4ea044c-75fc-4acc-a552-8bba2aab1b12', startLine: 415, endLine: 424 }
    ];
    
    const oldText = Array(500).fill(0).map((_, i) => `old line ${i + 1}`).join('\n');
    const removedResult = generateRemovedBlocksContent('src/keycloak/chart/values.yaml', removedBlocks, oldText);
    
    // Should have exactly table header for removed blocks  
    const removedTableHeaders = removedResult.match(/\| File \| Original Lines \| UUID \|/g);
    expect(removedTableHeaders).toHaveLength(1);
    
    // Should have both rows in the same table
    expect(removedResult).toContain('| `src/keycloak/chart/values.yaml` | `57–65` | `96b7aa1b-b307-45c0-af40-8b57f3726693` |');
    expect(removedResult).toContain('| `src/keycloak/chart/values.yaml` | `416–424` | `e4ea044c-75fc-4acc-a552-8bba2aab1b12` |');
    
    // Block and SHA256 info should be separate from table (not breaking it)
    expect(removedResult).toContain('**UUID:** `96b7aa1b-b307-45c0-af40-8b57f3726693`');
    expect(removedResult).toContain('**UUID:** `e4ea044c-75fc-4acc-a552-8bba2aab1b12`');
    expect(removedResult).toContain('**sha256:**');
    
    // Verify no broken table structure (no blockquotes inside table rows)
    const tableRows = removedResult.split('\n').filter(line => line.startsWith('| `'));
    for (const row of tableRows) {
      expect(row).not.toContain('>');
      expect(row).not.toContain('**sha256**'); 
    }
  });

  it('should NOT make any Lula comments about the multiple-same-uuids.yaml file', { timeout: 2 * 60 * 1000 }, () => {
    expect(command_output).toContain("Skipping integration/test-files/multiple-same-uuids.yaml: only new Lula annotations added, no existing compliance content modified");
    expect(command_output).not.toContain("Commenting regarding `integration/test-files/multiple-same-uuids.yaml`.");
    
    // Also verify the UUID from multiple-same-uuids.yaml is not mentioned
    expect(command_output).not.toContain("643060b2-0ddf-4728-9582-ef38dca7447a");
  });

  it('should NOT include multiple-same-uuids.yaml references in Lula comments', { timeout: 2 * 60 * 1000 }, async () => {
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
      const created: Date = new Date(comment.created_at);
      return created >= testStartTime && comment.body.includes("## Lula Compliance Overview");
    });

    // Verify no comments mention multiple-same-uuids.yaml
    for (const comment of relevantComments) {
      expect(comment.body).not.toContain("`integration/test-files/multiple-same-uuids.yaml`");
      expect(comment.body).not.toContain("multiple-same-uuids.yaml");
      expect(comment.body).not.toContain("643060b2-0ddf-4728-9582-ef38dca7447a");
    }

    console.log(`Verified ${relevantComments.length} comments do not mention multiple-same-uuids.yaml`);
  });
});

function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
