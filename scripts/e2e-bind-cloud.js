const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function call(mp, action, data = {}) {
  return mp.evaluate(async (a, d) => {
    try {
      const r = await wx.cloud.callFunction({ name: 'api', data: { action: a, ...d } })
      return r.result
    } catch (err) {
      return { ok: false, error: err.errMsg || String(err) }
    }
  }, action, data)
}

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9550,
    timeout: 120000,
  })
  await wait(5000)

  // 直接走云函数绑定，避开输入框交互
  const preview = await call(mp, 'bind', { site: 'cn', slug: 'i2ecursing-vaughantwc', dryRun: true })
  console.log('1. 预览 =', JSON.stringify(preview).slice(0, 200))

  const bind = await call(mp, 'bind', { site: 'cn', slug: 'i2ecursing-vaughantwc', dryRun: false })
  console.log('2. 绑定 =', JSON.stringify(bind).slice(0, 160))

  // 触发同步
  const sync = await mp.evaluate(async () => {
    const r = await wx.cloud.callFunction({ name: 'sync' })
    return r.result
  })
  console.log('3. 同步 =', JSON.stringify(sync).slice(0, 240))

  const stats = await call(mp, 'stats')
  console.log('4. 数据 =', JSON.stringify(stats).slice(0, 320))

  const rank = await call(mp, 'rank', { period: 'total' })
  console.log('5. 榜单 =', JSON.stringify(rank).slice(0, 240))

  const page = await mp.reLaunch('/pages/stats/index')
  await wait(4000)
  await mp.screenshot({ path: 'docs/screenshots/shot-cloud-stats.png' })
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
