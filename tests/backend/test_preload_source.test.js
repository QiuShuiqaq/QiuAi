import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('preload source', () => {
  it('exposes qiuai bridge with invoke helper', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'main/preload.js'), 'utf8')
    expect(source).toContain("contextBridge.exposeInMainWorld('qiuai'")
    expect(source).toContain('ipcRenderer.invoke(channel, payload)')
    expect(source).toContain('PROMPTS_LIST')
    expect(source).toContain('TASKS_CREATE_LOCAL')
    expect(source).toContain('TASKS_EXPORT')
    expect(source).toContain('STUDIO_GET_SNAPSHOT')
    expect(source).toContain('STUDIO_SAVE_DRAFT')
    expect(source).toContain('STUDIO_CREATE_TASK')
    expect(source).toContain('STUDIO_PICK_INPUT_ASSETS')
    expect(source).toContain('STUDIO_OPEN_OUTPUT_DIRECTORY')
    expect(source).toContain('STUDIO_EXPORT_RESULTS')
    expect(source).toContain('STUDIO_DELETE_EXPORT_ITEM')
    expect(source).toContain('STUDIO_CLEAR_RUNTIME_STATE')
  })
})
