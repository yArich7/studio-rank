const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9670,
    timeout: 120000,
  })
  await wait(6500)

  const call = (action, data = {}) =>
    mp.evaluate(async (a, d) => {
      try {
        const r = await wx.cloud.callFunction({ name: 'api', data: { action: a, ...d } })
        return r.result
      } catch (err) { return { ok: false, error: err.errMsg } }
    }, action, data)

  console.log('危险入口 reset  =', JSON.stringify(await call('reset', { confirm: 'DELETE_ALL_DATA' })))
  console.log('危险入口 restore=', JSON.stringify(await call('restore', { confirm: 'RESTORE_LOCAL_SNAPSHOT' })))
  console.log('登录            =', JSON.stringify(await call('login')).slice(0, 100))
  console.log('榜单            =', JSON.stringify(await call('rank', { period: 'week' })).slice(0, 80))
  console.log('数据            =', JSON.stringify(await call('stats')).slice(0, 80))

  // 逐个页面加载
  for (const [path, label] of [
    ['/pages/rank/index', '榜单'],
    ['/pages/stats/index', '数据'],
    ['/pages/mine/index', '我的'],
  ]) {
    const page = await mp.switchTab(path)
    await wait(2200)
    console.log(`页面 ${label} ->`, (await mp.currentPage()).path)
  }

  const bind = await mp.navigateTo('/pages/bind/index')
  await wait(2200)
  console.log('页面 绑定 ->', (await mp.currentPage()).path, '| needInvite =', await (await mp.currentPage()).data('needInvite'))

  const profile = await mp.navigateTo('/pages/profile/index')
  await wait(1800)
  console.log('页面 资料 ->', (await mp.currentPage()).path)

  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
