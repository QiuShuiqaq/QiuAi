function createActivationGuardService({ licenseService }) {
  async function getActivationStatus() {
    return licenseService.getActivationStatus()
  }

  async function assertActivated() {
    const activationStatus = await getActivationStatus()
    if (activationStatus.status !== 'activated') {
      throw new Error(activationStatus.message || '未检测到授权文件')
    }

    return activationStatus
  }

  return {
    getActivationStatus,
    assertActivated
  }
}

module.exports = {
  createActivationGuardService
}
