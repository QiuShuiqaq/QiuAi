import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Vite config source', () => {
  it('pins the dev server to a strict port for electron startup', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'renderer/vite.config.js'), 'utf8')
    expect(source).toContain('port: 5173')
    expect(source).toContain('strictPort: true')
  })
})
