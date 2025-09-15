// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { Octokit } from '@octokit/rest';
import { Command } from 'commander';
import { createHash } from 'crypto';

type FileContentResponse = { content: string; encoding: 'base64' | string };

// ---------- Context & GitHub helpers ----------

export function getPRContext(): { owner: string; repo: string; pull_number: number } {
  const fallbackOwner = process.env.OWNER;
  const fallbackRepo = process.env.REPO;
  const fallbackNumber = process.env.PULL_NUMBER;

  if (fallbackOwner && fallbackRepo && fallbackNumber) {
    return { owner: fallbackOwner!, repo: fallbackRepo!, pull_number: parseInt(fallbackNumber!, 10) };
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

export async function fetchRawFileViaAPI({
  octokit, owner, repo, path, ref,
}: { octokit: Octokit; owner: string; repo: string; path: string; ref: string; }): Promise<string> {
  const res = await octokit.repos.getContent({
    owner, repo, path, ref,
    headers: { accept: 'application/vnd.github.v3.raw' },
  });

  if (typeof res.data === 'string') return res.data;

  if (typeof res.data === 'object' && res.data !== null && 'content' in res.data) {
    const { content } = res.data as FileContentResponse;
    return Buffer.from(content, 'base64').toString('utf-8');
  }

  throw new Error('Unexpected GitHub API response shape');
}

// ---------- Lula block detection ----------

export function extractMapBlocks(content: string): { uuid: string; startLine: number; endLine: number; }[] {
  const lines = content.split('\n');
  const blocks: { uuid: string; startLine: number; endLine: number; }[] = [];
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

export function getChangedBlocks(
  oldText: string,
  newText: string
): { uuid: string; old: { start: number; end: number }; now: { start: number; end: number } }[] {
  const oldBlocks = extractMapBlocks(oldText);
  const newBlocks = extractMapBlocks(newText);
  const changed: { uuid: string; old: { start: number; end: number }; now: { start: number; end: number } }[] = [];

  for (const nb of newBlocks) {
    const ob = oldBlocks.find((b) => b.uuid === nb.uuid);
    if (!ob) continue;

    const oldSeg = oldText.split('\n').slice(ob.startLine, ob.endLine).join('\n');
    const newSeg = newText.split('\n').slice(nb.startLine, nb.endLine).join('\n');

    if (oldSeg !== newSeg) {
      changed.push({
        uuid: nb.uuid,
        old: { start: ob.startLine, end: ob.endLine },
        now: { start: nb.startLine, end: nb.endLine },
      });
    }
  }

  return changed;
}

// ---------- Checks/Statuses & SARIF ----------

type Annotation = {
  path: string;
  start_line: number;
  end_line: number;
  start_column?: number;
  end_column?: number;
  annotation_level: 'warning' | 'failure' | 'notice';
  message: string;
  raw_details?: string;
  title?: string;
};

type SarifRun = {
  tool: { driver: { name: string; rules: Array<{ id: string; shortDescription?: { text: string }; help?: { text: string } }> } };
  results: Array<{
    ruleId: string;
    level: 'note' | 'warning' | 'error';
    message: { text: string };
    locations: Array<{
      physicalLocation: {
        artifactLocation: { uri: string };
        region: { startLine: number; endLine?: number };
      };
    }>;
  }>;
};

type SarifFile = { $schema: string; version: '2.1.0'; runs: SarifRun[] };

function buildRawDetailsDiff(oldBlock: string, newBlock: string): string {
  const oldLines = oldBlock.split('\n');
  const newLines = newBlock.split('\n');
  const max = Math.max(oldLines.length, newLines.length);
  const out: string[] = [];
  for (let i = 0; i < max; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) out.push(`  ${n ?? ''}`);
    else {
      if (o !== undefined) out.push(`- ${o}`);
      if (n !== undefined) out.push(`+ ${n}`);
    }
  }
  return out.join('\n');
}

function findStartColumn(lineText: string): number | undefined {
  const m = lineText.match(/@lulaStart\s+[a-f0-9-]+/);
  if (!m) return undefined;
  const idx = lineText.indexOf(m[0]);
  return idx >= 0 ? idx + 1 : undefined; // 1-based
}

function blobLink(owner: string, repo: string, sha: string, file: string, start: number, end: number) {
  return `https://github.com/${owner}/${repo}/blob/${sha}/${file}#L${start}-L${end}`;
}

function toSarif({
  findings,
}: {
  findings: Array<{ file: string; startLine: number; endLine: number; uuid: string; sha256: string }>;
}): SarifFile {
  const rulesMap = new Map<string, { id: string; shortDescription?: { text: string }; help?: { text: string } }>();
  const results: SarifRun['results'] = [];

  for (const f of findings) {
    const ruleId = `lula2-compliance-block`;
    if (!rulesMap.has(ruleId)) {
      rulesMap.set(ruleId, {
        id: ruleId,
        shortDescription: { text: '@lulaStart/@lulaEnd block changed' },
        help: { text: 'This block is compliance-tracked and changed in this PR.' },
      });
    }
    results.push({
      ruleId,
      level: 'warning',
      message: { text: `UUID ${f.uuid} changed • SHA-256 ${f.sha256}` },
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: f.file },
          region: { startLine: f.startLine, endLine: f.endLine },
        },
      }],
    });
  }

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'Lula2 Compliance', rules: Array.from(rulesMap.values()) } },
      results,
    }],
  };
}

