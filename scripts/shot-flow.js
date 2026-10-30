const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9650,
    timeout: 120000,
  })
  await wait(6000)

  // 退出，回到未绑定状态，看绑定页是否出现邀请码
  await mp.evaluate(async () => {
    await wx.cloud.callFunction({ name: 'api', data: { action: 'logout' } })
    wx.removeStorageSync('auth_user_v3')
    wx.removeStorageSync('stats_cache')
    wx.removeStorageSync('rank_cache_total')
  })

  const bind = await mp.reLaunch('/pages/bind/index')
  await wait(4500)
  console.log('绑定页 needInvite =', await bind.data('needInvite'))
  await mp.screenshot({ path: 'docs/screenshots/shot-bind-invite.png' })

  const mine = await mp.switchTab('/pages/mine/index').then(() => wait(2500)).then(() => mp.currentPage())
  await mp.screenshot({ path: 'docs/screenshots/shot-mine-logout.png' })
  console.log('我的页版本 =', await mine.data('build'))
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
