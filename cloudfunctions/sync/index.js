const cloud = require('wx-server-sdk')
const { fetchProfile, fetchRecentAC } = require('./leetcode')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const CONCURRENCY = 3
const PROFILE_TTL = 24 * 3600 * 1000

const COL = {
  accounts: 'lc_accounts',
  stats: 'daily_stats',
  logs: 'sync_logs'
}

function todayInShanghai() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

function dateOf(seconds) {
  return new Date(seconds * 1000 + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

/** 最近通过按天分组，同一天同一题只算一次 */
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

async function getByDate(openid, date) {
  const res = await db.collection(COL.stats).where({ _openid: openid, date }).limit(1).get()
  return res.data[0] || null
}

async function syncOne(account, today) {
  const profile = await fetchProfile(account.site, account.slug)

  const recent = await fetchRecentAC(account.site, account.slug).catch(() => [])
  const byDay = groupRecentByDay(recent)

  // 1) 历史日期回填（只增不减）
  for (const [day, count] of Object.entries(byDay)) {
    if (day >= today) continue
    const existing = await getByDate(account._openid, day)
    const data = {
      newAc: Math.max(count, existing ? existing.newAc : 0),
      source: 'recent',
      updatedAt: new Date().toISOString()
    }
    if (existing) {
      await db.collection(COL.stats).doc(existing._id).update({ data })
    } else {
      await db.collection(COL.stats).add({
        data: {
          _openid: account._openid,
          date: day,
          totalAc: null,
          easy: 0,
          medium: 0,
          hard: 0,
          ...data
        }
      })
    }
  }

  // 2) 今天：优先精确值，否则累计差分
  const prevRes = await db.collection(COL.stats)
    .where({ _openid: account._openid, date: _.lt(today), totalAc: _.neq(null) })
    .orderBy('date', 'desc')
    .limit(1)
    .get()

  const prev = prevRes.data[0]
  const baseTotal = prev ? prev.totalAc : profile.totalAc
  const diffCount = Math.max(0, profile.totalAc - baseTotal)
  const recentToday = byDay[today] || 0

  const todayRow = await getByDate(account._openid, today)
  const todayData = {
    totalAc: profile.totalAc,
    newAc: Math.max(recentToday, diffCount),
    easy: profile.easy,
    medium: profile.medium,
    hard: profile.hard,
    source: recentToday ? 'recent' : 'diff',
    updatedAt: new Date().toISOString()
  }
  if (todayRow) {
    await db.collection(COL.stats).doc(todayRow._id).update({ data: todayData })
  } else {
    await db.collection(COL.stats).add({
      data: { _openid: account._openid, date: today, ...todayData }
    })
  }

  // 3) 账号资料：24 小时内不重复更新
  const patch = {
    totalAc: profile.totalAc,
    easy: profile.easy,
    medium: profile.medium,
    hard: profile.hard,
    updatedAt: new Date().toISOString()
  }
  const lastProfileAt = account.profileUpdatedAt ? Date.parse(account.profileUpdatedAt) : 0
  if (Date.now() - lastProfileAt > PROFILE_TTL) {
    patch.avatarUrl = profile.avatarUrl
    patch.realName = profile.realName
    patch.ranking = profile.ranking
    patch.profileUpdatedAt = new Date().toISOString()
  }
  await db.collection(COL.accounts).doc(account._id).update({ data: patch })

  return { openid: account._openid, newAc: todayData.newAc, totalAc: profile.totalAc }
}

exports.main = async () => {
  const startedAt = Date.now()
  const today = todayInShanghai()

  const res = await db.collection(COL.accounts).limit(1000).get()
  const accounts = res.data

  if (!accounts.length) {
    return { ok: true, data: { total: 0, success: 0, failed: 0, durationMs: 0 } }
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
        failures.push({ openid: account._openid, slug: account.slug, error: err.message })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, accounts.length) }, worker))

  const summary = {
    at: new Date().toISOString(),
    date: today,
    total: accounts.length,
    success: results.length,
    failed: failures.length,
    failures: failures.slice(0, 20),
    durationMs: Date.now() - startedAt
  }
  await db.collection(COL.logs).add({ data: summary })

  return { ok: true, data: summary }
}
