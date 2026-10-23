const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function connect() {
  try {
    return await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
  } catch (err) {
    return automator.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: '/Users/yarich/Documents/codeproject',
      port: 9420,
      timeout: 120000,
    })
  }
}

async function main() {
  const mp = await connect()
  await mp.reLaunch('/pages/bind/index')
  await wait(2500)
  await mp.screenshot({ path: 'docs/screenshots/shot-bind-rules.png' })
  await mp.disconnect()
  console.log('done')
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
