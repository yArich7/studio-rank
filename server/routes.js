// 所有 HTTP 接口：统一返回 { ok, data } 或 { ok:false, error, code }
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const { config } = require('./config')
const store = require('./store')
const auth = require('./auth')
const { fetchProfile, SITES } = require('./leetcode')
const { parseFile } = require('./multipart')
const { runSync, syncOne, todayInShanghai } = require('./sync')
const logger = require('./logger')

const SLUG_RE = /^[A-Za-z0-9_-]{2,40}$/

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  })
  res.end(JSON.stringify(body))
}

const ok = (data) => ({ ok: true, data })
const fail = (error, code) => ({ ok: false, error, code })

function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > limit) req.destroy()
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) } catch (err) { reject(new Error('请求体不是合法 JSON')) }
    })
    req.on('error', reject)
  })
}

function readBuffer(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('文件不能超过 2MB'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/* ---------------- 业务 ---------------- */

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

/**
 * 把 /uploads/xxx.jpg 读成 data URI 内联返回。
 * 真机对 http 图片限制很多（域名、协议），内联后 <image> 直接渲染，不发请求。
 * 超过 64KB 的图退回原 URL，避免响应体过大。
 */
function inlineAvatar(url) {
  if (!url || !url.startsWith('/uploads/')) return url || ''
  const name = url.slice('/uploads/'.length)
  if (!/^[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(name)) return ''
  try {
    const buffer = fs.readFileSync(path.join(store.UPLOAD_DIR, name))
    if (buffer.length > 64 * 1024) return url
    const ext = name.split('.').pop().toLowerCase()
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch (err) {
    return ''
  }
}

function ensureUser(openid) {
  const db = store.db()
  if (!db.users[openid]) {
    db.users[openid] = {
      openid,
      nickname: '刷题同学',
      avatarUrl: '',
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    }
  } else {
    db.users[openid].lastSeenAt = new Date().toISOString()
  }
  return db.users[openid]
}

function checkInvite(code) {
  if (!config.inviteCodes.length) {
    // 开发模式下没配邀请码就放行；生产启动时已强制要求配置
    return config.devMode ? { ok: true } : { ok: false, error: '邀请码未配置' }
  }
  if (!code) return { ok: false, error: '请输入邀请码' }
  if (!config.inviteCodes.includes(code)) return { ok: false, error: '邀请码无效' }

  const used = store.db().invites[code] || 0
  if (used >= config.inviteLimit) return { ok: false, error: '邀请码使用次数已达上限' }
  return { ok: true }
}

async function login(body) {
  const code = String(body.code || '')
  if (!code) throw new Error('缺少 code')

  const openid = await auth.code2Session(code)
  const db = store.db()

  const isNewUser = !db.users[openid]
  if (isNewUser) {
    const invite = String(body.invite || '')
    const checked = checkInvite(invite)
    if (!checked.ok) return fail(checked.error, 'NEED_INVITE')
    if (invite) db.invites[invite] = (db.invites[invite] || 0) + 1
  }

  const user = ensureUser(openid)
  store.save()
  logger.info('登录', { openid, isNewUser })
  return ok({
    token: auth.sign(openid),
    user: { ...user, avatarPath: user.avatarUrl, avatarUrl: inlineAvatar(user.avatarUrl) },
    isNewUser
  })
}

async function updateProfile(openid, body) {
  const db = store.db()
  const user = db.users[openid] || ensureUser(openid)

  if (body.nickname !== undefined) {
    const value = String(body.nickname).trim()
    if (value.length < 1 || value.length > 16) throw new Error('昵称需 1–16 个字符')
    user.nickname = value
  }
  if (body.avatarUrl !== undefined) {
    const value = String(body.avatarUrl)
    // 允许两类：本站上传的相对路径，或外部 https 图片（如力扣头像）
    const isLocalUpload = /^\/uploads\/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(value)
    const isExternal = /^https?:\/\/[^\s]+$/i.test(value)
    if (value && !isLocalUpload && !isExternal) throw new Error('头像地址不合法')
    user.avatarUrl = value
  }

  store.save()
  // 和 /api/login 保持一致：avatarUrl 内联（供显示），avatarPath 给保存用
  return ok({
    user: { ...user, avatarPath: user.avatarUrl, avatarUrl: inlineAvatar(user.avatarUrl) }
  })
}

async function uploadAvatar(openid, req) {
  const contentType = req.headers['content-type'] || ''
  const matched = /boundary=(.+)$/.exec(contentType)
  if (!matched) throw new Error('上传格式不支持')

  const buffer = await readBuffer(req)
  const file = parseFile(buffer, matched[1].trim())
  if (!file) throw new Error('没有收到文件')
  if (!/^image\//.test(file.contentType)) throw new Error('只支持图片')

  const ext = file.contentType.includes('png') ? 'png'
    : file.contentType.includes('webp') ? 'webp'
    : 'jpg'
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`
  fs.writeFileSync(path.join(store.UPLOAD_DIR, name), file.data)

  logger.info('头像上传', { openid, ext, size: file.data.length })
  const mime = file.contentType
  // url 用于存库（换 IP/域名不失效），dataUrl 用于前端立刻预览
  return ok({
    url: `/uploads/${name}`,
    dataUrl: `data:${mime};base64,${file.data.toString('base64')}`
  })
}

async function bindLeetcode(openid, body) {
  const site = String(body.site || 'cn')
  const slug = String(body.slug || '').trim()

  if (!SITES[site]) throw new Error('站点不合法')
  if (!SLUG_RE.test(slug)) throw new Error('用户名不合法')

  const profile = await fetchProfile(site, slug)
  const db = store.db()

  const taken = Object.values(db.accounts).find((acc) => acc.site === site && acc.slug === slug)
  if (taken && taken.openid !== openid) throw new Error('该力扣账号已被其他成员绑定')

  const preview = { ...profile, site, slug }
  if (body.dryRun) return ok(preview)

  const existing = db.accounts[openid]
  db.accounts[openid] = {
    openid,
    site,
    slug,
    ...profile,
    // 首次绑定的时间：周/月榜只能统计这之后的新增
    boundAt: (existing && existing.boundAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  store.save()
  logger.info('绑定力扣', { openid, site, slug, totalAc: profile.totalAc })

  // 绑定后立刻同步一次，把最近通过的日期补进来，用户不用等下一个整点
  try {
    await syncOne(db.accounts[openid], todayInShanghai())
  } catch (err) {
    logger.warn('绑定后首次同步失败', { openid, error: err.message })
  }

  return ok(preview)
}

function rank(openid, period) {
  const db = store.db()
  const start = periodStart(period)

  const scoreByOpenid = {}
  if (period === 'total') {
    for (const acc of Object.values(db.accounts)) scoreByOpenid[acc.openid] = acc.totalAc || 0
  } else {
    for (const row of Object.values(db.stats)) {
      if (row.date >= start) scoreByOpenid[row.openid] = (scoreByOpenid[row.openid] || 0) + (row.newAc || 0)
    }
  }

  const rows = Object.values(db.users)
    .filter((user) => scoreByOpenid[user.openid] !== undefined || db.accounts[user.openid])
    .map((user) => {
      const acc = db.accounts[user.openid]
      return {
        openid: user.openid,
        nickname: user.nickname || '刷题同学',
        avatarUrl: inlineAvatar(user.avatarUrl || (acc && acc.avatarUrl) || ''),
        score: scoreByOpenid[user.openid] || 0,
        totalAc: (acc && acc.totalAc) || 0
      }
    })
    .sort((a, b) => b.score - a.score || b.totalAc - a.totalAc || a.nickname.localeCompare(b.nickname))

  let lastScore = null
  let lastRank = 0
  const list = rows.map((row, index) => {
    const rankNo = lastScore === row.score ? lastRank : index + 1
    lastScore = row.score
    lastRank = rankNo
    return { ...row, rank: rankNo }
  })

  const dates = Object.values(db.stats).map((row) => row.date).sort()
  const mine = list.find((row) => row.openid === openid)
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

function stats(openid) {
  const db = store.db()
  const acc = db.accounts[openid]
  if (!acc) return ok(null)

  const today = todayInShanghai()
  const weekStart = periodStart('week')
  const monthStart = periodStart('month')

  let todayCount = 0
  let weekCount = 0
  let monthCount = 0
  for (const row of Object.values(db.stats)) {
    if (row.openid !== openid || row.date < monthStart) continue
    const value = row.newAc || 0
    if (row.date === today) todayCount += value
    if (row.date >= weekStart) weekCount += value
    monthCount += value
  }

  const easy = acc.easy || 0
  const medium = acc.medium || 0
  const hard = acc.hard || 0
  const sum = easy + medium + hard || 1

  return ok({
    today: todayCount,
    week: weekCount,
    month: monthCount,
    total: acc.totalAc || 0,
    byDifficulty: {
      easy: Math.round((easy / sum) * 100),
      medium: Math.round((medium / sum) * 100),
      hard: Math.round((hard / sum) * 100)
    },
    updatedAt: acc.updatedAt
      ? new Date(acc.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
      : ''
  })
}

/* ---------------- 路由 ---------------- */

async function handle(req, res, url) {
  const pathname = url.pathname

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    })
    return res.end()
  }

  if (pathname === '/api/health') {
    const db = store.db()
    return json(res, 200, ok({
      mode: config.devMode ? 'dev' : 'prod',
      users: Object.keys(db.users).length,
      accounts: Object.keys(db.accounts).length,
      uptime: Math.floor(process.uptime())
    }))
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    return json(res, 200, await login(await readBody(req)))
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const openid = auth.verify(token)
  const needAuth = () => {
    if (!openid) {
      const err = new Error('未登录')
      err.status = 401
      throw err
    }
  }

  if (pathname === '/api/profile' && req.method === 'POST') {
    needAuth()
    return json(res, 200, await updateProfile(openid, await readBody(req)))
  }

  if (pathname === '/api/upload' && req.method === 'POST') {
    needAuth()
    return json(res, 200, await uploadAvatar(openid, req))
  }

  if (pathname === '/api/bind' && req.method === 'POST') {
    needAuth()
    return json(res, 200, await bindLeetcode(openid, await readBody(req)))
  }

  if (pathname === '/api/rank' && req.method === 'GET') {
    needAuth()
    return json(res, 200, rank(openid, url.searchParams.get('period') || 'week'))
  }

  if (pathname === '/api/stats' && req.method === 'GET') {
    needAuth()
    return json(res, 200, stats(openid))
  }

  if (pathname === '/api/sync' && req.method === 'POST') {
    if (!config.adminToken || (req.headers['x-admin-token'] || '') !== config.adminToken) {
      const err = new Error('无权限')
      err.status = 403
      throw err
    }
    return json(res, 200, ok(await runSync('manual')))
  }

  const err = new Error('接口不存在')
  err.status = 404
  throw err
}

module.exports = { handle, json, fail, ok }