async function uploadSarif({
  octokit, owner, repo, sarif, headSha, prNumber,
}: {
  octokit: Octokit; owner: string; repo: string; sarif: SarifFile; headSha: string; prNumber: number;
}) {
  const json = JSON.stringify(sarif);
  const gz = zlib.gzipSync(Buffer.from(json));
  const sarif_b64 = gz.toString('base64');
  const ref = `refs/pull/${prNumber}/head`;

  await octokit.request('POST /repos/{owner}/{repo}/code-scanning/sarifs', {
    owner, repo,
    commit_sha: headSha,
    ref,
    sarif: sarif_b64,
    tool_name: 'Lula2 Compliance',
  });
  console.log('Uploaded SARIF to Code Scanning for this PR.');
}

async function reportComplianceResult({
  octokit, owner, repo, headSha, hasFindings, annotations, details, summaryLinks,
}: {
  octokit: Octokit; owner: string; repo: string; headSha: string;
  hasFindings: boolean; annotations: Annotation[]; details: string[]; summaryLinks: string[];
}) {
  const baseSummary = hasFindings
    ? 'One or more @lulaStart/@lulaEnd blocks changed. Review annotations and links below.'
    : 'No changes detected within any @lulaStart/@lulaEnd blocks.';

  const baseOutput = {
    title: hasFindings ? 'Compliance findings detected' : 'No compliance findings',
    summary: [baseSummary, ...(summaryLinks.length ? ['\n### Quick links', ...summaryLinks] : [])].join('\n'),
    text: hasFindings ? details.join('\n') : undefined,
  };

  // Prefer Checks API (works with GitHub App/Actions token)
  try {
    const batches: Annotation[][] = [];
    for (let i = 0; i < annotations.length; i += 50) batches.push(annotations.slice(i, i + 50));

    if (batches.length === 0) {
      await octokit.checks.create({
        owner, repo, name: 'Lula2 Compliance', head_sha: headSha,
        status: 'completed', conclusion: hasFindings ? 'failure' : 'success', output: baseOutput,
      });
    } else {
      const created = await octokit.checks.create({
        owner, repo, name: 'Lula2 Compliance', head_sha: headSha,
        status: 'in_progress', output: { ...baseOutput, annotations: batches[0] },
      });
      for (let i = 1; i < batches.length; i++) {
        await octokit.checks.update({
          owner, repo, check_run_id: created.data.id,
          output: { ...baseOutput, annotations: batches[i] },
        });
      }
      await octokit.checks.update({
        owner, repo, check_run_id: created.data.id,
        status: 'completed', conclusion: hasFindings ? 'failure' : 'success',
      });
    }
    console.log(hasFindings ? 'Compliance check created with findings.' : 'Compliance check created: success.');
    return;
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || String(e);
    if (!/must authenticate via a github app/i.test(msg)) throw e;
    console.warn('Checks API not available with this token. Falling back to Commit Statuses API.');
  }

  // Fallback for local PAT runs
  const state = hasFindings ? 'failure' : 'success';
  const description = hasFindings ? 'Lula2 Compliance: findings detected' : 'Lula2 Compliance: no findings';
  await octokit.repos.createCommitStatus({
    owner, repo, sha: headSha, state, context: 'Lula2 Compliance', description,
  });
  console.log(`Commit status set: ${state} (${description})`);
}

