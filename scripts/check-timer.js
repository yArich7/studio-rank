const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9590,
    timeout: 120000,
  })
  await wait(6000)
  const res = await mp.evaluate(async () => {
    const r = await wx.cloud.callFunction({ name: 'api', data: { action: 'stats' } })
    return r.result
  })
  console.log(JSON.stringify(res).slice(0, 400))
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
