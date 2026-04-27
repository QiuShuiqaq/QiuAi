async function getDrawResult ({ id }, { httpClient }) {
  const response = await httpClient.post('/v1/draw/result', { id })

  if (response.data.code === -22) {
    return {
      id,
      progress: 0,
      status: 'running',
      failure_reason: '',
      error: '',
      results: []
    }
  }

  if (response.data.code !== 0) {
    throw new Error(response.data.msg || 'Failed to query draw result.')
  }

  return response.data.data
}

module.exports = {
  getDrawResult
}
