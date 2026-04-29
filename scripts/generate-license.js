#!/usr/bin/env node

const fs = require('node:fs/promises')
const path = require('node:path')
const { createSignedLicenseRecord } = require('../main/src/services/licenseService')

const LICENSE_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEArQyZVTZQI9ny9aHr/oGJGMwCXOlBb2xtgsjWgy2TuAqUJAfZ
gdltpPOtxEqm1AieOWxoIMogrncHARj9APeOk/vOcFTroXwgh/1LMFZVPueutsbJ
L430+C6raoNZbO017zNxfWWD6N0g4BbwzqJsvi4A+UEI31dAucAwnC9GTDBZ9Pzp
aCkJQLSxIBhEK8ZcrdqffV+4g25cTfCCHPl607bHnIo7wWhh6i36+CZa0nh1BQt2
/G0rxSXCrdLyfHf7aKL0LasO8d1pawcZ8WIsbjyhepKPN/DpBsre2NjYQUXlhhaG
hwwyM5A4CbVknH2vXb161dCLStz4LuAMP2sLEQIDAQABAoIBABaLX6aETuh8ynRJ
xg8AHTZHzb8A/G9httqlA51PYMFHT4lqJGIQS4KD5I2AFD/nZ4Wfo+kxrBROmXEB
KmTn24FX+ssTpScCntJYo2UGulBZqp9RQoCZg+KZYeeceRgBx1cEYrKteQPrWw8W
rgSdkIEuSR4v5NID8gDBExQl7IicRLSod7g6lCU8l4b3lk2X59QSYz+XSo2fZm19
o28WEcLE3hj1kY8Ow9fGbD3WhCjsjBAnOeEEwd2FFQyc07mqRh/cz6wuLUBFvSJo
nfAoMtGg5oKh3pBPzOm8mo755J/KpA4JEDwHBpiFsLq5y1UIF1yPjxyllLseaSXn
znMOqKkCgYEA7sS0ciWooJNAlnyfo4IMDaBi98VUGnTMdd2fJy2h1awvHp+HgTRp
PjlPUfUisUpmBD33ZahftIEe1TnhJGmLa9R4496kPyfjgBpUamt1eSshPolpZZyd
xd1CyT1yyVRCmAbeaUEY5zj9o6TrTyfUij5TuMuzDSJcRruQ3zUDT88CgYEAuYm4
DbJU3Iors2Nkj3obiHEgXQAcGqRAgwve6Pm7SQUHqgNRNdMWrfWGNURqcjLWYj6d
RY1sEVAsB7pKL77o+Bj2r41G7wS24sY9vTuAT2wDVeIY/tg9kokDjEty5zyr4AlZ
oL+lYHXqoksq7dpDMGCCiMPAvgCXHOb1GDTEzx8CgYBDW0psSSNg6Sl3SoDeZ3lu
/qfsrcYkEH79YR/ctYrJ9GD2ipp3YImv/ArcXAMFcK+G0tRP4Ufea+5+yG0zEHM8
YBwabFx5VI9hPAxEWTwyinA+bBVHjP8VKm4Ex0jycsq2iHmFx892qyUiXQvksJ/M
v/huUUiZk+/kJFWiIhplEQKBgQCdN1qTmJIaEqa3Kjiy7yhXdGyVAZvO43Ga2bs4
NS0C0dVNtePhtQ3ZuFvR1ThRrkxFEYOYxR5WiVXV8oAcdyvX1udpmFAMBzWlcZAt
QjcWlZM5+g1uHPQHsDwmbGRgFuQZQjMFaH+M/j4k6Ybl53XZj13s39r55Wwm3HnA
2i4OxwKBgQDpik3UpDqao4q6oI5/X/bfuiu32rbZPqCD7me8HvccL5ZnhRlGH+8h
Hdtkbwsd4/HDueVbHJSOU5+g4/qGBpssodCJdRWOeoNSudgMjegrEwVxO6ifFHaV
vONRtvf/5OYEQE21P4xOeXsiFbxmcJjPpXWzbEVzulzkRpKgUA1GjQ==
-----END RSA PRIVATE KEY-----
`

function parseArgs(argv) {
  const parsed = {}

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (!current.startsWith('--')) {
      continue
    }

    parsed[current.slice(2)] = argv[index + 1]
    index += 1
  }

  return parsed
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const customerName = String(args.customer || args.customerName || '').trim()
  const deviceCode = String(args.device || args.deviceCode || '').trim()
  const outputPath = path.resolve(process.cwd(), args.out || 'license.qai')

  if (!customerName || !deviceCode) {
    throw new Error('Usage: npm run generate:license -- --customer "客户名称" --device "QAI-XXXX" --out ./license.qai')
  }

  const signedLicense = createSignedLicenseRecord({
    version: 1,
    customerName,
    deviceCode,
    activatedAt: new Date().toISOString()
  }, LICENSE_PRIVATE_KEY)

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(signedLicense, null, 2), 'utf8')

  console.log(`License written to ${outputPath}`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exitCode = 1
})
