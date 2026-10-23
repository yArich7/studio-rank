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
  const page = await mp.reLaunch('/pages/rank/index')
  await wait(3500)
  console.log('period =', await page.data('period'), '| score =', JSON.stringify(await page.data('myRank')))
  await mp.screenshot({ path: 'docs/screenshots/shot-rank-total.png' })

  const tabs = await page.$$('.tab')
  await tabs[1].tap()
  await wait(2500)
  console.log('after tap =', await page.data('period'), '| since =', await page.data('statsSince'))
  await mp.screenshot({ path: 'docs/screenshots/shot-rank-week.png' })
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
