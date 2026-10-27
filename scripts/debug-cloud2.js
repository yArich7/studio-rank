const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9510,
    timeout: 120000,
  })
  await wait(5000)

  const info = await mp.callWxMethod('getStorageInfoSync')
  console.log('存储 keys =', JSON.stringify(info))

  const err = await mp.callWxMethod('getStorageSync', 'last_login_error')
  console.log('last_login_error =', JSON.stringify(err))

  const build = await mp.callWxMethod('getStorageSync', 'auth_user_v3')
  console.log('auth_user_v3 =', JSON.stringify(build).slice(0, 120))
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
