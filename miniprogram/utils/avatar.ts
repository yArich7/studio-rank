import { API_BASE } from '../config'

const fs = wx.getFileSystemManager()

function hash(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 31 + text.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

function exists(path: string): boolean {
  try {
    fs.accessSync(path)
    return true
  } catch (err) {
    return false
  }
}

/**
 * 把接口返回的头像转成 <image> 最稳的形式：
 *   data:  → 写到本地文件，返回 wxfile:// 路径（真机比 base64 可靠）
 *   /xxx   → 拼上 API_BASE
 *   其它   → 原样返回（外链）
 */
export function resolveAvatar(url: string, key: string): string {
  if (!url) return ''

  if (!url.startsWith('data:')) {
    return url.startsWith('/') ? `${API_BASE}${url}` : url
  }

  const version = hash(url)
  const cacheKey = `avatar_${key}_${version}`
  const cached = wx.getStorageSync(cacheKey)
  if (cached && exists(cached)) return cached

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
