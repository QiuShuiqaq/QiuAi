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

async function safeRecordRequestMetric (requestMetricRecorder, payload) {
  if (typeof requestMetricRecorder !== 'function') {
    return
  }

  try {
    await requestMetricRecorder(payload)
  } catch {
    // 请求指标记录失败不应中断主流程。
  }
}

function createHttpClientService ({
  apiBaseUrl,
  apiKey,
  requestClient = axios.create,
  messageRecorder,
  timeoutMs = 30000,
  getNowMs = () => Date.now(),
  requestMetricRecorder
}) {
  const client = requestClient({
    baseURL: apiBaseUrl,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    timeout: timeoutMs
  })

  return {
    async post (requestPath, payload) {
      const startedAt = getNowMs()

      try {
        const response = await client.post(requestPath, payload)
        const elapsedMs = Math.max(0, getNowMs() - startedAt)

        await safeRecordMessage(messageRecorder, {
          kind: 'api',
          method: 'POST',
          apiBaseUrl,
          requestPath,
          requestPayload: payload,
          responseData: response.data,
          elapsedMs,
          requestStatus: 'success'
        })
        await safeRecordRequestMetric(requestMetricRecorder, {
          method: 'POST',
          requestPath,
          elapsedMs,
          requestStatus: 'success'
        })

        return response
      } catch (error) {
        const elapsedMs = Math.max(0, getNowMs() - startedAt)

        await safeRecordMessage(messageRecorder, {
          kind: 'api',
          method: 'POST',
          apiBaseUrl,
          requestPath,
          requestPayload: payload,
          responseData: error.response ? error.response.data : null,
          errorMessage: error.message,
          elapsedMs,
          requestStatus: 'failed'
        })
        await safeRecordRequestMetric(requestMetricRecorder, {
          method: 'POST',
          requestPath,
          elapsedMs,
          requestStatus: 'failed'
        })

        throw error
      }
    }
  }
}

module.exports = {
  createHttpClientService
}
