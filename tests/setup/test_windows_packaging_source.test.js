import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('windows packaging source', () => {
  it('defines a dedicated windows packaging script and output directory', () => {
    const packageSource = fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')

    expect(packageSource).toContain('"package:win"')
    expect(packageSource).toContain('electron-builder')
    expect(packageSource).toContain('../package/QiuAi-win')
    expect(packageSource).toContain('"target": "nsis"')
    expect(packageSource).toContain('"target": "portable"')
  })
})
