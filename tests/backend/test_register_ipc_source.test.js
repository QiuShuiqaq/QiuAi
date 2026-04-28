import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('registerIpc source', () => {
  it('registers settings, draw, prompt, and task ipc handlers', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'main/src/bootstrap/registerIpc.js'), 'utf8')
    expect(source).toContain("require('../ipc/settingsIpc')")
    expect(source).toContain("require('../ipc/drawIpc')")
    expect(source).toContain("require('../ipc/promptIpc')")
    expect(source).toContain("require('../ipc/taskIpc')")
    expect(source).toContain("require('../ipc/studioIpc')")
    expect(source).toContain('registerSettingsIpc(')
    expect(source).toContain('registerDrawIpc(')
    expect(source).toContain('registerPromptIpc(')
    expect(source).toContain('registerTaskIpc(')
    expect(source).toContain('registerStudioIpc(')
    expect(source).toContain('return {')
    expect(source).toContain('studioTaskManagerService')
  })
})
