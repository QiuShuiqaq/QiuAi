const axios = require('axios')

async function safeRecordMessage (messageRecorder, payload) {
  if (!messageRecorder || typeof messageRecorder.record !== 'function') {
    return
  }

  try {
    await messageRecorder.record(payload)
  } catch {
    // 消息追踪失败不应中断主流程。
  }
}

function createHttpClientService ({ apiBaseUrl, apiKey, requestClient = axios.create, messageRecorder }) {
  const client = requestClient({
    baseURL: apiBaseUrl,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    timeout: 30000
  })

  return {
    async post (requestPath, payload) {
      try {
        const response = await client.post(requestPath, payload)

        await safeRecordMessage(messageRecorder, {
          kind: 'api',
          method: 'POST',
          apiBaseUrl,
          requestPath,
          requestPayload: payload,
          responseData: response.data
        })

        return response
      } catch (error) {
        await safeRecordMessage(messageRecorder, {
          kind: 'api',
          method: 'POST',
          apiBaseUrl,
          requestPath,
          requestPayload: payload,
          responseData: error.response ? error.response.data : null,
          errorMessage: error.message
        })

        throw error
      }
    }
  }
}

module.exports = {
  createHttpClientService
}
