const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9530,
    timeout: 120000,
  })
  await wait(5000)

  const info = await mp.evaluate(() => ({
    cloudType: typeof wx.cloud,
    hasCallFunction: !!(wx.cloud && wx.cloud.callFunction),
    env: (wx.cloud && wx.cloud.init) ? 'has-init' : 'no-init',
  }))
  console.log('cloud 能力 =', JSON.stringify(info))

  const res = await mp.evaluate(async () => {
    try {
      const r = await wx.cloud.callFunction({ name: 'api', data: { action: 'login' } })
      return { ok: true, result: r.result }
    } catch (err) {
      return { ok: false, msg: err.errMsg || err.message || String(err) }
    }
  })
  console.log('调用结果 =', JSON.stringify(res).slice(0, 600))
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
