// 登录态：openid.HMAC-SHA256 签名，不落库、不依赖 session 表
const crypto = require('crypto')
const https = require('https')
const { config } = require('./config')

function sign(openid) {
  const mac = crypto.createHmac('sha256', config.authSecret).update(openid).digest('hex').slice(0, 32)
  return `${openid}.${mac}`
}

function verify(token) {
  if (!token || typeof token !== 'string') return null
  const index = token.lastIndexOf('.')
  if (index <= 0) return null

  const openid = token.slice(0, index)
  const expected = sign(openid)
  if (token.length !== expected.length) return null
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected)) ? openid : null
  } catch (err) {
    return null
  }
}

function code2Session(code) {
  if (config.devMode) {
    // 本地联调：模拟器每次 wx.login 都会拿到新 code，固定成一个身份
    return Promise.resolve(code.startsWith('dev:') ? `dev_${code.slice(4)}` : 'dev_local')
  }
  if (!config.appid || !config.appsecret) {
    return Promise.reject(new Error('服务端未配置 APPID / APPSECRET'))
  }

  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${config.appid}`
    + `&secret=${config.appsecret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`

  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 6000 }, (res) => {
      let raw = ''
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw)
          if (parsed.openid) return resolve(parsed.openid)
          reject(new Error(`微信登录失败：${parsed.errmsg || '未知错误'}`))
        } catch (err) {
          reject(new Error('微信登录返回异常'))
        }
      })
    })
    req.on('timeout', () => req.destroy(new Error('微信登录超时')))
    req.on('error', reject)
  })
}

module.exports = { sign, verify, code2Session }
