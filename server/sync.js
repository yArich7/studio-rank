// 每小时同步：抓公开主页 → 与上次快照差分 → 写当日统计
const { config } = require('./config')
const store = require('./store')
const { fetchProfile, fetchRecentAC } = require('./leetcode')
const logger = require('./logger')

const CONCURRENCY = 3

function todayInShanghai() {
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  return now.toISOString().slice(0, 10)
}

const TZ_OFFSET = 8 * 3600 * 1000

function dateOf(seconds) {
  return new Date(seconds * 1000 + TZ_OFFSET).toISOString().slice(0, 10)
}

/** 把"最近通过"按天分组，同一天同一题只算一次 */
function groupRecentByDay(recent) {
  const byDay = {}
  for (const item of recent) {
    if (!item.submitTime || !item.slug) continue
    const day = dateOf(item.submitTime)
    if (!byDay[day]) byDay[day] = new Set()
    byDay[day].add(item.slug)
  }
  const result = {}
  for (const day of Object.keys(byDay)) result[day] = byDay[day].size
  return result
}

async function syncOne(account, today) {
  const db = store.db()
  const profile = await fetchProfile(account.site, account.slug)

  // 最近通过列表带提交时间，可以把历史几天补回来（力扣只给最近约 20 条）
  const recent = await fetchRecentAC(account.site, account.slug).catch(() => [])
  const byDay = groupRecentByDay(recent)

  // 1) 历史日期：用精确数据回填，只增不减
  for (const [day, count] of Object.entries(byDay)) {
    if (day >= today) continue
    const key = store.statsKey(account.openid, day)
    const existing = db.stats[key]
    db.stats[key] = {
      openid: account.openid,
      date: day,
      totalAc: existing ? existing.totalAc : null,
      newAc: Math.max(count, existing ? existing.newAc : 0),
      source: 'recent',
      updatedAt: new Date().toISOString()
    }
  }

  // 2) 今天：优先用最近通过的精确数，否则用累计差分
  const previous = Object.values(db.stats)
    .filter((row) => row.openid === account.openid && row.date < today && typeof row.totalAc === 'number')
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0]

  const baseTotal = previous ? previous.totalAc : profile.totalAc
  const diffCount = Math.max(0, profile.totalAc - baseTotal)
  const recentToday = byDay[today] || 0

  db.stats[store.statsKey(account.openid, today)] = {
    openid: account.openid,
    date: today,
    totalAc: profile.totalAc,
    newAc: Math.max(recentToday, diffCount),
    easy: profile.easy,
    medium: profile.medium,
    hard: profile.hard,
    source: recentToday ? 'recent' : 'diff',
    updatedAt: new Date().toISOString()
  }

  Object.assign(db.accounts[account.openid], {
    totalAc: profile.totalAc,
    easy: profile.easy,
    medium: profile.medium,
    hard: profile.hard,
    avatarUrl: profile.avatarUrl,
    realName: profile.realName,
    ranking: profile.ranking,
    updatedAt: new Date().toISOString()
  })

  store.save()
  const todayRow = db.stats[store.statsKey(account.openid, today)]
  return { openid: account.openid, newAc: todayRow.newAc, totalAc: profile.totalAc, backfilled: Object.keys(byDay).length }
}

let running = false

async function runSync(trigger = 'cron') {
  if (running) {
    logger.warn('同步已在进行，跳过本次触发', { trigger })
    return { skipped: true }
  }
  running = true

  const startedAt = Date.now()
  const today = todayInShanghai()
  const accounts = Object.values(store.db().accounts)

  if (!accounts.length) {
    running = false
    logger.info('没有需要同步的账号')
    return { total: 0, success: 0, failed: 0, durationMs: 0 }
  }

  const results = []
  const failures = []
  let cursor = 0

  async function worker() {
    for (;;) {
      const index = cursor++
      if (index >= accounts.length) return
      const account = accounts[index]
      try {
        results.push(await syncOne(account, today))
      } catch (err) {
        failures.push({ openid: account.openid, slug: account.slug, error: err.message })
        logger.warn('单个账号同步失败', { slug: account.slug, error: err.message })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, accounts.length) }, worker))

  const summary = {
    trigger,
    date: today,
    total: accounts.length,
    success: results.length,
    failed: failures.length,
    durationMs: Date.now() - startedAt
  }

  const db = store.db()
  db.logs.unshift({ ...summary, at: new Date().toISOString(), failures: failures.slice(0, 20) })
  db.logs = db.logs.slice(0, 200)
  store.save()

  running = false
  logger.info('同步完成', summary)
  return summary
}

function schedule() {
  let lastHour = ''
  const timer = setInterval(() => {
    const now = new Date(Date.now() + 8 * 3600 * 1000)
    if (now.getUTCMinutes() !== config.syncMinute) return
    const hourKey = now.toISOString().slice(0, 13)
    if (hourKey === lastHour) return
    lastHour = hourKey
    runSync('cron').catch((err) => logger.error('定时同步异常', { error: err.message }))
  }, 30 * 1000)

  if (timer.unref) timer.unref()
  logger.info(`定时同步已启动：每小时第 ${config.syncMinute} 分钟`)
  return timer
}

module.exports = { runSync, schedule, syncOne, todayInShanghai }
