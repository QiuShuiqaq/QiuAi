import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('createMainWindow source', () => {
  it('disables renderer sandbox and wires a custom window icon', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'main/src/bootstrap/createMainWindow.js'), 'utf8')
    expect(source).toContain('preload: path.resolve(__dirname, \'../../preload.js\')')
    expect(source).toContain('icon: path.resolve(__dirname, \'../../assets/app-icon.png\')')
    expect(source).toContain('contextIsolation: true')
    expect(source).toContain('nodeIntegration: false')
    expect(source).toContain('sandbox: false')
  })
})
