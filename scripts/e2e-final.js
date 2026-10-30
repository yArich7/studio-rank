const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9660,
    timeout: 120000,
  })
  await wait(6000)
  const call = (action, data = {}) =>
    mp.evaluate(async (a, d) => {
      try {
        const r = await wx.cloud.callFunction({ name: 'api', data: { action: a, ...d } })
        return r.result
      } catch (err) { return { ok: false, error: err.errMsg } }
    }, action, data)

  console.log('清库入口 =', JSON.stringify(await call('reset', { confirm: 'DELETE_ALL_DATA' })))
  console.log('登录     =', JSON.stringify(await call('login')).slice(0, 120))
  console.log('看榜单   =', JSON.stringify(await call('rank', { period: 'total' })).slice(0, 90))
  console.log('绑定无码 =', JSON.stringify(await call('bind', { site: 'cn', slug: 'i2ecursing-vaughantwc', dryRun: true })))
  console.log('绑定有码 =', JSON.stringify(await call('bind', { site: 'cn', slug: 'i2ecursing-vaughantwc', invite: 'STUDIO2026', dryRun: true })).slice(0, 110))
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
