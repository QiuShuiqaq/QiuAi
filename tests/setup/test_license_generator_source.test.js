import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('license generator source', () => {
  it('contains a local script for generating signed license files', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'scripts/generate-license.js'), 'utf8')
    const packageSource = fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')
    const startSource = fs.readFileSync(path.resolve(process.cwd(), 'START.txt'), 'utf8')

    expect(source).toContain('customerName')
    expect(source).toContain('deviceCode')
    expect(source).toContain('license.qai')
    expect(source).toContain('createSignedLicenseRecord')
    expect(packageSource).toContain('generate:license')
    expect(startSource).toContain('generate:license')
    expect(startSource).toContain('license.qai')
  })
})
