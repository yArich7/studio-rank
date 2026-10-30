const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9620,
    timeout: 120000,
  })
  await wait(6000)

  const call = (action, data = {}) =>
    mp.evaluate(async (a, d) => {
      try {
        const r = await wx.cloud.callFunction({ name: 'api', data: { action: a, ...d } })
        return r.result
      } catch (err) {
        return { ok: false, error: err.errMsg || String(err) }
      }
    }, action, data)

  console.log('1. 清库 =', JSON.stringify(await call('reset', { confirm: 'DELETE_ALL_DATA' })))
  console.log('2. 登录 =', JSON.stringify(await call('login')).slice(0, 160))
  console.log('3. 不看邀请码先看榜单 =', JSON.stringify(await call('rank', { period: 'total' })).slice(0, 140))
  console.log('4. 无码绑定 =', JSON.stringify(await call('bind', { site: 'cn', slug: 'i2ecursing-vaughantwc', dryRun: true })).slice(0, 120))
  console.log('5. 错码绑定 =', JSON.stringify(await call('bind', { site: 'cn', slug: 'i2ecursing-vaughantwc', invite: 'WRONG', dryRun: true })).slice(0, 120))
  console.log('6. 正确码预览 =', JSON.stringify(await call('bind', { site: 'cn', slug: 'i2ecursing-vaughantwc', invite: 'STUDIO2026', dryRun: true })).slice(0, 140))
  console.log('7. 正式绑定 =', JSON.stringify(await call('bind', { site: 'cn', slug: 'i2ecursing-vaughantwc', invite: 'STUDIO2026' })).slice(0, 120))
  console.log('8. 数据 =', JSON.stringify(await call('stats')).slice(0, 200))
  console.log('9. 退出 =', JSON.stringify(await call('logout')))
  console.log('10. 退出后数据 =', JSON.stringify(await call('stats')).slice(0, 80))
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
