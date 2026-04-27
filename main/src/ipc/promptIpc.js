const { ipcMain } = require('electron')
const ipcChannels = require('../../../shared/ipcChannels')

function registerPromptIpc ({ promptTemplateService }) {
  ipcMain.handle(ipcChannels.PROMPTS_LIST, () => {
    return promptTemplateService.listTemplates()
  })

  ipcMain.handle(ipcChannels.PROMPTS_SAVE, async (_event, payload = {}) => {
    return promptTemplateService.saveTemplate(payload)
  })

  ipcMain.handle(ipcChannels.PROMPTS_REMOVE, async (_event, payload = {}) => {
    await promptTemplateService.removeTemplate(payload.id)
    return {
      ok: true
    }
  })
}

module.exports = registerPromptIpc
