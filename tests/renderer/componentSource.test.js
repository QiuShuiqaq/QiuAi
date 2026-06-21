import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@vue/compiler-sfc'

describe('component sources', () => {
  it('parses PromptLibraryPanel.vue without template syntax errors', () => {
    const promptLibrarySource = fs.readFileSync(
      path.resolve(process.cwd(), 'renderer/src/components/PromptLibraryPanel.vue'),
      'utf8'
    )

    expect(() => parse(promptLibrarySource)).not.toThrow()
  })

  it('keeps the main studio component structure wired to the current UI modules', () => {
    const appSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/App.vue'), 'utf8')
    const topbarSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/AppTopBar.vue'), 'utf8')
    const parameterSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/ParameterSettingsPanel.vue'), 'utf8')
    const resultSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/ResultDisplayPanel.vue'), 'utf8')
    const exportSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/ResultExportPanel.vue'), 'utf8')
    const dashboardSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/WorkspaceDashboard.vue'), 'utf8')
    const promptLibrarySource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/PromptLibraryPanel.vue'), 'utf8')
    const taskSidebarSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/TaskManagerSidebar.vue'), 'utf8')
    const styleSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/assets/styles.css'), 'utf8')

    expect(appSource).toContain("key: 'series-design'")
    expect(appSource).toContain("key: 'series-generate'")
    expect(appSource).toContain('createDefaultFormDrafts')
    expect(appSource).toContain('handleSubmitTask')
    expect(appSource).toContain('loadStudioSnapshot')

    expect(topbarSource).toContain("defineEmits(['brand-click', 'theme-change', 'cleanup-click'])")
    expect(topbarSource).toContain('contactGroups')
    expect(topbarSource).toContain('openContactPreview')
    expect(topbarSource).toContain('closeContactPreview')
    expect(topbarSource).toContain('topbar-clean-button')
    expect(topbarSource).toContain('topbar-contact-actions')
    expect(topbarSource).toContain('Dockerfans.jpg')
    expect(topbarSource).toContain('Qiyeweixin.jpg')

    expect(parameterSource).toContain('promptTemplateOptions')
    expect(parameterSource).toContain('negativePromptTemplateOptions')
    expect(parameterSource).toContain('createUploadDirectoryBinding')
    expect(parameterSource).toContain('createAssignmentPromptBinding')
    expect(parameterSource).toContain('createSeriesGeneratePromptBinding')
    expect(parameterSource).toContain('number-stepper')
    expect(parameterSource).toContain('taskScaleSummary')

    expect(resultSource).toContain("activeMenu === 'model-pricing'")
    expect(resultSource).toContain('latestTask')
    expect(resultSource).toContain('promptFinal')
    expect(resultSource).toContain('resolveOutputElapsedLabel')
    expect(resultSource).toContain('image-result-card__elapsed')
    expect(resultSource).toContain('preview-modal')

    expect(exportSource).toContain('pagedExportItems')
    expect(exportSource).toContain('totalPages')
    expect(exportSource).toContain('delete-export-item')
    expect(exportSource).toContain('open-output-directory')
    expect(exportSource).toContain('toggle-download-cleanup')

    expect(taskSidebarSource).toContain('stop-task')
    expect(taskSidebarSource).toContain('isStoppableTask')
    expect(taskSidebarSource).toContain('task-card__error')

    expect(dashboardSource).toContain('networkMonitorCard')
    expect(dashboardSource).toContain('creditMessagesCard')
    expect(dashboardSource).toContain('refresh-total-credits')
    expect(dashboardSource).toContain('refresh-remaining-credits')

    expect(promptLibrarySource).toContain('expandedPositiveTemplateId')
    expect(promptLibrarySource).toContain('expandedNegativeTemplateId')
    expect(promptLibrarySource).toContain('prompt-template-add-button')
    expect(promptLibrarySource).toContain('FormTextControl')

    expect(styleSource).toContain('.clear-runtime-confirm-modal')
    expect(styleSource).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)')
  })

  it('uses stable v-model bindings for editable parameter text fields', () => {
    const parameterSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/ParameterSettingsPanel.vue'), 'utf8')

    expect(parameterSource).toContain('const taskNameModel = createFieldBinding(\'taskName\')')
    expect(parameterSource).toContain('const seriesDesignGlobalPromptModel = createFieldBinding(\'globalPrompt\')')
    expect(parameterSource).toContain('const seriesDesignNegativePromptModel = createFieldBinding(\'negativePrompt\')')
    expect(parameterSource).toContain('const seriesGenerateGlobalPromptModel = createFieldBinding(\'globalPrompt\')')
    expect(parameterSource).toContain('const seriesGenerateNegativePromptModel = createFieldBinding(\'negativePrompt\')')
    expect(parameterSource).toContain('v-model="taskNameModel"')
    expect(parameterSource).toContain('v-model="singleImagePromptModel"')
    expect(parameterSource).toContain('v-model="singleImageNotesModel"')
    expect(parameterSource).toContain('v-model="singleDesignPromptModel"')
    expect(parameterSource).toContain('v-model="singleDesignNotesModel"')
    expect(parameterSource).toContain('v-model="seriesDesignGlobalPromptModel"')
    expect(parameterSource).toContain('v-model="seriesDesignNegativePromptModel"')
    expect(parameterSource).toContain('v-model="seriesGenerateGlobalPromptModel"')
    expect(parameterSource).toContain('v-model="seriesGenerateNegativePromptModel"')
    expect(parameterSource).not.toContain('@input="emitField(\'taskName\', $event.target.value)"')
    expect(parameterSource).not.toContain('@input="emitField(\'globalPrompt\', $event.target.value)"')
    expect(parameterSource).toContain('v-model="singleImageUploadDirectoryModel"')
    expect(parameterSource).toContain('v-model="singleDesignUploadDirectoryModel"')
    expect(parameterSource).toContain('v-model="seriesDesignUploadDirectoryModel"')
    expect(parameterSource).toContain('v-model="seriesGenerateUploadDirectoryModel"')
  })

  it('keeps FormTextControl fully controlled by parent model updates', () => {
    const formTextControlSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/FormTextControl.vue'), 'utf8')

    expect(formTextControlSource).toContain('const stringValue = computed(() => {')
    expect(formTextControlSource).toContain("emit('update:modelValue', event?.target?.value ?? '')")
    expect(formTextControlSource).toContain(':value="stringValue"')
    expect(formTextControlSource).not.toContain('const localValue = ref(')
    expect(formTextControlSource).not.toContain('watch(localValue')
  })
})
