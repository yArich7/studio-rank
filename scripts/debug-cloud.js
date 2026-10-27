const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9500,
    timeout: 120000,
  })
  await wait(5000)
  console.log('last_error =', await mp.callWxMethod('getStorageSync', 'last_login_error'))

  // 直接调云函数看返回
  const res = await mp.callWxMethod('cloud.callFunction', {
    name: 'api',
    data: { action: 'login' },
  }).catch((e) => ({ error: e.message }))
  console.log('callFunction =', JSON.stringify(res).slice(0, 500))
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
