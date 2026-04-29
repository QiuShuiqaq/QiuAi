import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('activation guard source', () => {
  it('checks activation before studio and legacy remote task execution', () => {
    const studioSource = fs.readFileSync(path.resolve(process.cwd(), 'main/src/ipc/studioIpc.js'), 'utf8')
    const taskSource = fs.readFileSync(path.resolve(process.cwd(), 'main/src/ipc/taskIpc.js'), 'utf8')
    const drawSource = fs.readFileSync(path.resolve(process.cwd(), 'main/src/ipc/drawIpc.js'), 'utf8')

    expect(studioSource).toContain('activationGuard')
    expect(studioSource).toContain('assertActivated')
    expect(taskSource).toContain('activationGuard')
    expect(taskSource).toContain('assertActivated')
    expect(drawSource).toContain('activationGuard')
    expect(drawSource).toContain('assertActivated')
  })
})
