const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9480,
    timeout: 120000,
  })
  await wait(4500)
  const page = await mp.reLaunch('/pages/stats/index')
  await wait(3500)
  console.log('profile =', JSON.stringify(await page.data('stats.profile')))
  await mp.screenshot({ path: 'docs/screenshots/shot-stats-lc.png' })
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
