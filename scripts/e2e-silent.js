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

  // 清掉登录态，模拟新设备首次打开
  await mp.callWxMethod('removeStorageSync', 'auth_token')
  await mp.callWxMethod('removeStorageSync', 'auth_user')

  const page = await mp.reLaunch('/pages/rank/index')
  await wait(4000)

  console.log('当前页面 =', (await mp.currentPage()).path)
  console.log('榜单条数 =', (await page.data('list')).length)
  console.log('我的排名 =', JSON.stringify(await page.data('myRank')))
  await mp.screenshot({ path: 'docs/screenshots/shot-silent-login.png' })
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
