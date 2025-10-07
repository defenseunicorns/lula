// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors

import fs from 'fs';
import { Octokit } from '@octokit/rest';
import { Command, Option } from 'commander';
import { createHash } from 'crypto';

type FileContentResponse = {
	content: string;
	encoding: 'base64' | string;
};
const closingBody = `\n\n---\n\n<sub>**Tip:** Customize your compliance reviews with <a href="https://github.com/defenseunicorns/lula.git" class="Link--inTextBlock" target="_blank" rel="noopener noreferrer">Lula</a>.</sub>`;
export const LULA_SIGNATURE = '<!-- LULA_SIGNATURE:v1 -->';
// Add a post mode union for future expansion
type PostMode = 'review' | 'comment';

/** Utility to post a finding based on the chosen mode. */
export async function postFinding(params: {
	octokit: Octokit;
	postMode: PostMode;
	owner: string;
	repo: string;
	pull_number: number;
	body: string;
}): Promise<void> {
	const { octokit, postMode, owner, repo, pull_number, body } = params;

	if (postMode === 'comment') {
		await octokit.issues.createComment({
			owner,
			repo,
			issue_number: pull_number,
			body
		});
		return;
	}

	await octokit.pulls.createReview({
		owner,
		repo,
		pull_number,
		body,
		event: 'REQUEST_CHANGES'
	});
}

/**
 * Get the pull request context from the environment or GitHub event payload.
 *
 * @returns The pull request context containing the owner, repo, and pull number.
 */
export function getPRContext(): { owner: string; repo: string; pull_number: number } {
	const fallbackOwner = process.env.OWNER;
	const fallbackRepo = process.env.REPO;
	const fallbackNumber = process.env.PULL_NUMBER;

	if (fallbackOwner && fallbackRepo && fallbackNumber) {
		return {
			owner: fallbackOwner!,
			repo: fallbackRepo!,
			pull_number: parseInt(fallbackNumber!, 10)
		};
	}

	if (process.env.GITHUB_EVENT_PATH && process.env.GITHUB_REPOSITORY) {
		const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH!, 'utf8'));
		const [owner, repo] = process.env.GITHUB_REPOSITORY!.split('/');
		const pull_number = event.pull_request?.number;
		if (!pull_number) throw new Error('PR number not found in GitHub event payload.');
		return { owner, repo, pull_number };
	}

	throw new Error('Set OWNER, REPO, and PULL_NUMBER in the environment for local use.');
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
 * Get the blocks that were removed (exist in old text but not in new text).
 *
 * @param oldText The original text.
 * @param newText The modified text.
 *
 * @returns An array of objects representing the removed blocks from the old text.
 */
export function getRemovedBlocks(
	oldText: string,
	newText: string
): {
	uuid: string;
	startLine: number;
	endLine: number;
}[] {
	const oldBlocks = extractMapBlocks(oldText);
	const newBlocks = extractMapBlocks(newText);
	const removed = [];

	for (const oldBlock of oldBlocks) {
		const newMatch = newBlocks.find((b) => b.uuid === oldBlock.uuid);
		if (!newMatch) {
			removed.push(oldBlock);
		}
	}

	return removed;
}

/**
 * Check if a text contains Lula annotations (@lulaStart or @lulaEnd).
 *
 * @param text The text content to check.
 * @returns True if the text contains Lula annotations, false otherwise.
 */
