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

/**
 * Interface for GitHub pull request file objects
 */
export interface PullRequestFile {
	sha: string | null;
	filename: string;
	status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
	additions: number;
	deletions: number;
	changes: number;
	blob_url: string;
	raw_url: string;
	contents_url: string;
	patch?: string;
	previous_filename?: string;
}
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

	const oldLines = oldText.split('\n');
	const newLines = newText.split('\n');

	// group the blocks by UUID
	const oldBlocksByUuid = new Map<string, typeof oldBlocks>();
	const newBlocksByUuid = new Map<string, typeof newBlocks>();

	// Populate the lists by UUID
	oldBlocks.forEach((block) => {
		if (!oldBlocksByUuid.has(block.uuid)) {
			oldBlocksByUuid.set(block.uuid, []);
		}
		oldBlocksByUuid.get(block.uuid)!.push(block);
	});

	newBlocks.forEach((block) => {
		if (!newBlocksByUuid.has(block.uuid)) {
			newBlocksByUuid.set(block.uuid, []);
		}
		newBlocksByUuid.get(block.uuid)!.push(block);
	});

	for (const [uuid, newUuidBlocks] of newBlocksByUuid) {
		const oldUuidBlocks = oldBlocksByUuid.get(uuid) || [];

		// If there is no old block with this UUID then skip it bc it is new
		if (oldUuidBlocks.length === 0) continue;

		if (oldUuidBlocks.length !== newUuidBlocks.length) {
			// Check each old block to see if its content still exists somewhere in the new blocks
			for (const oldBlock of oldUuidBlocks) {
				const oldContent = extractBlockContent(oldLines, oldBlock.startLine, oldBlock.endLine);

				// Find if this content still exists in any new block
				const stillExists = newUuidBlocks.some((newBlock) => {
					const newContent = extractBlockContent(newLines, newBlock.startLine, newBlock.endLine);
					return oldContent === newContent;
				});

				// If the old content doesn't exist anymore, we need to find what it became in order to leave the PR comment for the line numbers
				if (!stillExists) {
					// Find the most likely candidate (closest position that hasn't been matched)
					const candidates = newUuidBlocks.filter((newBlock) => {
						// Don't consider blocks that are exact matches to other old blocks
						return !oldUuidBlocks.some((otherOldBlock) => {
							if (otherOldBlock === oldBlock) return false;
							const otherOldContent = extractBlockContent(
								oldLines,
								otherOldBlock.startLine,
								otherOldBlock.endLine
							);
							const newContent = extractBlockContent(
								newLines,
								newBlock.startLine,
								newBlock.endLine
							);
							return otherOldContent === newContent;
						});
					});

					if (candidates.length > 0) {
						// Choose the candidate with the closest position
						const closest = candidates.reduce((best, candidate) => {
							const bestDistance = Math.abs(oldBlock.startLine - best.startLine);
							const candidateDistance = Math.abs(oldBlock.startLine - candidate.startLine);
							return candidateDistance < bestDistance ? candidate : best;
						});
						changed.push(closest);
					}
				}
			}
			continue;
		}

		// Same count - do optimal 1:1 pairing based on content similarity and position
		const pairings = findOptimalPairings(oldUuidBlocks, newUuidBlocks, oldLines, newLines);

		// Check each pairing for content changes
		for (const { oldBlock, newBlock } of pairings) {
			const oldContent = extractBlockContent(oldLines, oldBlock.startLine, oldBlock.endLine);
			const newContent = extractBlockContent(newLines, newBlock.startLine, newBlock.endLine);

			if (oldContent !== newContent) {
				changed.push(newBlock);
			}
		}
	}

	return changed;
}

/**
 * Find optimal 1:1 pairings between old and new blocks with the same UUID.
 * Uses a combination of content similarity and positional proximity.
 */
