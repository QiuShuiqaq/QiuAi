import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('PromptTemplateManager source', () => {
  it('renders local template CRUD controls', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/PromptTemplateManager.vue'), 'utf8')
    expect(source).toContain('新建模板')
    expect(source).toContain('保存模板')
    expect(source).toContain('删除模板')
    expect(source).toContain('模板名称')
    expect(source).toContain('分类')
    expect(source).toContain('提示词')
  })
})
