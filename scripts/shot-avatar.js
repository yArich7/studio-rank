const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9420,
    timeout: 120000,
  })
  await wait(4000)

  // 清掉本地缓存的用户信息（里面是旧的 localhost 地址）
  await mp.callWxMethod('removeStorageSync', 'auth_user')
  await mp.callWxMethod('removeStorageSync', 'auth_token')

  const mine = await mp.reLaunch('/pages/mine/index')
  await wait(4000)
  const user = await mine.data('user')
  console.log('mine avatar =', user && user.avatarUrl)
  await mp.screenshot({ path: 'docs/screenshots/shot-mine-avatar.png' })

  const rank = await mp.reLaunch('/pages/rank/index')
  await wait(3500)
  const list = await rank.data('list')
  console.log('rank avatar =', list[0] && list[0].avatarUrl)
  await mp.screenshot({ path: 'docs/screenshots/shot-rank-avatar.png' })

  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
