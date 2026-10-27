const { cloud, db, _, COL, first, all, upsert } = require('./db')
const { fetchProfile, SITES } = require('./leetcode')

const SLUG_RE = /^[A-Za-z0-9_-]{2,40}$/

const ok = (data) => ({ ok: true, data })
const fail = (error, code) => ({ ok: false, error, code })

/* ---------------- 工具 ---------------- */

function todayInShanghai() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

function periodStart(period) {
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const d = now.getUTCDate()
  const iso = (yy, mm, dd) => new Date(Date.UTC(yy, mm, dd)).toISOString().slice(0, 10)

  if (period === 'day') return iso(y, m, d)
  if (period === 'month') return iso(y, m, 1)
  if (period === 'week') {
    const weekday = now.getUTCDay() || 7
    return iso(y, m, d - weekday + 1)
  }
  return '1970-01-01'
}

/* ---------------- 业务 ---------------- */

let backendReady = false

/** 首次调用时自动建集合，并确保至少有一个邀请码可用 */
async function ensureBackend() {
  if (backendReady) return
  for (const name of Object.values(COL)) {
    try {
      await db.createCollection(name)
    } catch (err) {
      // 已存在
    }
  }
  const invites = await all(COL.invites)
  if (!invites.length) {
    await db.collection(COL.invites).add({
      data: { code: 'STUDIO2026', used: 0, limit: 50, createdAt: new Date().toISOString() }
    })
  }
  backendReady = true
}

async function ensureUser(openid) {
  const found = await first(COL.users, { _openid: openid })
  const now = new Date().toISOString()
  if (found) {
    await db.collection(COL.users).doc(found._id).update({ data: { lastSeenAt: now } })
    return { ...found, lastSeenAt: now }
  }
  const user = {
    _openid: openid,
    nickname: '刷题同学',
    avatarUrl: '',
    createdAt: now,
    lastSeenAt: now
  }
  const res = await db.collection(COL.users).add({ data: user })
  return { _id: res._id, ...user }
}

async function checkInvite(code) {
  const rows = await all(COL.invites)
  if (!rows.length) return { ok: false, error: '邀请码未配置，请联系管理员' }
  if (!code) return { ok: false, error: '请输入邀请码' }

  const row = rows.find((item) => item.code === code)
  if (!row) return { ok: false, error: '邀请码无效' }
  if ((row.used || 0) >= (row.limit || 50)) return { ok: false, error: '邀请码使用次数已达上限' }
  return { ok: true }
}

async function useInvite(code) {
  if (!code) return
  const row = await first(COL.invites, { code })
  if (row) await db.collection(COL.invites).doc(row._id).update({ data: { used: _.inc(1) } })
  else await db.collection(COL.invites).add({ data: { code, used: 1 } })
}

async function doLogin(openid, event) {
  const existing = await first(COL.users, { _openid: openid })

  if (!existing) {
    const invite = String(event.invite || '')
    const checked = await checkInvite(invite)
    if (!checked.ok) return fail(checked.error, 'NEED_INVITE')
    if (invite) await useInvite(invite)
  }

  const user = await ensureUser(openid)
  return ok({ user, isNewUser: !existing })
}

async function doProfile(openid, event) {
  const user = await ensureUser(openid)
  const patch = {}

  if (event.nickname !== undefined) {
    const value = String(event.nickname).trim()
    if (value.length < 1 || value.length > 16) throw new Error('昵称需 1–16 个字符')
    patch.nickname = value
  }
  if (event.avatarUrl !== undefined) {
    const value = String(event.avatarUrl)
    // 允许云存储 fileID（cloud://...）或 https 外链
    if (value && !/^cloud:\/\//.test(value) && !/^https?:\/\//.test(value)) {
      throw new Error('头像地址不合法')
    }
    patch.avatarUrl = value
  }

  if (Object.keys(patch).length) {
    await db.collection(COL.users).doc(user._id).update({ data: patch })
  }
  return ok({ user: { ...user, ...patch } })
}

async function doBind(openid, event) {
  const site = String(event.site || 'cn')
  const slug = String(event.slug || '').trim()

  if (!SITES[site]) throw new Error('站点不合法')
  if (!SLUG_RE.test(slug)) throw new Error('用户名不合法')

  const profile = await fetchProfile(site, slug)
  const taken = await first(COL.accounts, { site, slug })
  if (taken && taken._openid !== openid) throw new Error('该力扣账号已被其他成员绑定')

  const preview = { ...profile, site, slug }
  if (event.dryRun) return ok(preview)

  const now = new Date().toISOString()
  const existing = await first(COL.accounts, { _openid: openid })
  const data = {
    _openid: openid,
    site,
    slug,
    ...profile,
    boundAt: (existing && existing.boundAt) || now,
    profileUpdatedAt: now,
    updatedAt: now
  }

  if (existing) await db.collection(COL.accounts).doc(existing._id).update({ data })
  else await db.collection(COL.accounts).add({ data })

  return ok(preview)
}

