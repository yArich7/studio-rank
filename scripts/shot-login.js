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
  await mp.callWxMethod('removeStorageSync', 'auth_token')
  await mp.callWxMethod('removeStorageSync', 'auth_user')
  await mp.reLaunch('/pages/rank/index')
  await wait(3000)
  console.log('page =', (await mp.currentPage()).path)
  await mp.screenshot({ path: 'docs/screenshots/shot-login.png' })
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