export function containsLulaAnnotations(text: string): boolean {
	const lines = text.split('\n');
	return lines.some((line) => line.includes('@lulaStart') || line.includes('@lulaEnd'));
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
		.addOption(
			new Option('--post-mode <mode>', 'How to post findings')
				.choices(['review', 'comment'])
				.default('review')
		)
		.action(async (opts) => {
			let leavePost = false;
			const { owner, repo, pull_number } = getPRContext();
			console.log(`Analyzing PR #${pull_number} in ${owner}/${repo} for compliance changes...`);
			const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
			const pr = await octokit.pulls.get({ owner, repo, pull_number });
			const prBranch = pr.data.head.ref;

			const { data: files } = await octokit.pulls.listFiles({ owner, repo, pull_number });

			let commentBody =
				`${LULA_SIGNATURE}\n` +
				`## Lula Compliance Overview\n\n` +
				`Please review the changes to ensure they meet compliance standards.\n\n` +
				`### Reviewed Changes\n\n` +
				`Lula reviewed ${files.length} files changed that affect compliance.\n\n`;

			const deletedFilesWithAnnotations = [];
			for (const file of files) {
				if (file.status === 'removed') {
					try {
						const oldText = await fetchRawFileViaAPI({
							octokit,
							owner,
							repo,
							path: file.filename,
							ref: 'main'
						});

						if (containsLulaAnnotations(oldText)) {
							deletedFilesWithAnnotations.push(file.filename);
						}
					} catch (err) {
						console.error(`Error checking deleted file ${file.filename}: ${err}`);
					}
				}
			}

			// Add warning about deleted files with annotations
			if (deletedFilesWithAnnotations.length > 0) {
				leavePost = true;
				commentBody += `\n\n**Compliance Warning: Files with Lula annotations were deleted**\n\n`;
				commentBody += `The following files contained compliance annotations (\`@lulaStart\`/\`@lulaEnd\`) and were deleted in this PR. This may affect compliance coverage:\n\n`;

				for (const filename of deletedFilesWithAnnotations) {
					commentBody += `- \`${filename}\`\n`;
				}

				commentBody += `\nPlease review whether:\n`;
				commentBody += `- The compliance coverage provided by these files is still needed\n`;
				commentBody += `- Alternative compliance measures have been implemented\n`;
				commentBody += `- The deletion is intentional and compliance-approved\n\n`;
				commentBody += `---\n\n`;
			}

			for (const file of files) {
				if (file.status === 'added' || file.status === 'removed') continue;
				try {
					const [oldText, newText] = await Promise.all([
						fetchRawFileViaAPI({ octokit, owner, repo, path: file.filename, ref: 'main' }),
						fetchRawFileViaAPI({ octokit, owner, repo, path: file.filename, ref: prBranch })
					]);

					const changedBlocks = getChangedBlocks(oldText, newText);
					const removedBlocks = getRemovedBlocks(oldText, newText);

					// Handle changed blocks
					for (const block of changedBlocks) {
						console.log(`Commenting regarding \`${file.filename}\`.`);
						leavePost = true;
						commentBody += `\n\n---\n| File | Lines Changed |\n` + `| ---- | ------------- |\n`;
						const newBlockText = newText
							.split('\n')
							.slice(block.startLine, block.endLine)
							.join('\n');

						const blockSha256 = createHash('sha256').update(newBlockText).digest('hex');
						commentBody += `| \`${file.filename}\` | \`${block.startLine + 1}–${block.endLine}\` |\n> **uuid**-\`${block.uuid}\`\n **sha256** \`${blockSha256}\`\n\n`;
					}

					// Handle removed annotations
					if (removedBlocks.length > 0) {
						leavePost = true;
						console.log(`Found removed annotations in \`${file.filename}\`.`);
						commentBody += `\n\n**Compliance Warning: Lula annotations were removed from \`${file.filename}\`**\n\n`;
						commentBody += `The following compliance annotation blocks were present in the original file but are missing in the updated version:\n\n`;

						// Add table header once before listing all removed blocks
						commentBody += `| File | Original Lines | UUID |\n`;
						commentBody += `| ---- | -------------- | ---- |\n`;
						for (const block of removedBlocks) {
							const oldBlockText = oldText
								.split('\n')
								.slice(block.startLine, block.endLine)
								.join('\n');
							const blockSha256 = createHash('sha256').update(oldBlockText).digest('hex');
							commentBody += `| \`${file.filename}\` | \`${block.startLine + 1}–${block.endLine}\` | \`${block.uuid}\` |\n`;
							commentBody += `> **sha256** \`${blockSha256}\`\n\n`;
						}

						commentBody += `Please review whether:\n`;
						commentBody += `- The removal of these compliance annotations is intentional\n`;
						commentBody += `- Alternative compliance measures have been implemented\n`;
						commentBody += `- The compliance coverage is still adequate\n\n`;
						commentBody += `---\n\n`;
					}
				} catch (err) {
					console.error(`Error processing ${file.filename}: ${err}`);
				}
			}
			if (opts.postMode === 'comment') {
				await deleteOldIssueComments({ octokit, owner, repo, pull_number });
			} else {
				await dismissOldReviews({ octokit, owner, repo, pull_number });
				await deleteOldReviewComments({ octokit, owner, repo, pull_number });
			}
			if (leavePost) {
				await postFinding({
					octokit,
					postMode: opts.postMode,
					owner,
					repo,
					pull_number,
					body: commentBody + closingBody
				});
				const header = `Posted (${opts.postMode})`;
				const underline = '-'.repeat(header.length);
				console.log(`\n${header}\n${underline}\n\n${commentBody + closingBody}\n\n`);
			}
		});
}

export async function deleteOldIssueComments({
	octokit,
	owner,
	repo,
	pull_number
}: {
	octokit: Octokit;
	owner: string;
	repo: string;
	pull_number: number;
}): Promise<void> {
	let page = 1;
	while (true) {
		const { data: comments } = await octokit.issues.listComments({
			owner,
			repo,
			issue_number: pull_number,
			per_page: 100,
			page
		});
		if (!comments.length) break;

		for (const c of comments) {
			const hasSignature = (c.body ?? '').includes(LULA_SIGNATURE);
			if (hasSignature) {
				await octokit.issues.deleteComment({ owner, repo, comment_id: c.id });
				break;
			}
		}
		page++;
	}
}

export async function deleteOldReviewComments({
	octokit,
	owner,
	repo,
	pull_number
}: {
	octokit: Octokit;
	owner: string;
	repo: string;
	pull_number: number;
}): Promise<void> {
	let page = 1;
	while (true) {
		const { data: reviewComments } = await octokit.pulls.listReviewComments({
			owner,
			repo,
			pull_number,
			per_page: 100,
			page
		});
		if (!reviewComments.length) break;

		for (const rc of reviewComments) {
			const hasSignature = (rc.body ?? '').includes(LULA_SIGNATURE);
			if (hasSignature) {
				await octokit.pulls.deleteReviewComment({ owner, repo, comment_id: rc.id });
				break;
			}
		}
		page++;
	}
}

export async function dismissOldReviews({
	octokit,
	owner,
	repo,
	pull_number
}: {
	octokit: Octokit;
	owner: string;
	repo: string;
	pull_number: number;
}): Promise<void> {
	let page = 1;
	while (true) {
		const { data: reviews } = await octokit.pulls.listReviews({
			owner,
			repo,
			pull_number,
			per_page: 100,
			page
		});
		if (!reviews.length) break;

		for (const r of reviews) {
			const hasSignature = (r.body ?? '').includes(LULA_SIGNATURE);
			const isAlreadyDismissed = r.state === 'DISMISSED';

			if (hasSignature && !isAlreadyDismissed) {
				await octokit.pulls.dismissReview({
					owner,
					repo,
					pull_number,
					review_id: r.id,
					message: 'Superseded by a new Lula compliance review.'
				});
				break;
			}
		}
		page++;
	}
}
