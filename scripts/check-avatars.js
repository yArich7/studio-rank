const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9600,
    timeout: 120000,
  })
  await wait(6000)

  const rank = await mp.evaluate(async () => {
    const r = await wx.cloud.callFunction({ name: 'api', data: { action: 'rank', period: 'total' } })
    return r.result
  })
  for (const row of rank.data.list) {
    console.log(`${row.nickname} | score=${row.score} | avatar=${String(row.avatarUrl).slice(0, 70)}`)
  }

  // 云存储能否跨用户读取
  const fileInfo = await mp.evaluate(async () => {
    try {
      const res = await wx.cloud.getTempFileURL({ fileList: [] })
      return { ok: true, count: res.fileList.length }
    } catch (err) {
      return { ok: false, msg: err.errMsg }
    }
  })
  console.log('存储接口 =', JSON.stringify(fileInfo))
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
