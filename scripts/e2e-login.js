const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function connect() {
  try {
    return await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
  } catch (err) {
    return automator.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: '/Users/yarich/Documents/codeproject',
      port: 9420,
      timeout: 120000,
    })
  }
}

async function main() {
  const mp = await connect()

  await mp.callWxMethod('removeStorageSync', 'auth_token')
  await mp.callWxMethod('removeStorageSync', 'auth_user')

  await mp.reLaunch('/pages/rank/index')
  await wait(3000)
  console.log('1. 未登录进入榜单 ->', (await mp.currentPage()).path)
  await mp.screenshot({ path: 'docs/screenshots/shot-login.png' })

  let page = await mp.currentPage()
  if (!page.path.includes('login')) {
    console.log('未跳转登录页，终止'); await mp.disconnect(); return
  }

  await (await page.$('.checkbox')).tap()
  await wait(300)
  await (await page.$('.btn-wechat')).tap()
  await wait(3500)

  page = await mp.currentPage()
  console.log('2. 点击微信登录后 ->', page.path)

  if (page.path.includes('invite')) {
    await (await page.$('.input')).input('STUDIO2026')
    await wait(300)
    await (await page.$('.btn-primary')).tap()
    await wait(3500)
    page = await mp.currentPage()
    console.log('3. 输入邀请码后 ->', page.path)
  }

  const rank = await mp.currentPage()
  console.log('4. 当前页面数据 list 长度 =', (await rank.data('list')).length)
  await mp.screenshot({ path: 'docs/screenshots/shot-after-login.png' })
  await mp.disconnect()
  console.log('done')
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
