import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('studioIpc source', () => {
  it('registers output directory open handler and batch export handler', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'main/src/ipc/studioIpc.js'), 'utf8')
    expect(source).toContain('STUDIO_PICK_INPUT_ASSETS')
    expect(source).toContain('STUDIO_OPEN_OUTPUT_DIRECTORY')
    expect(source).toContain('STUDIO_EXPORT_RESULTS')
    expect(source).toContain('STUDIO_DELETE_EXPORT_ITEM')
    expect(source).toContain('STUDIO_CLEAR_RUNTIME_STATE')
    expect(source).toContain('showOpenDialog')
    expect(source).toContain('defaultPath')
    expect(source).toContain('openOutputDirectory')
    expect(source).toContain('showSaveDialog')
    expect(source).toContain('exportSelectedResults')
    expect(source).toContain('deleteExportItem')
    expect(source).toContain('clearRuntimeState')
    expect(source).not.toContain('globalUploadDirectory')
  })
})
