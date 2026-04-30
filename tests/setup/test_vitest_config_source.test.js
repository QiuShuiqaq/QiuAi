import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('vitest config source', () => {
  it('keeps Vitest default excludes and adds nested worktree snapshots', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'vitest.config.mjs'), 'utf8')

    expect(source).toContain('configDefaults')
    expect(source).toContain('exclude')
    expect(source).toContain('.worktrees/**')
  })
})
