// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { Router, type Request, type Response } from 'express';
import * as fs from 'fs';
import { existsSync, promises as fsPromises } from 'fs';
import * as git from 'isomorphic-git';
import { join, relative } from 'path';
import * as YAML from 'yaml';
import { addControlToIndexes, getServerState } from './serverState';
import type {
	ControlCompleteData,
	GitCommit,
	UnifiedHistory
} from './types';

const router = Router();

// Unified endpoint that loads control, mappings, and unified history
router.get('/controls/:id/complete', async (req: Request, res: Response) => {
	try {
		const controlId = req.params.id;
		const limit = parseInt(req.query.limit as string) || 50;
		const state = getServerState();

		console.log(`Getting complete data for control: ${controlId}`);

		// Get control
		let control = state.controlsCache.get(controlId);
		if (!control) {
			const loadedControl = await state.fileStore.loadControl(controlId);
			if (loadedControl) {
				control = loadedControl;
				state.controlsCache.set(control.id, control);
				addControlToIndexes(control);
			}
		}

		if (!control) {
			return res.status(404).json({ error: 'Control not found' });
		}

		// Extract family from control - enhanced controls have it in _metadata.family
		const family =
			(control as any)?._metadata?.family ||
			control.family ||
			controlId.split('-')[0].toLowerCase();

		// Get mappings for this control
		const mappings = Array.from(state.mappingsCache.values())
			.filter((mapping) => mapping.control_id === controlId)
			.sort((a, b) => a.uuid.localeCompare(b.uuid));

		console.log(
			`Complete data for ${controlId}: ${mappings.length} mappings, starting history lookup`
		);

		// Get all commits for both control and mapping files, including pending changes
		const allCommits: (GitCommit & { type: string; fileType: string; isPending?: boolean })[] = [];
		let controlCommits = 0;
		let mappingCommits = 0;

		// Find the actual git root, don't assume it's the control set directory
		let gitRoot: string;
		try {
			gitRoot = await git.findRoot({ fs: fs, filepath: state.CONTROL_SET_DIR });
		} catch (error) {
			console.log('Could not find git root, falling back to control set directory');
			gitRoot = state.CONTROL_SET_DIR;
		}

		// Get file paths
		const metadata = state.fileStore.getControlMetadata(controlId);
		const controlFilePath = metadata
			? join(state.CONTROL_SET_DIR, 'controls', family, metadata.filename)
			: undefined;
		const mappingFilePath = join(
			state.CONTROL_SET_DIR,
			'mappings',
			family,
			`${controlId}-mappings.yaml`
		);

		// Get control file history
		if (controlFilePath && existsSync(controlFilePath)) {
			try {
				const controlHistory = await state.gitHistory.getFileHistory(controlFilePath, limit);
				controlHistory.commits.forEach((commit) => {
					allCommits.push({ ...commit, type: 'control', fileType: 'Control File' });
				});
				controlCommits = controlHistory.commits.length;
				console.log(`Found ${controlCommits} commits for control file`);
			} catch (error) {
				console.log(`No git history for control file: ${controlFilePath}`);
			}
		}

		// Get mapping file history
		if (existsSync(mappingFilePath)) {
			try {
				const mappingHistory = await state.gitHistory.getFileHistory(mappingFilePath, limit);
				mappingHistory.commits.forEach((commit) => {
					allCommits.push({ ...commit, type: 'mapping', fileType: 'Mappings' });
				});
				mappingCommits = mappingHistory.commits.length;
				console.log(`Found ${mappingCommits} commits for mapping file`);
			} catch (error) {
				console.log(`No git history for mapping file: ${mappingFilePath}`);
			}
		}

		// Check for pending changes
		const filesToCheck: { path: string; type: 'control' | 'mapping' }[] = [];
		if (controlFilePath) filesToCheck.push({ path: controlFilePath, type: 'control' });
		if (existsSync(mappingFilePath)) filesToCheck.push({ path: mappingFilePath, type: 'mapping' });

		for (const { path, type } of filesToCheck) {
			try {
				const relativePath = relative(gitRoot, path);
				const status = await git.status({ fs: fs, dir: gitRoot, filepath: relativePath });

				console.log(`Git status for ${relativePath}: ${status}`);
				if (status !== 'unmodified' && status !== 'absent') {
					const currentTime = new Date().toISOString();
					const displayType = type === 'mapping' ? 'Mappings' : 'Control File';

					// Generate diff for pending changes
					let diff = '';
					let yamlDiff = null;
					try {
						const currentContent = await fsPromises.readFile(path, 'utf8');

						let headContent = '';
						try {
							const headOid = await git.resolveRef({ fs: fs, dir: gitRoot, ref: 'HEAD' });
							const { blob } = await git.readBlob({
								fs: fs,
								dir: gitRoot,
								oid: headOid,
								filepath: relativePath
							});
							headContent = new TextDecoder().decode(blob);
						} catch (error) {
							headContent = '';
						}

						console.log(
							`Content comparison for ${relativePath}: current length=${currentContent.length}, head length=${headContent.length}, equal=${currentContent === headContent}`
						);
						if (currentContent !== headContent) {
							// Generate YAML diff for YAML files
							if (relativePath.endsWith('.yaml') || relativePath.endsWith('.yml')) {
								try {
									const oldData = headContent ? YAML.parse(headContent) : {};
									const newData = YAML.parse(currentContent);

									const changedFields: Array<{
										type: 'Added' | 'Removed' | 'Modified';
										field: string;
										oldValue: any;
										newValue: any;
									}> = [];

									function findChanges(oldObj: any, newObj: any) {
										const allKeys = new Set([
											...Object.keys(oldObj || {}),
											...Object.keys(newObj || {})
										]);

										for (const key of allKeys) {
											if (key.startsWith('_')) continue; // Skip metadata

											const oldVal = oldObj?.[key];
											const newVal = newObj?.[key];

											if (oldVal !== newVal) {
												if (oldVal === undefined) {
													changedFields.push({
														type: 'Added',
														field: key,
														oldValue: undefined,
														newValue: newVal
													});
												} else if (newVal === undefined) {
													changedFields.push({
														type: 'Removed',
														field: key,
														oldValue: oldVal,
														newValue: undefined
													});
												} else {
													changedFields.push({
														type: 'Modified',
														field: key,
														oldValue: oldVal,
														newValue: newVal
													});
												}
											}
										}
									}

									findChanges(oldData, newData);

									if (changedFields.length > 0) {
										const added = changedFields.filter((f) => f.type === 'Added').length;
										const removed = changedFields.filter((f) => f.type === 'Removed').length;
										const modified = changedFields.filter((f) => f.type === 'Modified').length;

										const summaryParts: string[] = [];
										if (added > 0) summaryParts.push(`${added} added`);
										if (modified > 0) summaryParts.push(`${modified} modified`);
										if (removed > 0) summaryParts.push(`${removed} removed`);

										yamlDiff = {
											hasChanges: true,
											summary: summaryParts.join(', '),
											changes: changedFields.map((change) => ({
												type: change.type.toLowerCase(),
												field: change.field,
												path: change.field,
												description: `${change.type} ${change.field}`,
												oldValue: change.oldValue,
												newValue: change.newValue
											}))
										};
									}
								} catch (yamlError) {
									console.log(`YAML parsing error for ${relativePath}:`, yamlError);
								}
							}

							// Generate basic text diff
							const lines1 = headContent.split('\n');
							const lines2 = currentContent.split('\n');
							const diffLines = [`--- a/${relativePath}`, `+++ b/${relativePath}`];

							const maxLines = Math.max(lines1.length, lines2.length);
							let hasChanges = false;

							for (let i = 0; i < maxLines; i++) {
								const oldLine = lines1[i] || '';
								const newLine = lines2[i] || '';

								if (oldLine !== newLine) {
									if (!hasChanges) {
										diffLines.push(`@@ -${i + 1},${lines1.length} +${i + 1},${lines2.length} @@`);
										hasChanges = true;
									}

									if (oldLine && lines1[i] !== undefined) {
										diffLines.push(`-${oldLine}`);
									}
									if (newLine && lines2[i] !== undefined) {
										diffLines.push(`+${newLine}`);
									}
								}
							}

							diff = diffLines.join('\n');
						}
					} catch (error) {
						console.log(`Could not generate diff for ${relativePath}:`, error);
						diff = 'Unable to generate diff for pending changes';
					}

					allCommits.push({
						hash: 'pending',
						shortHash: 'pending',
						author: 'You',
						authorEmail: '',
						date: currentTime,
						message: 'Uncommitted modifications',
						changes: { insertions: 0, deletions: 0, files: 1 },
						type,
						fileType: displayType,
						isPending: true,
						diff: diff || undefined,
						yamlDiff: yamlDiff || undefined
					});

					if (type === 'control') controlCommits++;
					else mappingCommits++;

					console.log(`Found pending changes in ${type} file: ${relativePath}`);
				}
			} catch (error) {
				console.log(`Could not check git status for ${path}:`, error);
			}
		}

		// Sort by date (pending first, then newest first)
		allCommits.sort((a, b) => {
			if (a.isPending && !b.isPending) return -1;
			if (!a.isPending && b.isPending) return 1;
			return new Date(b.date).getTime() - new Date(a.date).getTime();
		});

		const unifiedHistory: UnifiedHistory = {
			commits: allCommits,
			totalCommits: allCommits.length,
			controlCommits,
			mappingCommits,
			controlFilePath: controlFilePath
				? controlFilePath.replace(state.CONTROL_SET_DIR + '/', '')
				: undefined,
			mappingFilePath: mappingFilePath
				? mappingFilePath.replace(state.CONTROL_SET_DIR + '/', '')
				: undefined
		};

		const completeData: ControlCompleteData = {
			control,
			mappings,
			unifiedHistory
		};

		console.log(
			`Complete data for ${controlId}: ${mappings.length} mappings, ${unifiedHistory.totalCommits} total commits (${controlCommits} control, ${mappingCommits} mapping)`
		);

		res.json(completeData);
	} catch (error) {
		console.error('Error getting complete control data:', error);
		res.status(500).json({ error: (error as Error).message });
	}
});

