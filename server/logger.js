// 极简结构化日志：带时间戳、级别、上下文字段
function stamp() {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}

function write(level, message, extra) {
  const parts = [`[${stamp()}]`, level.toUpperCase().padEnd(5), message]
  if (extra && Object.keys(extra).length) {
    parts.push(JSON.stringify(extra))
  }
  const line = parts.join(' ')
  if (level === 'error') console.error(line)
  else console.log(line)
}

module.exports = {
  info: (message, extra) => write('info', message, extra),
  warn: (message, extra) => write('warn', message, extra),
  error: (message, extra) => write('error', message, extra)
}
