import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('main source', () => {
  it('flushes pending studio task records before the desktop app quits', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'main/main.js'), 'utf8')

    expect(source).toContain('const { studioTaskManagerService } = registerIpc()')
    expect(source).toContain('onBeforeQuit: () => studioTaskManagerService?.flushPendingWrites?.()')
  })
})
