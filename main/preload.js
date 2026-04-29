const { contextBridge, ipcRenderer } = require('electron')
const ipcChannels = require('../shared/ipcChannels')

const channels = {
  SETTINGS_GET: ipcChannels.SETTINGS_GET,
  SETTINGS_SAVE: ipcChannels.SETTINGS_SAVE,
  DRAW_CREATE_TASK: ipcChannels.DRAW_CREATE_TASK,
  DRAW_GET_RESULT: ipcChannels.DRAW_GET_RESULT,
  DRAW_DOWNLOAD_IMAGE: ipcChannels.DRAW_DOWNLOAD_IMAGE,
  INPUT_PICK_FOLDER: ipcChannels.INPUT_PICK_FOLDER,
  INPUT_PICK_FILE: ipcChannels.INPUT_PICK_FILE,
  PROMPTS_LIST: ipcChannels.PROMPTS_LIST,
  PROMPTS_SAVE: ipcChannels.PROMPTS_SAVE,
  PROMPTS_REMOVE: ipcChannels.PROMPTS_REMOVE,
  TASKS_CREATE_LOCAL: ipcChannels.TASKS_CREATE_LOCAL,
  TASKS_LIST: ipcChannels.TASKS_LIST,
  TASKS_RUN: ipcChannels.TASKS_RUN,
  TASKS_GET: ipcChannels.TASKS_GET,
  TASKS_EXPORT: ipcChannels.TASKS_EXPORT,
  STUDIO_GET_SNAPSHOT: ipcChannels.STUDIO_GET_SNAPSHOT,
  STUDIO_SAVE_DRAFT: ipcChannels.STUDIO_SAVE_DRAFT,
  STUDIO_CREATE_TASK: ipcChannels.STUDIO_CREATE_TASK,
  STUDIO_PICK_INPUT_ASSETS: ipcChannels.STUDIO_PICK_INPUT_ASSETS,
  STUDIO_OPEN_OUTPUT_DIRECTORY: ipcChannels.STUDIO_OPEN_OUTPUT_DIRECTORY,
  STUDIO_EXPORT_RESULTS: ipcChannels.STUDIO_EXPORT_RESULTS,
  STUDIO_DELETE_EXPORT_ITEM: ipcChannels.STUDIO_DELETE_EXPORT_ITEM,
  STUDIO_CLEAR_RUNTIME_STATE: ipcChannels.STUDIO_CLEAR_RUNTIME_STATE
}

contextBridge.exposeInMainWorld('qiuai', {
  channels,
  invoke (channel, payload) {
    return ipcRenderer.invoke(channel, payload)
  }
})
