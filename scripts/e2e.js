const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })

  // 清掉本地登录态，模拟第一次进入
  await mp.callWxMethod('removeStorageSync', 'auth_token')
  await mp.callWxMethod('removeStorageSync', 'auth_user')

  const bind = await mp.reLaunch('/pages/bind/index')
  await wait(1500)
  const input = await bind.$('.input')
  await input.input('https://leetcode.cn/u/i2ecursing-vaughantwc/')
  await wait(400)

  const buttons = await bind.$$('.btn-primary')
  await buttons[0].tap()
  await wait(5000)
  await mp.screenshot({ path: 'shot-bind-preview.png' })
  console.log('preview step captured')

  const after = await bind.$$('.btn-primary')
  console.log('buttons now:', after.length)
  if (after.length > 1) {
    await after[after.length - 1].tap()
    await wait(3000)
  }

  const rank = await mp.reLaunch('/pages/rank/index')
  await wait(3500)
  console.log('myRank =', JSON.stringify(await rank.data('myRank')))
  console.log('list len =', (await rank.data('list')).length)
  await mp.screenshot({ path: 'shot-rank-bound.png' })
  console.log('done')
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
