async function createChatCompletion ({ model, messages }, { httpClient }) {
  const response = await httpClient.post('/v1/chat/completions', {
    model,
    stream: false,
    messages
  })

  const content = response?.data?.choices?.[0]?.message?.content

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('文案模型未返回有效内容。')
  }

  return {
    id: response.data.id || '',
    model: response.data.model || model,
    content: content.trim(),
    finishReason: response?.data?.choices?.[0]?.finish_reason || ''
  }
}

module.exports = {
  createChatCompletion
}
