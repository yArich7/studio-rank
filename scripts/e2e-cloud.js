const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9540,
    timeout: 120000,
  })
  await wait(5000)

  await mp.callWxMethod('removeStorageSync', 'auth_user_v3')
  await mp.callWxMethod('removeStorageSync', 'auth_user')

  await mp.reLaunch('/pages/rank/index')
  await wait(5000)
  let page = await mp.currentPage()
  console.log('1. 首次进入 ->', page.path)

  if (page.path.includes('invite')) {
    const input = await page.$('.input')
    await input.input('STUDIO2026')
    await wait(400)
    await (await page.$('.btn-primary')).tap()
    await wait(5000)
    page = await mp.currentPage()
    console.log('2. 输码后 ->', page.path)
  }

  const rank = await mp.currentPage()
  if (rank.path.includes('rank')) {
    console.log('3. 榜单条数 =', (await rank.data('list')).length)
    console.log('4. 我的排名 =', JSON.stringify(await rank.data('myRank')))
  }
  await mp.screenshot({ path: 'docs/screenshots/shot-cloud.png' })
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