async function doRank(openid, period) {
  const start = periodStart(period)
  const [users, accounts, stats] = await Promise.all([
    all(COL.users),
    all(COL.accounts),
    start === '1970-01-01' ? Promise.resolve([]) : all(COL.stats, { date: _.gte(start) })
  ])

  const scoreByOpenid = {}
  if (period === 'total') {
    for (const acc of accounts) scoreByOpenid[acc._openid] = acc.totalAc || 0
  } else {
    for (const row of stats) {
      scoreByOpenid[row._openid] = (scoreByOpenid[row._openid] || 0) + (row.newAc || 0)
    }
  }

  const accountByOpenid = {}
  for (const acc of accounts) accountByOpenid[acc._openid] = acc

  const rows = users
    .filter((u) => scoreByOpenid[u._openid] !== undefined || accountByOpenid[u._openid])
    .map((u) => ({
      openid: u._openid,
      nickname: u.nickname || '刷题同学',
      avatarUrl: u.avatarUrl || (accountByOpenid[u._openid] || {}).avatarUrl || '',
      score: scoreByOpenid[u._openid] || 0,
      totalAc: (accountByOpenid[u._openid] || {}).totalAc || 0
    }))
    .sort((a, b) => b.score - a.score || b.totalAc - a.totalAc || a.nickname.localeCompare(b.nickname))

  let lastScore = null
  let lastRank = 0
  const list = rows.map((row, index) => {
    const rankNo = lastScore === row.score ? lastRank : index + 1
    lastScore = row.score
    lastRank = rankNo
    return { ...row, rank: rankNo }
  })

  const mine = list.find((row) => row.openid === openid)
  const dates = stats.map((row) => row.date).sort()

  return ok({
    period,
    startDate: start,
    statsSince: dates[0] || null,
    list,
    myRank: mine ? { rank: mine.rank, score: mine.score, totalAc: mine.totalAc } : null,
    memberCount: list.length,
    updatedAt: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
  })
}

async function doStats(openid) {
  const acc = await first(COL.accounts, { _openid: openid })
  if (!acc) return ok(null)

  const today = todayInShanghai()
  const weekStart = periodStart('week')
  const monthStart = periodStart('month')

  const rows = await all(COL.stats, { _openid: openid, date: _.gte(monthStart) })

  let todayCount = 0
  let weekCount = 0
  let monthCount = 0
  for (const row of rows) {
    const value = row.newAc || 0
    if (row.date === today) todayCount += value
    if (row.date >= weekStart) weekCount += value
    monthCount += value
  }

  const site = acc.site === 'com' ? 'leetcode.com' : 'leetcode.cn'
  return ok({
    today: todayCount,
    week: weekCount,
    month: monthCount,
    total: acc.totalAc || 0,
    profile: {
      name: acc.realName || acc.slug,
      slug: acc.slug,
      avatarUrl: acc.avatarUrl || '',
      url: `https://${site}/u/${acc.slug}/`
    },
    byDifficulty: { easy: acc.easy || 0, medium: acc.medium || 0, hard: acc.hard || 0 },
    updatedAt: acc.updatedAt
      ? new Date(acc.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
      : ''
  })
}

async function doSetup() {
  const names = [COL.users, COL.accounts, COL.stats, COL.logs, COL.invites]
  const created = []
  const existed = []
  for (const name of names) {
    try {
      await db.createCollection(name)
      created.push(name)
    } catch (err) {
      existed.push(name)
    }
  }
  return ok({ created, existed })
}

/* ---------------- 入口 ---------------- */

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  try {
    await ensureBackend()
    switch (event.action) {
      case 'login': return await doLogin(OPENID, event)
      case 'profile': return await doProfile(OPENID, event)
      case 'bind': return await doBind(OPENID, event)
      case 'rank': return await doRank(OPENID, event.period || 'week')
      case 'stats': return await doStats(OPENID)
      case 'setup': return await doSetup()
      default: return fail('未知操作')
    }
  } catch (err) {
    return fail(err.message || '服务异常')
  }
}
