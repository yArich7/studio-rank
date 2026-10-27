const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9570,
    timeout: 120000,
  })
  await wait(6000)

  // 首次加载（无缓存）
  let t0 = Date.now()
  await mp.reLaunch('/pages/rank/index')
  let page = await mp.currentPage()
  while (Date.now() - t0 < 15000) {
    const list = await page.data('list')
    if (list && list.length) break
    await wait(100)
  }
  console.log('首次加载榜单 =', Date.now() - t0, 'ms')

  await wait(1500)

  // 切到数据页（有缓存）
  t0 = Date.now()
  await mp.switchTab('/pages/stats/index')
  page = await mp.currentPage()
  while (Date.now() - t0 < 15000) {
    const stats = await page.data('stats')
    if (stats) break
    await wait(50)
  }
  console.log('切到数据页 =', Date.now() - t0, 'ms (含 tab 动画)')

  await wait(1200)

  // 切回榜单
  t0 = Date.now()
  await mp.switchTab('/pages/rank/index')
  page = await mp.currentPage()
  while (Date.now() - t0 < 15000) {
    const list = await page.data('list')
    if (list && list.length) break
    await wait(50)
  }
  console.log('切回榜单 =', Date.now() - t0, 'ms (含 tab 动画)')

  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
