// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Octokit } from '@octokit/rest';
import { execSync } from "node:child_process";

const OWNER="defenseunicorns";
const REPO="lula";
const PULL_NUMBER=119;
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
			GITHUB_TOKEN = process.env.GITHUB_TOKEN;
		}
		
		octokit = new Octokit({ auth: GITHUB_TOKEN });
		testStartTime = new Date();
		
		try {
			command_output = execSync(`OWNER=${OWNER} REPO=${REPO} PULL_NUMBER=${PULL_NUMBER} GITHUB_TOKEN=${GITHUB_TOKEN} node dist/index.js crawl`, { 
				encoding: 'utf8',
				timeout: 60000 
			});
		} catch (error) {
			console.error('Failed to run crawl command:', error);
			throw error;
		}
	}, 120000); 
	afterAll( async ()=> {
		for (const comment_id of comment_ids) {
			try {
				await octokit.request(`DELETE /repos/${OWNER}/${REPO}/issues/comments/${comment_id}`, {
					owner: OWNER,
					repo: REPO,
					comment_id: comment_id,
					headers: {
						'X-GitHub-Api-Version': '2022-11-28'
					}
				});
				console.log(`Deleted comment ${comment_id}`);
			} catch (error) {
				console.error(`Failed to delete comment ${comment_id}:`, error);
			}
		}
	});
	it("should console log command output with the files that changed, the lines that changed, and the hash", () => {
		console.log('Command output length:', command_output.length);
		console.log('Command output:', JSON.stringify(command_output));
		
		if (!command_output || command_output.length === 0) {
			throw new Error('No command output received - the crawl command may have failed or produced no output');
		}
		
		expect(command_output).toContain("Commenting on integration/test-files/ex.ts: **Compliance Alert**:`integration/test-files/ex.ts` changed between lines 20–31.");
		expect(command_output).toContain("UUID `123e4567-e89b-12d3-a456-426614174000` may be out of compliance.");
		expect(command_output).toContain("SHA-256 of block contents: `f889702fd3330d939fadb5f37087948e42a840d229646523989778e2b1586926`.");
		expect(command_output).toContain("Please review the changes to ensure they meet compliance standards.");
		expect(command_output).toContain("Commenting on integration/test-files/ex.yaml: **Compliance Alert**:`integration/test-files/ex.yaml` changed between lines 1–5.");
		expect(command_output).toContain("UUID `123e4567-e89b-12d3-a456-426614174001` may be out of compliance.");
		expect(command_output).toContain("SHA-256 of block contents: `f6b6f51335248062b003696623bfe21cea977ca7f4e4163b182b0036fa699eb4`");
	}, { timeout: 2 * 60 * 1000})
	it('comments on a PR with lines changed between lulaStart and lulaEnd', async () => {
		await sleep(10);
		
		const { data: comments } = await octokit.request(`GET /repos/${OWNER}/${REPO}/issues/${PULL_NUMBER}/comments`, {
			owner: OWNER,
			repo: REPO,
			issue_number: PULL_NUMBER,
			headers: {
				'X-GitHub-Api-Version': '2022-11-28'
			}
		});
		
		// Filter for comments created after our test started and containing compliance alerts
		const relevantComments = comments.filter(comment => {
			comment_ids.push(comment.id);
			const commentTime = new Date(comment.created_at);
			return commentTime >= testStartTime && comment.body.includes("**Compliance Alert**:");
		});
		
		expect(relevantComments.length).toBeGreaterThan(0);
		
		for (const comment of relevantComments) {
			expect(comment.body).toContain("**Compliance Alert**:");
			expect(comment.body).toMatch(/changed between lines \d+–\d+/);
			expect(comment.body).toMatch(/UUID `[-a-f0-9]{36}` may be out of compliance./);
			expect(comment.body).toMatch(/SHA-256 of block contents: `[a-f0-9]{64}`./);
			expect(comment.body).toContain("Please review the changes to ensure they meet compliance standards.");
			
			const commentTime = new Date(comment.created_at);
			const timeDifferenceInSeconds = (commentTime.getTime() - testStartTime.getTime()) / 1000;
			expect(timeDifferenceInSeconds).toBeLessThanOrEqual(30);
			expect(timeDifferenceInSeconds).toBeGreaterThanOrEqual(0);
		}
		
		console.log(`Found ${relevantComments.length} relevant comments created by this test`);
	}, { timeout: 2 * 60 * 1000});
});

function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
