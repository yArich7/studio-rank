const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
  const page = await mp.reLaunch('/pages/profile/index')
  await wait(3000)
  console.log('avatarUrl =', await page.data('avatarUrl'))
  console.log('avatarPath =', await page.data('avatarPath'))

  const input = await page.$('.input')
  await input.input('莫言')
  await wait(300)
  const btn = await page.$('.btn-primary')
  await btn.tap()
  await wait(2500)

  const mine = await mp.reLaunch('/pages/mine/index')
  await wait(2500)
  const user = await mine.data('user')
  console.log('保存后 avatarUrl =', user && user.avatarUrl)
  await mp.screenshot({ path: 'docs/screenshots/shot-profile-saved.png' })
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
