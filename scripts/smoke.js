const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9450,
    timeout: 120000,
  })
  await wait(4000)
  const page = await mp.reLaunch('/pages/rank/index')
  await wait(3500)
  const list = await page.data('list')
  console.log('页面 =', (await mp.currentPage()).path)
  console.log('榜单条数 =', list.length, '| 首条 =', list[0] && list[0].nickname)
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
