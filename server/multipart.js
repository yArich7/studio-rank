// 极简 multipart/form-data 解析：只支持单文件上传，够用即可
function parseFile(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`)
  let start = buffer.indexOf(delimiter)
  if (start < 0) return null
  start += delimiter.length

  for (;;) {
    if (buffer.slice(start, start + 2).toString() === '--') return null // 结束
    if (buffer.slice(start, start + 2).toString() === '\r\n') start += 2

    const headerEnd = buffer.indexOf('\r\n\r\n', start)
    if (headerEnd < 0) return null
    const headers = buffer.slice(start, headerEnd).toString('utf8')

    const next = buffer.indexOf(delimiter, headerEnd + 4)
    if (next < 0) return null

    // 去掉结尾的 \r\n
    let end = next
    if (buffer[end - 2] === 13 && buffer[end - 1] === 10) end -= 2

    const nameMatch = /name="([^"]+)"/.exec(headers)
    const typeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headers)
    if (nameMatch) {
      return {
        field: nameMatch[1],
        contentType: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
        data: buffer.slice(headerEnd + 4, end)
      }
    }
    start = next + delimiter.length
  }
}

module.exports = { parseFile }