export function findOptimalPairings(
	oldBlocks: Array<{ uuid: string; startLine: number; endLine: number }>,
	newBlocks: Array<{ uuid: string; startLine: number; endLine: number }>,
	oldLines: string[],
	newLines: string[]
): Array<{ oldBlock: (typeof oldBlocks)[0]; newBlock: (typeof newBlocks)[0] }> {
	const pairings: Array<{ oldBlock: (typeof oldBlocks)[0]; newBlock: (typeof newBlocks)[0] }> = [];
	const usedOldBlocks = new Set<number>();
	const usedNewBlocks = new Set<number>();

	// Calculate similarity matrix (content similarity + positional distance)
	const similarities: Array<{ oldIndex: number; newIndex: number; score: number }> = [];

	for (let oldIndex = 0; oldIndex < oldBlocks.length; oldIndex++) {
		for (let newIndex = 0; newIndex < newBlocks.length; newIndex++) {
			const oldBlock = oldBlocks[oldIndex];
			const newBlock = newBlocks[newIndex];

			const oldContent = extractBlockContent(oldLines, oldBlock.startLine, oldBlock.endLine);
			const newContent = extractBlockContent(newLines, newBlock.startLine, newBlock.endLine);

			// Content similarity (1.0 if identical, 0.0 if completely different)
			const contentSimilarity = oldContent.trim() === newContent.trim() ? 1.0 : 0.0;

			// Positional similarity (closer positions = higher score)
			const positionDistance = Math.abs(oldBlock.startLine - newBlock.startLine);
			const maxDistance = Math.max(oldBlocks.length, newBlocks.length) * 10; // Normalize
			const positionSimilarity = 1.0 - Math.min(positionDistance / maxDistance, 1.0);

			// Weighted combination: content similarity is more important than position
			const score = contentSimilarity * 0.8 + positionSimilarity * 0.2;

			similarities.push({ oldIndex, newIndex, score });
		}
	}

	// Sort by score (highest first) and greedily assign pairings
	similarities.sort((a, b) => b.score - a.score);

	for (const { oldIndex, newIndex } of similarities) {
		if (!usedOldBlocks.has(oldIndex) && !usedNewBlocks.has(newIndex)) {
			pairings.push({
				oldBlock: oldBlocks[oldIndex],
				newBlock: newBlocks[newIndex]
			});
			usedOldBlocks.add(oldIndex);
			usedNewBlocks.add(newIndex);
		}
	}

	return pairings;
}

/**
 * Extract the content between @lulaStart and @lulaEnd
 *
 * @param lines The array of lines.
 * @param startLine The line number of @lulaStart
 * @param endLine The line number of @lulaEnd
 * @returns The content between the annotations as a string.
 */
