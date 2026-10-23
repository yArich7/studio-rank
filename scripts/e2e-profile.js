const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function connect() {
  try {
    return await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
  } catch (err) {
    console.log('connect failed, launching IDE...')
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

  const page = await mp.reLaunch('/pages/profile/index')
  await wait(2500)
  await mp.screenshot({ path: 'docs/screenshots/shot-profile.png' })
  console.log('before nickname =', await page.data('nickname'))

  const input = await page.$('.input')
  await input.input('阿伟')
  await wait(300)
  const btn = await page.$('.btn-primary')
  await btn.tap()
  await wait(2500)

  const rank = await mp.reLaunch('/pages/rank/index')
  await wait(2500)
  const list = await rank.data('list')
  console.log('rank row =', JSON.stringify(list[0]))
  await mp.screenshot({ path: 'docs/screenshots/shot-rank-named.png' })

  console.log('done')
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
