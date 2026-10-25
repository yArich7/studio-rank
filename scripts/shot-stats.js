const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function connect() {
  try {
    return await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9480' })
  } catch (err) {
    return automator.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: '/Users/yarich/Documents/codeproject',
      port: 9480,
      timeout: 120000,
    })
  }
}

async function main() {
  const mp = await connect()
  const page = await mp.reLaunch('/pages/stats/index')
  await wait(5000)
  const stats = await page.data('stats')
  console.log('byDifficulty =', stats && JSON.stringify(stats.byDifficulty))
  console.log('bars =', JSON.stringify(await page.data('bars')))
  await mp.screenshot({ path: 'docs/screenshots/shot-stats-count.png' })
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