function extractBlockContent(lines: string[], startLine: number, endLine: number): string {
	return lines.slice(startLine + 1, endLine - 1).join('\n');
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
 * Interface for crawl analysis context
 */
export interface CrawlContext {
	octokit: Octokit;
	owner: string;
	repo: string;
	pull_number: number;
	prBranch: string;
	baseSha: string;
	headSha: string;
	files: PullRequestFile[];
}

/**
 * Interface for analysis results
 */
export interface AnalysisResult {
	hasFindings: boolean;
	commentBody: string;
}

/**
 * Create the initial comment body for compliance overview.
 */
export function createInitialCommentBody(filesCount: number): string {
	return (
		`${LULA_SIGNATURE}\n` +
		`## Lula Compliance Overview\n\n` +
		`Please review the changes to ensure they meet compliance standards.\n\n` +
		`### Reviewed Changes\n\n` +
		`Lula reviewed ${filesCount} files changed that affect compliance.\n\n`
	);
}

/**
 * Check deleted files for Lula annotations and generate warning content.
 */
export async function analyzeDeletedFiles(context: CrawlContext): Promise<{
	hasFindings: boolean;
	warningContent: string;
}> {
	const { octokit, owner, repo, baseSha, files } = context;
	const deletedFilesWithAnnotations: string[] = [];

	for (const file of files) {
		if (file.status === 'removed') {
			try {
				const oldText = await fetchRawFileViaAPI({
					octokit,
					owner,
					repo,
					path: file.filename,
					ref: baseSha
				});

				if (containsLulaAnnotations(oldText)) {
					deletedFilesWithAnnotations.push(file.filename);
				}
			} catch (err) {
				console.error(`Error checking deleted file ${file.filename}: ${err}`);
			}
		}
	}

	if (deletedFilesWithAnnotations.length === 0) {
		return { hasFindings: false, warningContent: '' };
	}

	let warningContent = `\n\n**Compliance Warning: Files with Lula annotations were deleted**\n\n`;
	warningContent += `The following files contained compliance annotations (\`@lulaStart\`/\`@lulaEnd\`) and were deleted in this PR. This may affect compliance coverage:\n\n`;

	for (const filename of deletedFilesWithAnnotations) {
		warningContent += `- \`${filename}\`\n`;
	}

	warningContent += `\nPlease review whether:\n`;
	warningContent += `- The compliance coverage provided by these files is still needed\n`;
	warningContent += `- Alternative compliance measures have been implemented\n`;
	warningContent += `- The deletion is intentional and compliance-approved\n\n`;
	warningContent += `---\n\n`;

	return { hasFindings: true, warningContent };
}

/**
 * Generate comment content for changed blocks in a file.
 */
export function generateChangedBlocksContent(
	filename: string,
	changedBlocks: { uuid: string; startLine: number; endLine: number }[],
	newText: string
): string {
	if (changedBlocks.length === 0) {
		return '';
	}

	console.log(`Commenting regarding \`${filename}\`.`);

	let content = `\n\n---\n| File | Lines Changed |\n| ---- | ------------- |\n`;

	for (const block of changedBlocks) {
		content += `| \`${filename}\` | \`${block.startLine + 1}–${block.endLine}\` |\n`;
	}

	content += `\n`;
	for (const block of changedBlocks) {
		const newBlockText = newText.split('\n').slice(block.startLine, block.endLine).join('\n');
		const blockSha256 = createHash('sha256').update(newBlockText).digest('hex');
		content += `**UUID:** \`${block.uuid}\`\n**sha256:** \`${blockSha256}\`\n\n`;
	}

	return content;
}

/**
 * Generate comment content for removed blocks in a file.
 */
export function generateRemovedBlocksContent(
	filename: string,
	removedBlocks: { uuid: string; startLine: number; endLine: number }[],
	oldText: string
): string {
	if (removedBlocks.length === 0) {
		return '';
	}

	console.log(`Found removed annotations in \`${filename}\`.`);
	let content = `\n\n**Compliance Warning: Lula annotations were removed from \`${filename}\`**\n\n`;
	content += `The following compliance annotation blocks were present in the original file but are missing in the updated version:\n\n`;

	// Add table header once before listing all removed blocks
	content += `| File | Original Lines | UUID |\n`;
	content += `| ---- | -------------- | ---- |\n`;

	// First, generate all table rows
	for (const block of removedBlocks) {
		content += `| \`${filename}\` | \`${block.startLine + 1}–${block.endLine}\` | \`${block.uuid}\` |\n`;
	}

	// Then add sha256 information for each block after the table
	content += `\n`;
	for (const block of removedBlocks) {
		const oldBlockText = oldText.split('\n').slice(block.startLine, block.endLine).join('\n');
		const blockSha256 = createHash('sha256').update(oldBlockText).digest('hex');
		content += `**UUID:** \`${block.uuid}\`\n**sha256:** \`${blockSha256}\`\n\n`;
	}

	content += `Please review whether:\n`;
	content += `- The removal of these compliance annotations is intentional\n`;
	content += `- Alternative compliance measures have been implemented\n`;
	content += `- The compliance coverage is still adequate\n\n`;
	content += `---\n\n`;

	return content;
}

/**
 * Analyze modified files for compliance changes.
 */
export async function analyzeModifiedFiles(context: CrawlContext): Promise<{
	hasFindings: boolean;
	changesContent: string;
}> {
	const { octokit, owner, repo, baseSha, headSha, files } = context;
	let changesContent = '';
	let hasFindings = false;

	for (const file of files) {
		if (file.status === 'added' || file.status === 'removed') continue;

		try {
			const oldPath =
				file.status === 'renamed' && file.previous_filename
					? file.previous_filename
					: file.filename;
			const newPath = file.filename;

			const [oldText, newText] = await Promise.all([
				fetchRawFileViaAPI({ octokit, owner, repo, path: oldPath, ref: baseSha }),
				fetchRawFileViaAPI({ octokit, owner, repo, path: newPath, ref: headSha })
			]);

			const changedBlocks = getChangedBlocks(oldText, newText);
			const removedBlocks = getRemovedBlocks(oldText, newText);

			// Skip reporting if no existing compliance content was actually modified or removed
			// This filters out cases where new Lula annotations are added but existing ones unchanged
			const hasActualComplianceChanges = changedBlocks.length > 0 || removedBlocks.length > 0;

			if (hasActualComplianceChanges) {
				hasFindings = true;

				// Handle changed blocks
				if (changedBlocks.length > 0) {
					changesContent += generateChangedBlocksContent(file.filename, changedBlocks, newText);
				}

				// Handle removed annotations
				if (removedBlocks.length > 0) {
					changesContent += generateRemovedBlocksContent(file.filename, removedBlocks, oldText);
				}
			} else {
				// Log when we skip files that only have new annotations added
				const oldBlocks = extractMapBlocks(oldText);
				const newBlocks = extractMapBlocks(newText);
				if (newBlocks.length > oldBlocks.length) {
					console.log(
						`Skipping ${file.filename}: only new Lula annotations added, no existing compliance content modified`
					);
				}
			}
		} catch (err) {
			console.error(`Error processing ${file.filename}: ${err}`);
		}
	}

	return { hasFindings, changesContent };
}

/**
 * Perform complete compliance analysis on a PR.
 */
export async function performComplianceAnalysis(context: CrawlContext): Promise<AnalysisResult> {
	let commentBody = createInitialCommentBody(context.files.length);
	let hasFindings = false;

	// Analyze deleted files
	const deletedAnalysis = await analyzeDeletedFiles(context);
	if (deletedAnalysis.hasFindings) {
		hasFindings = true;
		commentBody += deletedAnalysis.warningContent;
	}

	// Analyze modified files
	const modifiedAnalysis = await analyzeModifiedFiles(context);
	if (modifiedAnalysis.hasFindings) {
		hasFindings = true;
		commentBody += modifiedAnalysis.changesContent;
	}

	return { hasFindings, commentBody };
}

/**
 * Clean up old comments/reviews based on post mode.
 */
export async function cleanupOldPosts(context: CrawlContext, postMode: PostMode): Promise<void> {
	const { octokit, owner, repo, pull_number } = context;

	if (postMode === 'comment') {
		await deleteOldIssueComments({ octokit, owner, repo, pull_number });
	} else {
		await dismissOldReviews({ octokit, owner, repo, pull_number });
		await deleteOldReviewComments({ octokit, owner, repo, pull_number });
	}
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
			const { owner, repo, pull_number } = getPRContext();
			console.log(`Analyzing PR #${pull_number} in ${owner}/${repo} for compliance changes...`);

			const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
			const pr = await octokit.pulls.get({ owner, repo, pull_number });
			const prBranch = pr.data.head.ref;
			const baseSha = pr.data.base.sha;
			const headSha = pr.data.head.sha;
			const { data: files } = await octokit.pulls.listFiles({ owner, repo, pull_number });

			const context: CrawlContext = {
				octokit,
				owner,
				repo,
				pull_number,
				prBranch,
				baseSha,
				headSha,
				files
			};

			const analysisResult = await performComplianceAnalysis(context);

			await cleanupOldPosts(context, opts.postMode);

			if (analysisResult.hasFindings) {
				const finalBody = analysisResult.commentBody + closingBody;
				await postFinding({
					octokit,
					postMode: opts.postMode,
					owner,
					repo,
					pull_number,
					body: finalBody
				});

				const header = `Posted (${opts.postMode})`;
				const underline = '-'.repeat(header.length);
				console.log(`\n${header}\n${underline}\n\n${finalBody}\n\n`);
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
