import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('QiuAi structure', () => {
  it('contains Electron and renderer entry files', () => {
    expect(fs.existsSync(path.resolve(process.cwd(), 'main/main.js'))).toBe(true)
    expect(fs.existsSync(path.resolve(process.cwd(), 'main/preload.js'))).toBe(true)
    expect(fs.existsSync(path.resolve(process.cwd(), 'renderer/src/main.js'))).toBe(true)
  })
})
