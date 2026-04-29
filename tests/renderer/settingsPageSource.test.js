import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Settings page source', () => {
  it('renders api key settings controls', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/pages/SettingsPage.vue'), 'utf8')
    expect(source).toContain('API Host')
    expect(source).toContain('API Key')
    expect(source).toContain('界面主题')
    expect(source).toContain('夜间科技')
    expect(source).not.toContain('明亮护眼')
    expect(source).toContain('保存设置')
    expect(source).toContain('output 文件夹')
  })
})
