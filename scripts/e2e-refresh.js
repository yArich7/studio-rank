const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9420,
    timeout: 120000,
  })
  await wait(4000)

  // 不清缓存，验证启动时会自动刷新用户资料
  const mine = await mp.reLaunch('/pages/mine/index')
  await wait(4000)
  const user = await mine.data('user')
  console.log('mine avatar =', user && user.avatarUrl)
  console.log('avatarError =', await mine.data('avatarError'))
  await mp.screenshot({ path: 'docs/screenshots/shot-avatar-check.png' })
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
