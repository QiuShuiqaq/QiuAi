import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('license generator project boundaries', () => {
  it('keeps the signing generator outside the shipped QiuAi project', () => {
    const packageSource = fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')
    const startSource = fs.readFileSync(path.resolve(process.cwd(), 'START.txt'), 'utf8')
    const generatorPath = path.resolve(process.cwd(), 'scripts/generate-license.js')

    expect(fs.existsSync(generatorPath)).toBe(false)
    expect(packageSource).not.toContain('generate:license')
    expect(startSource).not.toContain('npm run generate:license')
  })
})
