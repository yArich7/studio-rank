const automator = require('miniprogram-automator')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
  const page = await mp.reLaunch('/pages/rank/index')
  await wait(3000)

  for (const sel of ['.empty', '.empty-title', '.btn-primary']) {
    const el = await page.$(sel)
    if (!el) { console.log(sel, '-> not found'); continue }
    const out = {}
    for (const fn of ['size', 'offset']) {
      try { out[fn] = await el[fn]() } catch (e) { out[fn] = 'n/a' }
    }
    try { out.width = await el.style('width') } catch (e) { out.width = 'n/a' }
    try { out.display = await el.style('display') } catch (e) { out.display = 'n/a' }
    console.log(sel, JSON.stringify(out))
  }
  await mp.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
