// 配置集中在这里：优先读环境变量，其次读同目录 .env
const fs = require('fs')
const path = require('path')

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue
    const matched = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (!matched) continue
    const key = matched[1]
    const value = matched[2].replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) process.env[key] = value
  }
}

const root = __dirname
loadEnvFile(path.join(root, '.env'))

function parseInvites(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const devMode = process.env.DEV_MODE === '1'

const config = {
  root,
  port: Number(process.env.PORT || 3000),
  // 生产环境建议 127.0.0.1，只让本机 Nginx 转发，不直接暴露端口
  host: process.env.HOST || '0.0.0.0',
  devMode,

  appid: process.env.APPID || '',
  appsecret: process.env.APPSECRET || '',

  // 不配置时：开发模式用固定值，生产模式直接拒绝启动
  authSecret: process.env.AUTH_SECRET || (devMode ? 'dev-only-secret' : ''),
  adminToken: process.env.ADMIN_TOKEN || '',

  inviteCodes: parseInvites(process.env.INVITE_CODES),
  inviteLimit: Number(process.env.INVITE_LIMIT || 50),

  dataDir: process.env.DATA_DIR || path.join(root, 'data'),
  syncMinute: Number(process.env.SYNC_MINUTE || 5),

  // 单用户每小时最多几次同步（含手动）
  syncPerHour: Number(process.env.SYNC_PER_HOUR || 2)
}

function validate() {
  const problems = []
  if (!config.authSecret) problems.push('缺少 AUTH_SECRET（用于签发登录态）')
  if (!config.devMode && !config.appid) problems.push('缺少 APPID')
  if (!config.devMode && !config.appsecret) problems.push('缺少 APPSECRET')
  if (!config.devMode && !config.inviteCodes.length) problems.push('缺少 INVITE_CODES（生产环境必须配置，否则任何人都能注册）')
  if (!config.devMode && !config.adminToken) problems.push('缺少 ADMIN_TOKEN（手动同步接口会被禁用）')

  if (problems.length) {
    console.error('\n[config] 启动失败，请补齐以下配置：')
    for (const item of problems) console.error(`  - ${item}`)
    console.error('\n可以复制 .env.example 为 .env 后填写。\n')
    process.exit(1)
  }

  if (config.devMode) {
    console.warn('[config] 开发模式：跳过微信登录校验，邀请码缺失时放行')
  }
  return config
}

module.exports = { config, validate }
