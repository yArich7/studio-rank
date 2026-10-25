const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  let mp
  try {
    mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9460' })
  } catch (err) {
    mp = await automator.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: '/Users/yarich/Documents/codeproject',
      port: 9460,
      timeout: 120000,
    })
  }
  await wait(4500)
  const page = await mp.reLaunch('/pages/mine/index')
  await wait(4500)
  const user = await page.data('user')
  console.log('build      =', await page.data('build'))
  console.log('avatarUrl  =', user && String(user.avatarUrl).slice(0, 60))
  console.log('avatarError=', await page.data('avatarError'))
  await mp.screenshot({ path: 'docs/screenshots/shot-avatar-final.png' })
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
