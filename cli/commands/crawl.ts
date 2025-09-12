// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors

import fs from 'fs';
import { Octokit } from '@octokit/rest';
import { Command } from 'commander';
import { createHash } from 'crypto';

type FileContentResponse = {
	content: string;
	encoding: 'base64' | string;
};

/**
 * Get the pull request context from the environment or GitHub event payload.
 *
 * @returns The pull request context containing the owner, repo, and pull number.
 */
export function getPRContext(): { owner: string; repo: string; pull_number: number } {
	const fallbackOwner = process.env.OWNER;
	const fallbackRepo = process.env.REPO;
	const fallbackNumber = process.env.PULL_NUMBER;

	if (process.env.GITHUB_EVENT_PATH && process.env.GITHUB_REPOSITORY) {
		const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
		const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
		const pull_number = event.pull_request?.number;
		if (!pull_number) throw new Error('PR number not found in GitHub event payload.');
		return { owner, repo, pull_number };
	}

	if (!fallbackOwner || !fallbackRepo || !fallbackNumber) {
		throw new Error('Set OWNER, REPO, and PULL_NUMBER in the environment for local use.');
	}

	return {
		owner: fallbackOwner,
		repo: fallbackRepo,
		pull_number: parseInt(fallbackNumber, 10)
	};
}

/**
 * Fetch a raw file from a GitHub repository via the GitHub API.
 *
 * @param params - The parameters.
 * @param params.octokit - An authenticated Octokit instance.
 * @param params.owner - The owner of the repository.
 * @param params.repo - The name of the repository.
 * @param params.path - The path to the file in the repository.
 * @param params.ref - The git reference (branch, tag, or commit SHA).
 * @returns The content of the file as a string.
 */
export async function fetchRawFileViaAPI({
	octokit,
	owner,
	repo,
	path,
	ref
}: {
	octokit: Octokit;
	owner: string;
	repo: string;
	path: string;
	ref: string;
}): Promise<string> {
	const res = await octokit.repos.getContent({
		owner,
		repo,
		path,
		ref,
		headers: {
			accept: 'application/vnd.github.v3.raw'
		}
	});

	if (typeof res.data === 'string') {
		return res.data;
	}

	if (
		typeof res.data === 'object' &&
		res.data !== null &&
		'content' in res.data &&
		typeof (res.data as { content: unknown }).content === 'string'
	) {
		const { content } = res.data as FileContentResponse;
		return Buffer.from(content, 'base64').toString('utf-8');
	}

	throw new Error('Unexpected GitHub API response shape');
}

/**
 * Extracts all @lulaStart and @lulaEnd blocks from the given content.
 *
 * @param content - The content to extract blocks from.
 *
 * @returns An array of objects containing the UUID, start line, and end line of each block.
 */
export function extractMapBlocks(content: string): {
	uuid: string;
	startLine: number;
	endLine: number;
}[] {
	const lines = content.split('\n');
	interface MapBlock {
		uuid: string;
		startLine: number;
		endLine: number;
	}
	const blocks: MapBlock[] = [];
	const stack: { uuid: string; line: number }[] = [];

	lines.forEach((line, idx) => {
		const start = line.match(/@lulaStart\s+([a-f0-9-]+)/);
		const end = line.match(/@lulaEnd\s+([a-f0-9-]+)/);

		if (start) {
			stack.push({ uuid: start[1], line: idx });
		} else if (end) {
			const last = stack.find((s) => s.uuid === end[1]);
			if (last) {
				blocks.push({ uuid: last.uuid, startLine: last.line, endLine: idx + 1 });
				stack.splice(stack.indexOf(last), 1);
			}
		}
	});

	return blocks;
}

/**
 * Get the changed blocks between two versions of text.
 *
 * @param oldText The original text.
 * @param newText The modified text.
 *
 * @returns An array of objects representing the changed blocks.
 */
export function getChangedBlocks(
	oldText: string,
	newText: string
): {
	uuid: string;
	startLine: number;
	endLine: number;
}[] {
	const oldBlocks = extractMapBlocks(oldText);
	const newBlocks = extractMapBlocks(newText);
	const changed = [];

	for (const newBlock of newBlocks) {
		const oldMatch = oldBlocks.find((b) => b.uuid === newBlock.uuid);
		if (!oldMatch) continue;

		const oldSegment = oldText.split('\n').slice(oldMatch.startLine, oldMatch.endLine).join('\n');
		const newSegment = newText.split('\n').slice(newBlock.startLine, newBlock.endLine).join('\n');

		if (oldSegment !== newSegment) {
			changed.push(newBlock);
		}
	}

	return changed;
}
/**
 * Defines the "crawl" command for the CLI.
 *
 * @returns The configured Command instance.
 */
export function crawlCommand(): Command {
	return new Command()
		.command('crawl')
		.description('Detect compliance-related changes between @lulaStart and @lulaEnd in PR files')
		.action(async () => {
			const { owner, repo, pull_number } = getPRContext();
			console.log(`Analyzing PR #${pull_number} in ${owner}/${repo} for compliance changes...`);
			const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
			const pr = await octokit.pulls.get({ owner, repo, pull_number });
			const prBranch = pr.data.head.ref;

			const { data: files } = await octokit.pulls.listFiles({ owner, repo, pull_number });

			for (const file of files) {
				if (file.status === 'added') continue;
				try {
					const [oldText, newText] = await Promise.all([
						fetchRawFileViaAPI({ octokit, owner, repo, path: file.filename, ref: 'main' }),
						fetchRawFileViaAPI({ octokit, owner, repo, path: file.filename, ref: prBranch })
					]);

					const changedBlocks = getChangedBlocks(oldText, newText);

					for (const block of changedBlocks) {
						const newBlockText = newText
							.split('\n')
							.slice(block.startLine, block.endLine)
							.join('\n');

						const blockSha256 = createHash('sha256').update(newBlockText).digest('hex');
						const commentBody =
							`**Compliance Alert**:\`${file.filename}\` changed between lines ${block.startLine + 1}–${block.endLine}.` +
							`\nUUID \`${block.uuid}\` may be out of compliance.` +
							`\nSHA-256 of block contents: \`${blockSha256}\`.` +
							`\n\nPlease review the changes to ensure they meet compliance standards.\n\n`;
						console.log(`Commenting on ${file.filename}: ${commentBody}`);
						await octokit.issues.createComment({
							owner,
							repo,
							issue_number: pull_number,
							body: commentBody
						});
						//   await octokit.pulls.createReview({
						//   owner,
						//   repo,
						//   pull_number,
						//   body: commentBody,
						//   event: "REQUEST_CHANGES",
						// })
					}
				} catch (err) {
					console.error(`Error processing ${file.filename}: ${err}`);
				}
			}
		});
}
