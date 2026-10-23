// 入口：HTTP 服务 + 静态头像 + 定时同步 + 优雅退出
const http = require('http')
const fs = require('fs')
const path = require('path')

const { config, validate } = require('./config')
const store = require('./store')
const logger = require('./logger')
const routes = require('./routes')
const { schedule } = require('./sync')

validate()
store.load()

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

function serveUpload(pathname, res) {
  const name = decodeURIComponent(pathname.slice('/uploads/'.length))
  if (!/^[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(name)) {
    return routes.json(res, 400, routes.fail('非法文件名'))
  }

  const full = path.join(store.UPLOAD_DIR, name)
  if (!path.resolve(full).startsWith(path.resolve(store.UPLOAD_DIR))) {
    return routes.json(res, 400, routes.fail('非法路径'))
  }

  try {
    const data = fs.readFileSync(full)
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(name).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400'
    })
    res.end(data)
  } catch (err) {
    routes.json(res, 404, routes.fail('文件不存在'))
  }
}

const server = http.createServer(async (req, res) => {
  const startedAt = Date.now()
  const url = new URL(req.url, `http://localhost:${config.port}`)

  res.on('finish', () => {
    const cost = Date.now() - startedAt
    const line = `${req.method} ${url.pathname} ${res.statusCode} ${cost}ms`
    if (res.statusCode >= 500) logger.error(line)
    else if (res.statusCode >= 400) logger.warn(line)
    else logger.info(line)
  })

  try {
    if (url.pathname.startsWith('/uploads/')) {
      return serveUpload(url.pathname, res)
    }
    await routes.handle(req, res, url)
  } catch (err) {
    const status = err.status || 400
    if (status >= 500) logger.error('请求处理失败', { path: url.pathname, error: err.message })
    routes.json(res, status, routes.fail(err.message || '服务异常'))
  }
})

server.listen(config.port, () => {
  logger.info(`服务已启动 http://localhost:${config.port}`, {
    mode: config.devMode ? 'dev' : 'prod',
    dataDir: config.dataDir
  })
  schedule()
})

function shutdown(signal) {
  logger.info(`收到 ${signal}，正在关闭`)
  store.save()
  server.close(() => {
    logger.info('已停止')
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 5000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('unhandledRejection', (err) => {
  logger.error('未处理的 Promise 异常', { error: err && err.message })
})