// Get file content at specific commit
router.get('/git/file/:commitHash/:type/:family?', async (req: Request, res: Response) => {
	try {
		const { commitHash, type } = req.params;
		const controlId = req.query.controlId as string;
		const state = getServerState();

		let filePath: string;

		if (type === 'control') {
			if (!controlId) {
				return res.status(400).json({ error: 'Control ID required for control file' });
			}

			const metadata = state.fileStore.getControlMetadata(controlId);
			if (!metadata) {
				return res.status(404).json({ error: 'Control metadata not found' });
			}

			const controlFamily = controlId.split('-')[0];
			filePath = join('controls', controlFamily, metadata.filename);
		} else if (type === 'mapping') {
			if (!controlId) {
				return res.status(400).json({ error: 'Control ID required for mapping file' });
			}
			const controlFamily = controlId.split('-')[0];
			filePath = join('mappings', controlFamily, `${controlId}-mappings.yaml`);
		} else {
			return res.status(400).json({ error: 'Invalid file type. Must be "control" or "mapping"' });
		}

		console.log(`Getting file content for ${filePath} at commit ${commitHash}`);

		// Use git history utility to get file content at specific commit
		const fileContent = await state.gitHistory.getFileContentAtCommit(filePath, commitHash);

		res.json({
			filePath,
			commitHash,
			content: fileContent
		});
	} catch (error) {
		console.error('Error getting file content at commit:', error);
		res.status(500).json({ error: (error as Error).message });
	}
});

export default router;
