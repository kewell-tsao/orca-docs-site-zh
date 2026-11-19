#!/usr/bin/env node
/**
 * Incremental sync for orca-docs-site-zh
 *
 * Usage: node .upstream-sync/sync.mjs
 *
 * Workflow:
 *   1. Read .upstream-sync/snapshot.json
 *   2. git fetch upstream and diff against lastSyncedCommit
 *   3. Auto-copy code files and static assets (A/M → copy, D → delete)
 *   4. For content files: save source + generate diff, flag for (re)translation
 *   5. Update snapshot.json with new commit and checksums
 *
 * After running this script, translate the flagged content files,
 * then run `node .upstream-sync/sync.mjs --complete` to finalize checksums.
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { createHash } from 'node:crypto'

const TARGET_ROOT = new URL('..', import.meta.url).pathname.replace(/^\//, process.platform === 'win32' ? '' : '')
const SNAPSHOT_DIR = join(TARGET_ROOT, '.upstream-sync')
const SNAPSHOT_FILE = join(SNAPSHOT_DIR, 'snapshot.json')
const DIFF_DIR = join(SNAPSHOT_DIR, '_diffs')
const SOURCE_DIR = join(SNAPSHOT_DIR, '_sources')
const TODO_FILE = join(SNAPSHOT_DIR, 'TRANSLATE_TODO.json')

function log(msg) {
  console.log(`[sync] ${msg}`)
}

function die(msg) {
  console.error(`[sync] ERROR: ${msg}`)
  process.exit(1)
}

function run(cmd, cwd, opts = {}) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim()
  } catch (e) {
    if (opts.optional) return null
    throw new Error(`Command failed: ${cmd}\n${e.stderr || e.message}`)
  }
}

function sha256File(path) {
  const h = createHash('sha256')
  h.update(readFileSync(path))
  return `sha256:${h.digest('hex')}`
}

function isContentFile(relPath) {
  return /^content[\\/]docs[\\/].+\.(mdx|md)$/.test(relPath) ||
    /^content[\\/]docs[\\/].+meta\.json$/.test(relPath) ||
    relPath === 'README.md' || relPath === 'THIRD_PARTY_NOTICES.md'
}

function isCodeFile(relPath) {
  return /^(src[\\/]|next\.config|source\.config|versioning\.config|postcss\.config|tsconfig|vercel\.json|pnpm-workspace|package\.json|\.oxlintrc|\.gitignore)/.test(relPath)
}

function isStaticAsset(relPath) {
  return /^public[\\/]\.+\.(gif|png|jpg|jpeg|svg|mp4|ico|webp)$/.test(relPath)
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function copyDirRecursive(src, dst) {
  ensureDir(dst)
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name)
    const dstPath = join(dst, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath)
    } else {
      copyFileSync(srcPath, dstPath)
    }
  }
}

// ── Main ──────────────────────────────────────────────

function main() {
  if (!existsSync(SNAPSHOT_FILE)) die(`snapshot.json not found at ${SNAPSHOT_FILE}`)

  const snapshot = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8'))
  const upstreamRepo = snapshot.upstreamRepo.replace(/\\/g, '/')
  const upstreamSitePath = snapshot.upstreamSitePath
  const lastCommit = snapshot.upstreamCommit

  if (!existsSync(upstreamRepo)) die(`upstream repo not found: ${upstreamRepo}`)

  const completeOnly = process.argv.includes('--complete')
  const skipFetch = process.argv.includes('--skip-fetch')

  if (completeOnly) {
    return finalizeChecksums(snapshot)
  }

  log(`Upstream repo: ${upstreamRepo}`)
  log(`Last synced commit: ${lastCommit}`)

  // Fetch and get latest commit
  if (!skipFetch) {
    log('Fetching upstream...')
    run('git fetch', upstreamRepo, { optional: true }) || log('  (fetch skipped or failed, using local HEAD)')
  }
  const currentCommit = run('git rev-parse HEAD', upstreamRepo)
  log(`Current upstream HEAD: ${currentCommit}`)

  if (currentCommit === lastCommit) {
    log('Already up to date. No changes since last sync.')
    return
  }

  // Get file list with status
  const nameStatus = run(`git diff --name-status ${lastCommit}..${currentCommit} -- ${upstreamSitePath}`, upstreamRepo)
  if (!nameStatus) {
    log('No changes in site directory since last sync.')
    return
  }

  const changes = nameStatus.split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split('\t')
      const status = parts[0][0] // A, M, D, R
      let relPath = parts[1]
      let newPath = parts[2] || null
      return { status, relPath, newPath }
    })

  log(`Detected ${changes.length} file changes`)

  const actions = { code: [], asset: [], contentNew: [], contentModify: [], contentDelete: [], otherNew: [] }

  for (const c of changes) {
    // Strip site prefix to get target-relative path
    let targetRel = c.relPath.replace(new RegExp(`^${upstreamSitePath}/`.replace(/\//g, '[\\\\/]')), '')

    if (c.status === 'D') {
      if (isContentFile(targetRel)) actions.contentDelete.push(targetRel)
      else if (isCodeFile(targetRel) || isStaticAsset(targetRel)) actions.code.push({ op: 'delete', path: targetRel })
      else actions.otherNew.push({ op: 'delete', path: targetRel })
      continue
    }

    if (c.status === 'R' && c.newPath) {
      const newTargetRel = c.newPath.replace(new RegExp(`^${upstreamSitePath}/`.replace(/\//g, '[\\\\/]')), '')
      copyOrDelete(c.relPath, newTargetRel, upstreamRepo, upstreamSitePath, TARGET_ROOT)
      classifyAndAct(newTargetRel, 'A', actions, upstreamRepo, upstreamSitePath, currentCommit)
      classifyAndAct(targetRel, 'D', actions, upstreamRepo, upstreamSitePath, currentCommit)
      continue
    }

    classifyAndAct(targetRel, c.status, actions, upstreamRepo, upstreamSitePath, currentCommit)
  }

  // ── Auto-copy code files and assets ──
  let codeCopied = 0, assetCopied = 0, codeDeleted = 0
  for (const item of actions.code) {
    if (item.op === 'delete') {
      const targetPath = join(TARGET_ROOT, item.path)
      if (existsSync(targetPath)) { rmSync(targetPath, { recursive: true, force: true }); log(`  DELETE code: ${item.path}`); codeDeleted++ }
    } else {
      copySourceFile(item.sourcePath, join(TARGET_ROOT, item.path))
      log(`  COPY code: ${item.path}`); codeCopied++
    }
  }
  for (const item of actions.asset) {
    copySourceFile(item.sourcePath, join(TARGET_ROOT, item.path))
    log(`  COPY asset: ${item.path}`); assetCopied++
  }

  // ── Handle content files ──
  const todoItems = []

  for (const item of actions.contentDelete) {
    const targetPath = join(TARGET_ROOT, item)
    if (existsSync(targetPath)) {
      rmSync(targetPath, { recursive: true, force: true })
      log(`  DELETE content: ${item}`)
    }
  }

  for (const item of actions.contentNew) {
    // New content file: copy source to target (will be translated later)
    copySourceFile(item.sourcePath, join(TARGET_ROOT, item.path))
    log(`  NEW content (needs translation): ${item.path}`)
    todoItems.push({ path: item.path, action: 'translate-new', sourceCommit: currentCommit })
  }

  for (const item of actions.contentModify) {
    // Modified content file: save source + diff, keep existing translation for re-translation
    ensureDir(SOURCE_DIR)
    ensureDir(DIFF_DIR)

    // Save the new source version for reference
    const savedSource = join(SOURCE_DIR, item.path)
    ensureDir(dirname(savedSource))
    copySourceFile(item.sourcePath, savedSource)

    // Generate git diff
    const diff = run(
      `git diff ${lastCommit}..${currentCommit} -- ${upstreamSitePath}/${item.path}`,
      upstreamRepo, { optional: true }
    )
    if (diff) {
      const diffFile = join(DIFF_DIR, `${item.path}.diff`)
      ensureDir(dirname(diffFile))
      writeFileSync(diffFile, diff)
    }

    // Also copy the new source over the old translation? No — keep old translation
    // The translator (human or AI) should re-translate based on the diff
    log(`  MODIFIED content (needs re-translation): ${item.path}`)
    todoItems.push({ path: item.path, action: 're-translate', sourceCommit: currentCommit, hasDiff: !!diff })
  }

  // ── Write TRANSLATE_TODO.json ──
  if (todoItems.length > 0) {
    const existingTodo = existsSync(TODO_FILE) ? JSON.parse(readFileSync(TODO_FILE, 'utf8')) : { items: [] }
    // Merge: existing entries for same path stay, new ones appended
    const existingPaths = new Set(existingTodo.items.map(i => i.path))
    for (const item of todoItems) {
      if (!existingPaths.has(item.path)) existingTodo.items.push(item)
    }
    writeFileSync(TODO_FILE, JSON.stringify(existingTodo, null, 2))
    log(`\n${todoItems.length} content files need translation. See TRANSLATE_TODO.json`)
    log(`Source files saved in .upstream-sync/_sources/`)
    log(`Diffs saved in .upstream-sync/_diffs/`)
  }

  // ── Update snapshot ──
  snapshot.upstreamCommit = currentCommit
  snapshot.lastSyncDate = new Date().toISOString()
  snapshot.lastAutoSyncDate = new Date().toISOString()
  snapshot.pendingTranslations = todoItems.length
  writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2))

  log(`\nSummary:`)
  log(`  Code files copied: ${codeCopied}, deleted: ${codeDeleted}`)
  log(`  Assets copied: ${assetCopied}`)
  log(`  Content needing translation: ${todoItems.length}`)
  log(`  New baseline commit: ${currentCommit}`)
  log(`\nNext step: Translate the files listed in .upstream-sync/TRANSLATE_TODO.json`)
  log(`Then run: node .upstream-sync/sync.mjs --complete`)
}

function classifyAndAct(targetRel, status, actions, upstreamRepo, upstreamSitePath, commit) {
  if (isContentFile(targetRel)) {
    const sourcePath = join(upstreamRepo, upstreamSitePath, targetRel)
    if (status === 'A') actions.contentNew.push({ path: targetRel, sourcePath })
    else if (status === 'M') actions.contentModify.push({ path: targetRel, sourcePath })
  } else if (isCodeFile(targetRel)) {
    const sourcePath = join(upstreamRepo, upstreamSitePath, targetRel)
    if (status === 'A' || status === 'M') actions.code.push({ op: 'copy', path: targetRel, sourcePath })
  } else if (isStaticAsset(targetRel)) {
    const sourcePath = join(upstreamRepo, upstreamSitePath, targetRel)
    actions.asset.push({ path: targetRel, sourcePath })
  } else {
    // Other files (e.g., THIRD_PARTY_NOTICES.md at site root)
    const sourcePath = join(upstreamRepo, upstreamSitePath, targetRel)
    if (targetRel.startsWith('content/docs/')) {
      const ext = targetRel.endsWith('.md') || targetRel.endsWith('.mdx') ? targetRel : null
      if (ext) {
        if (status === 'A') actions.contentNew.push({ path: targetRel, sourcePath })
        else if (status === 'M') actions.contentModify.push({ path: targetRel, sourcePath })
        return
      }
    }
    if (status === 'D') actions.code.push({ op: 'delete', path: targetRel })
    else actions.code.push({ op: 'copy', path: targetRel, sourcePath })
  }
}

function copyOrDelete(srcRel, dstRel, upstreamRepo, upstreamSitePath, targetRoot) {
  const srcAbs = join(upstreamRepo, srcRel.startsWith(upstreamSitePath) ? srcRel : join(upstreamSitePath, srcRel))
  const dstAbs = join(targetRoot, dstRel.replace(new RegExp(`^${upstreamSitePath}/`.replace(/\//g, '[\\\\/]')), ''))
  // Just ensure dir exists
  ensureDir(dirname(dstAbs))
}

function copySourceFile(sourceAbs, targetAbs) {
  ensureDir(dirname(targetAbs))
  copyFileSync(sourceAbs, targetAbs)
}

function finalizeChecksums(snapshot) {
  log('Finalizing checksums after manual translation...')
  const targetPath = TARGET_ROOT.replace(/^\//, process.platform === 'win32' ? '' : '')
  const checksums = {}
  walkContentDocs(targetPath, checksums)

  const checksumsFile = join(SNAPSHOT_DIR, 'checksums.json')
  writeFileSync(checksumsFile, JSON.stringify(checksums, null, 2))

  // Clear TRANSLATE_TODO if all items done
  if (existsSync(TODO_FILE)) {
    const todo = JSON.parse(readFileSync(TODO_FILE, 'utf8'))
    // Mark all as done since --complete means human finished translating
    todo.items = []
    writeFileSync(TODO_FILE, JSON.stringify(todo, null, 2))
  }

  snapshot.lastManualReviewDate = new Date().toISOString()
  snapshot.pendingTranslations = 0
  writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2))
  log(`Checksums updated for ${Object.keys(checksums).length} files`)
  log(`Snapshot finalized.`)
}

function walkContentDocs(root, checksums) {
  const contentDir = join(root, 'content', 'docs')
  if (!existsSync(contentDir)) return
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(mdx|md)$|meta\.json$/.test(entry.name)) {
        const rel = relative(root, full).replace(/\\/g, '/')
        checksums[rel] = sha256File(full)
      }
    }
  }
  walk(contentDir)

  // Also check root-level content-adjacent files
  for (const f of ['README.md', 'THIRD_PARTY_NOTICES.md']) {
    const full = join(root, f)
    if (existsSync(full)) checksums[f] = sha256File(full)
  }
}

main()
