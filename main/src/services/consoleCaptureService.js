const CONSOLE_CAPTURE_KEY = Symbol.for('qiuai.console.capture')

function safeSerializeConsoleArgs(args = []) {
  return args.map((item) => {
    if (typeof item === 'string') {
      return item
    }

    try {
      return JSON.stringify(item)
    } catch {
      return String(item)
    }
  }).join(' ')
}

function attachConsoleCapture({
  runtimeLogger,
  consoleObject = console
} = {}) {
  if (!runtimeLogger || typeof runtimeLogger.log !== 'function') {
    return
  }

  if (globalThis[CONSOLE_CAPTURE_KEY]) {
    return
  }

  const methods = ['log', 'info', 'warn', 'error']
  methods.forEach((methodName) => {
    const originalMethod = consoleObject[methodName]
    if (typeof originalMethod !== 'function') {
      return
    }

    consoleObject[methodName] = (...args) => {
      originalMethod.apply(consoleObject, args)
      void runtimeLogger.log({
        level: methodName === 'log' ? 'info' : methodName,
        event: 'console-output',
        message: safeSerializeConsoleArgs(args)
      })
    }
  })

  globalThis[CONSOLE_CAPTURE_KEY] = true
}

module.exports = {
  attachConsoleCapture
}
