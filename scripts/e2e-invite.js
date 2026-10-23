const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })

  await mp.callWxMethod('removeStorageSync', 'auth_token')
  await mp.callWxMethod('removeStorageSync', 'auth_user')

  await mp.reLaunch('/pages/rank/index')
  await wait(3500)

  let page = await mp.currentPage()
  console.log('当前页面:', page.path)
  await mp.screenshot({ path: 'docs/screenshots/shot-invite.png' })

  const input = await page.$('.input')
  await input.input('CLASS2026')
  await wait(300)
  const btn = await page.$('.btn-primary')
  await btn.tap()
  await wait(3000)

  page = await mp.currentPage()
  console.log('提交后页面:', page.path)
  await wait(2500)
  await mp.screenshot({ path: 'docs/screenshots/shot-after-invite.png' })

  console.log('done')
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
