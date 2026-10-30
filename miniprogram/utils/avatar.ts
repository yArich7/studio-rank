/**
 * 头像地址统一处理：
 *   cloud://xxx  → 云存储 fileID，<image> 可直接渲染
 *   data:xxx     → 旧数据，写到本地文件后渲染
 *   https://xxx  → 外链原样返回
 */
export function resolveAvatar(url: string, key: string): string {
  if (!url) return ''
  if (!url.startsWith('data:')) return url

  const fs = wx.getFileSystemManager()
  const version = hash(url)
  const cacheKey = `avatar_${key}_${version}`
  const cached = wx.getStorageSync(cacheKey)
  if (cached) {
    try {
      fs.accessSync(cached)
      return cached
    } catch (err) {
      // 文件被清理了，重新写
    }
  }

  const base64 = url.slice(url.indexOf(',') + 1)
  const path = `${wx.env.USER_DATA_PATH}/avatar-${key}-${version}.jpg`
  try {
    fs.writeFileSync(path, base64, 'base64')
    wx.setStorageSync(cacheKey, path)
    return path
  } catch (err) {
    console.error('头像写入本地失败', err)
    return ''
  }
}

function hash(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}
