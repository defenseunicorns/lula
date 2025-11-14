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

  it("should console log the Lula overview, table with lines changed, uuid and sha256", { timeout: 2 * 60 * 1000 }, () => {
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

    // Track created comments for cleanup and filter for our run
    const relevantComments = comments.filter(comment => {
      comment_ids.push(comment.id);
      const created = new Date(comment.created_at);
      // Look for the new Lula overview header
      return created >= testStartTime && comment.body.includes("## Lula Compliance Overview");
    });

    expect(relevantComments.length).toBeGreaterThan(0);

    for (const c of relevantComments) {
      const body = c.body;

      // New structure checks
      expect(body).toContain("## Lula Compliance Overview");
      expect(body).toContain("Please review the changes to ensure they meet compliance standards.");
      expect(body).toMatch(/\| File \| Lines Changed \|\s*\n\| ---- \| ------------- \|/);

      // Filenames & ranges
      expect(body).toContain("`integration/test-files/ex.ts`");
      expect(body).toContain("`integration/test-files/ex.yaml`");
      expect(body).toMatch(/`20–31`/);
      expect(body).toMatch(/`1–5`/);

      // uuid + sha256 lines (format used in crawl.ts)
      expect(body).toMatch(/> \*\*uuid\*\*-\`[-a-f0-9]{36}\`/);
      expect(body).toMatch(/\*\*sha256\*\* \`[a-f0-9]{64}\`/);

      // Still enforce a reasonable creation window (allowing some slack)
      const commentTime = new Date(c.created_at);
      const secs = (commentTime.getTime() - testStartTime.getTime()) / 1000;
      expect(secs).toBeLessThanOrEqual(60);
      expect(secs).toBeGreaterThanOrEqual(0);
    }

    console.log(`Found ${relevantComments.length} relevant comments created by this test`);
  });
});

function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
