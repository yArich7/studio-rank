const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/Users/yarich/Documents/codeproject',
    port: 9610,
    timeout: 120000,
  })
  await wait(6000)

  const result = await mp.evaluate(async () => {
    const rank = await wx.cloud.callFunction({ name: 'api', data: { action: 'rank', period: 'total' } })
    const row = rank.result.data.list[0]
    const fileID = row.avatarUrl
    try {
      const res = await wx.cloud.getTempFileURL({ fileList: [fileID] })
      const item = res.fileList[0]
      return { fileID: fileID.slice(0, 60), status: item.status, errMsg: item.errMsg, url: String(item.tempFileURL).slice(0, 80) }
    } catch (err) {
      return { fileID: String(fileID).slice(0, 60), error: err.errMsg || String(err) }
    }
  })
  console.log(JSON.stringify(result, null, 1))
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
