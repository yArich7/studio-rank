const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9470,
    timeout: 120000,
  })
  await wait(4500)

  for (const [path, label] of [
    ['/pages/rank/index', '榜单'],
    ['/pages/stats/index', '数据'],
    ['/pages/mine/index', '我的'],
    ['/pages/bind/index', '绑定'],
  ]) {
    const page = await mp.reLaunch(path)
    await wait(2500)
    console.log(`✓ ${label} -> ${(await mp.currentPage()).path}`)
  }

  const mine = await mp.reLaunch('/pages/mine/index')
  await wait(3000)
  console.log('版本 =', await mine.data('build'), '| 头像错误 =', await mine.data('avatarError'))
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