// ---------- CLI command ----------

export function crawlCommand(): Command {
  return new Command()
    .command('crawl')
    .description('Detect compliance-related changes between @lulaStart and @lulaEnd in PR files')
    .option('--sarif <path>', 'write SARIF file with findings')
    .option('--upload-sarif', 'upload SARIF to GitHub Code Scanning (requires token scope)')
    .action(async (opts: { sarif?: string; uploadSarif?: boolean }) => {
      const { owner, repo, pull_number } = getPRContext();
      console.log(`Analyzing PR #${pull_number} in ${owner}/${repo} for compliance changes...\n`);

      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      const pr = await octokit.pulls.get({ owner, repo, pull_number });
      const prBranch = pr.data.head.ref;
      const headSha = pr.data.head.sha;
      const prTitle = pr.data.title ?? '';

      // Skip entirely if acknowledged
      if (prTitle.toLowerCase().includes('compliance: acknowledged')) {
        console.log('PR title contains "compliance: acknowledged" — skipping compliance reporting.');
        process.exitCode = 0;
        return;
      }

      const { data: files } = await octokit.pulls.listFiles({ owner, repo, pull_number });

      const annotations: Annotation[] = [];
      const details: string[] = [];
      const summaryLinks: string[] = [];
      const findings: Array<{ file: string; startLine: number; endLine: number; uuid: string; sha256: string }> = [];

      for (const file of files) {
        if (file.status === 'added') continue; // only compare against main for modified/removed/renamed

        try {
          const [oldText, newText] = await Promise.all([
            fetchRawFileViaAPI({ octokit, owner, repo, path: file.filename, ref: 'main' }),
            fetchRawFileViaAPI({ octokit, owner, repo, path: file.filename, ref: prBranch }),
          ]);

          const changedBlocks = getChangedBlocks(oldText, newText);
          if (changedBlocks.length === 0) continue;

          const newLines = newText.split('\n');
          const oldLines = oldText.split('\n');

          for (const blk of changedBlocks) {
            const newBlockText = newLines.slice(blk.now.start, blk.now.end).join('\n');
            const oldBlockText = oldLines.slice(blk.old.start, blk.old.end).join('\n');
            const blockSha256 = createHash('sha256').update(newBlockText).digest('hex');

            const startLine = blk.now.start + 1; // 1-based
            const endLine = blk.now.end;

            findings.push({ file: file.filename, startLine, endLine, uuid: blk.uuid, sha256: blockSha256 });

            details.push(`- \`${file.filename}\` lines ${startLine}-${endLine} • UUID \`${blk.uuid}\` • SHA-256 \`${blockSha256}\``);
            summaryLinks.push(
              `- [\`${file.filename}\` lines ${startLine}-${endLine}](${blobLink(owner, repo, headSha, file.filename, startLine, endLine)}) • UUID \`${blk.uuid}\``
            );

            const startCol = findStartColumn(newLines[blk.now.start]);

            annotations.push({
              path: file.filename,
              start_line: startLine,
              end_line: endLine,
              start_column: startCol,
              annotation_level: 'warning',
              title: 'Compliance block changed',
              message: `UUID ${blk.uuid} changed between @lulaStart/@lulaEnd. SHA-256: ${blockSha256}`,
              raw_details: buildRawDetailsDiff(oldBlockText, newBlockText),
            });
          }
        } catch (err) {
          console.error(`Error processing ${file.filename}: ${err}`);
        }
      }

      const hasFindings = findings.length > 0;

      // Optional: write SARIF locally
      if (opts.sarif) {
        const sarif = toSarif({ findings });
        fs.writeFileSync(path.resolve(process.cwd(), opts.sarif), JSON.stringify(sarif, null, 2), 'utf8');
        console.log(`Wrote SARIF → ${opts.sarif}`);
      }

      // Optional: upload SARIF to show inline PR alerts (works with PAT + security_events scope)
      if (opts.uploadSarif && hasFindings) {
        const sarif = toSarif({ findings });
        await uploadSarif({ octokit, owner, repo, sarif, headSha, prNumber: pull_number });
      }

      // Report (Checks in CI; Status locally)
      await reportComplianceResult({
        octokit, owner, repo, headSha, hasFindings, annotations, details, summaryLinks,
      });

      process.exitCode = hasFindings ? 1 : 0;
    });
}
