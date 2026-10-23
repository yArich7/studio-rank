// 单文件 JSON 存储：原子写入 + 每日备份 + 启动自愈
const fs = require('fs')
const path = require('path')
const { config } = require('./config')

const FILE = path.join(config.dataDir, 'db.json')
const BACKUP_DIR = path.join(config.dataDir, 'backups')
const UPLOAD_DIR = path.join(config.dataDir, 'uploads')

const EMPTY = () => ({ users: {}, accounts: {}, stats: {}, logs: [], invites: {}, meta: {} })

let data = EMPTY()
let lastBackupDate = ''

function normalize(raw) {
  const base = EMPTY()
  if (!raw || typeof raw !== 'object') return base
  return {
    ...base,
    ...raw,
    users: raw.users || {},
    accounts: raw.accounts || {},
    stats: raw.stats || {},
    invites: raw.invites || {},
    logs: Array.isArray(raw.logs) ? raw.logs : []
  }
}

function load() {
  fs.mkdirSync(config.dataDir, { recursive: true })
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })

  if (!fs.existsSync(FILE)) {
    data = EMPTY()
    data.meta.createdAt = new Date().toISOString()
    save()
    return data
  }

  try {
    data = normalize(JSON.parse(fs.readFileSync(FILE, 'utf8')))
  } catch (err) {
    // 文件损坏时用最近的备份兜底，避免直接丢数据
    const latest = latestBackup()
    if (latest) {
      console.warn(`[store] db.json 解析失败，使用备份 ${path.basename(latest)}`)
      data = normalize(JSON.parse(fs.readFileSync(latest, 'utf8')))
    } else {
      console.warn('[store] db.json 解析失败且没有备份，从空数据启动')
      data = EMPTY()
    }
  }
  return data
}

function latestBackup() {
  if (!fs.existsSync(BACKUP_DIR)) return null
  const files = fs.readdirSync(BACKUP_DIR).filter((name) => name.endsWith('.json')).sort()
  return files.length ? path.join(BACKUP_DIR, files[files.length - 1]) : null
}

function backupIfNeeded() {
  const today = new Date().toISOString().slice(0, 10)
  if (lastBackupDate === today) return
  lastBackupDate = today
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    fs.copyFileSync(FILE, path.join(BACKUP_DIR, `db-${today}.json`))
    // 只保留最近 7 份
    const files = fs.readdirSync(BACKUP_DIR).filter((name) => name.endsWith('.json')).sort()
    for (const name of files.slice(0, Math.max(0, files.length - 7))) {
      fs.unlinkSync(path.join(BACKUP_DIR, name))
    }
  } catch (err) {
    console.warn('[store] 备份失败', err.message)
  }
}

function save() {
  fs.mkdirSync(config.dataDir, { recursive: true })
  if (fs.existsSync(FILE)) backupIfNeeded()

  const tmp = `${FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, FILE) // rename 是原子操作，避免写一半断电
}

function db() {
  return data
}

function statsKey(openid, date) {
  return `${openid}|${date}`
}

module.exports = {
  load,
  save,
  db,
  statsKey,
  FILE,
  UPLOAD_DIR,
  BACKUP_DIR
}
