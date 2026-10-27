const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9580,
    timeout: 120000,
  })
  await wait(7000)

  await mp.reLaunch('/pages/rank/index')
  await wait(4000)

  // switchTab 本身耗时 vs 数据是否立刻可见
  const t0 = Date.now()
  await mp.switchTab('/pages/stats/index')
  const switchMs = Date.now() - t0
  const page = await mp.currentPage()
  const stats = await page.data('stats')
  console.log(`switchTab 耗时 = ${switchMs}ms`)
  console.log(`切完立刻有数据 = ${stats ? '是' : '否'}`)

  const t1 = Date.now()
  await mp.switchTab('/pages/rank/index')
  const switchMs2 = Date.now() - t1
  const page2 = await mp.currentPage()
  const list = await page2.data('list')
  console.log(`切回耗时 = ${switchMs2}ms, 立刻有条数 = ${(list || []).length}`)

  const cacheKeys = await mp.evaluate(() => Object.keys(wx.getStorageSync('rank_cache_total') || {}))
  console.log('榜单缓存 =', JSON.stringify(cacheKeys))
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
