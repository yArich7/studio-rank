const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9560,
    timeout: 120000,
  })
  await wait(6000)

  const timings = await mp.evaluate(async () => {
    const out = []
    for (let i = 0; i < 4; i += 1) {
      const t0 = Date.now()
      try {
        await wx.cloud.callFunction({ name: 'api', data: { action: 'stats' } })
        out.push({ i, ms: Date.now() - t0, ok: true })
      } catch (err) {
        out.push({ i, ms: Date.now() - t0, ok: false, err: err.errMsg })
      }
    }
    return out
  })
  console.log(JSON.stringify(timings, null, 1))
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
