import fs from "fs"
import { Octokit } from "@octokit/rest"
import { Command } from "commander"

function getPRContext(): { owner: string; repo: string; pull_number: number } {
  const fallbackOwner = process.env.OWNER
  const fallbackRepo = process.env.REPO
  const fallbackNumber = process.env.PULL_NUMBER

  if (process.env.GITHUB_EVENT_PATH && process.env.GITHUB_REPOSITORY) {
    const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/")
    const pull_number = event.pull_request?.number
    if (!pull_number) throw new Error("PR number not found in GitHub event payload.")
    return { owner, repo, pull_number }
  }

  if (!fallbackOwner || !fallbackRepo || !fallbackNumber) {
    throw new Error("Set OWNER, REPO, and PULL_NUMBER in the environment for local use.")
  }

  return {
    owner: fallbackOwner,
    repo: fallbackRepo,
    pull_number: parseInt(fallbackNumber, 10),
  }
}

async function fetchRawFileViaAPI(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string> {
  const res = await octokit.repos.getContent({
    owner,
    repo,
    path,
    ref,
    headers: {
      accept: "application/vnd.github.v3.raw",
    },
  })

  return typeof res.data === "string"
    ? res.data
    : Buffer.from((res.data as any).content, "base64").toString("utf-8")
}

function extractMapBlocks(content: string): {
  uuid: string
  startLine: number
  endLine: number
}[] {
  const lines = content.split("\n")
  interface MapBlock {
    uuid: string
    startLine: number
    endLine: number
  }
  const blocks: MapBlock[] = []
  const stack: { uuid: string; line: number }[] = []

  lines.forEach((line, idx) => {
    const start = line.match(/@mapStart\s+([a-f0-9-]+)/)
    const end = line.match(/@mapEnd\s+([a-f0-9-]+)/)

    if (start) {
      stack.push({ uuid: start[1], line: idx })
    } else if (end) {
      const last = stack.find(s => s.uuid === end[1])
      if (last) {
        blocks.push({ uuid: last.uuid, startLine: last.line, endLine: idx + 1 })
        stack.splice(stack.indexOf(last), 1)
      }
    }
  })

  return blocks
}

function getChangedBlocks(oldText: string, newText: string): {
  uuid: string
  startLine: number
  endLine: number
}[] {
  const oldBlocks = extractMapBlocks(oldText)
  const newBlocks = extractMapBlocks(newText)
  const changed = []

  for (const newBlock of newBlocks) {
    const oldMatch = oldBlocks.find(b => b.uuid === newBlock.uuid)
    if (!oldMatch) continue

    const oldSegment = oldText.split("\n").slice(oldMatch.startLine, oldMatch.endLine).join("\n")
    const newSegment = newText.split("\n").slice(newBlock.startLine, newBlock.endLine).join("\n")

    if (oldSegment !== newSegment) {
      changed.push(newBlock)
    }
  }

  return changed
}

export default function (): Command {
  return new Command()
    .command("crawl")
    .description("Detect compliance-related changes between @mapStart and @mapEnd in PR files")
    .action(async () => {
      const { owner, repo, pull_number } = getPRContext()
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

      const pr = await octokit.pulls.get({ owner, repo, pull_number })
      const prBranch = pr.data.head.ref

      const { data: files } = await octokit.pulls.listFiles({ owner, repo, pull_number })

      for (const file of files) {
        if (file.status === "added") continue
        try {
          const [oldText, newText] = await Promise.all([
            fetchRawFileViaAPI(octokit, owner, repo, file.filename, "main"),
            fetchRawFileViaAPI(octokit, owner, repo, file.filename, prBranch),
          ])

          const changedBlocks = getChangedBlocks(oldText, newText)

          for (const block of changedBlocks) {
            const commentBody = `**Compliance Alert**: \`${file.filename}\` changed between lines ${block.startLine + 1}–${block.endLine}.\nUUID \`${block.uuid}\` may be out of compliance. Please review.`
            console.log(`Commenting on ${file.filename}: ${commentBody}`)
            await octokit.issues.createComment({
              owner,
              repo,
              issue_number: pull_number,
              body: commentBody,
            })
          //   await octokit.pulls.createReview({
          //   owner,
          //   repo,
          //   pull_number,
          //   body: commentBody,
          //   event: "REQUEST_CHANGES", 
          // })
          }
        } catch (err) {
          console.error(`Error processing ${file.filename}: ${err}`)
        }
      }
    })
}
