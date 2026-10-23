const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })

  const profile = await mp.reLaunch('/pages/profile/index')
  await wait(2500)
  await mp.screenshot({ path: 'docs/screenshots/shot-profile.png' })
  console.log('profile nickname =', await profile.data('nickname'))

  const rank = await mp.reLaunch('/pages/rank/index')
  await wait(3000)
  const list = await rank.data('list')
  console.log('rank rows =', list.length, list[0] && list[0].nickname)
  await mp.screenshot({ path: 'docs/screenshots/shot-rank-named.png' })

  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
