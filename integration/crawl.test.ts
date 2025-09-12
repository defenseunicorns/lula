// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Octokit } from '@octokit/rest';
import execSync from 'child_process';

const OWNER="defenseunicorns";
const REPO="pepr-excellent-examples";
const PULL_NUMBER=374;
let GITHUB_TOKEN: string; 
let octokit: Octokit;
let comment_ids: number[] = [];
let command_output = "";
let testStartTime: Date;
describe('crawl', () => {
	beforeAll(() => {
		// Skip test if no GitHub token is available
		if (!process.env.GITHUB_TOKEN) {
			try {
				GITHUB_TOKEN = execSync.execSync(`gh auth token`, { encoding: 'utf8' }).trim();
			} catch (error) {
				console.log('No GitHub token available, skipping integration test');
				return;
			}
		} else {
			GITHUB_TOKEN = process.env.GITHUB_TOKEN;
		}
		
		octokit = new Octokit({ auth: GITHUB_TOKEN });
		testStartTime = new Date();
		
		try {
			console.log('Running crawl command...');
			// Use the built version instead of npx to ensure we're testing the current build
			const result = execSync.execSync(`OWNER=${OWNER} REPO=${REPO} PULL_NUMBER=${PULL_NUMBER} GITHUB_TOKEN=${GITHUB_TOKEN} ./dist/lula2 crawl`, { 
				encoding: 'utf8',
				timeout: 60000, // 60 second timeout
				stdio: ['pipe', 'pipe', 'pipe'], // capture stdout and stderr
				cwd: process.cwd() // ensure we're in the right directory
			});
			command_output = result;
			console.log('Crawl command completed successfully');
			console.log('Output length:', command_output.length);
		} catch (error) {
			console.error('Failed to run crawl command:', error);
			console.log('Trying fallback with npx...');
			try {
				const fallbackResult = execSync.execSync(`OWNER=${OWNER} REPO=${REPO} PULL_NUMBER=${PULL_NUMBER} GITHUB_TOKEN=${GITHUB_TOKEN} npx lula2 crawl`, { 
					encoding: 'utf8',
					timeout: 60000,
					stdio: ['pipe', 'pipe', 'pipe']
				});
				command_output = fallbackResult;
				console.log('Fallback command succeeded');
			} catch (fallbackError) {
				console.error('Fallback also failed:', fallbackError);
				if (error.stdout) {
					console.log('STDOUT:', error.stdout.toString());
					command_output = error.stdout.toString();
				}
				if (error.stderr) {
					console.log('STDERR:', error.stderr.toString());
				}
				if (!command_output) {
					throw error;
				}
			}
		}
	}, 120000); // 2 minute timeout for beforeAll
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
	it("should console log command output with the files that changed, the lines that changed, and the hash", { timeout: 2 * 60 * 1000 }, () => {
		console.log('Command output length:', command_output.length);
		console.log('Command output:', JSON.stringify(command_output));
		
		if (!command_output || command_output.length === 0) {
			throw new Error('No command output received - the crawl command may have failed or produced no output');
		}
		
		expect(command_output).toContain("Commenting on hello-pepr-ns-all/capabilities/namespace.ts: **Compliance Alert**:`hello-pepr-ns-all/capabilities/namespace.ts` changed between lines 24–34.");
		expect(command_output).toContain("UUID `123e4567-e89b-12d3-a456-426614174000` may be out of compliance.");
		expect(command_output).toContain("SHA-256 of block contents: `b2cdf6cac0cbb0ffb372acb487900e0d706526ff58979384894e99d50275763e`.");
		expect(command_output).toContain("Please review the changes to ensure they meet compliance standards.");
		expect(command_output).toContain("Commenting on hello-pepr-ns-all/ex.yaml: **Compliance Alert**:`hello-pepr-ns-all/ex.yaml` changed between lines 1–6.");
		expect(command_output).toContain("UUID `123e4567-e89b-12d3-a456-426614174001` may be out of compliance.");
		expect(command_output).toContain("SHA-256 of block contents: `c5464d5233e9547ca08cbe1f910966008bad22cc1ab4d05cb9f39f713ae76fe4`.");
	})
	it('comments on a PR with lines changed between lulaStart and lulaEnd', { timeout: 2 * 60 * 1000 }, async () => {
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
	});
});

function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
