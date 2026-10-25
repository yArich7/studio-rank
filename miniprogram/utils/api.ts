import { API_BASE, TOKEN_KEY, USER_KEY, LAST_ERROR_KEY } from '../config'

interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
  code?: string
}

export class ApiError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

export function getToken(): string {
  return wx.getStorageSync(TOKEN_KEY) || ''
}

export function setToken(token: string): void {
  wx.setStorageSync(TOKEN_KEY, token)
}

export function clearAuth(): void {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_KEY)
}

export function getCachedUser(): IUser | null {
  return wx.getStorageSync(USER_KEY) || null
}

export function setCachedUser(user: IUser): void {
  wx.setStorageSync(USER_KEY, user)
}

export function request<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; data?: Record<string, unknown>; auth?: boolean } = {}
): Promise<T> {
  const { method = 'GET', data, auth = true } = options
  return new Promise<T>((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method,
      data,
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      success(res) {
        const body = res.data as ApiResponse<T>
        if (res.statusCode === 401) {
          clearAuth()
          goLogin()
          reject(new ApiError('登录已失效，请重新登录', 'NEED_LOGIN'))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && body && body.ok) {
          resolve(body.data as T)
        } else {
          reject(new ApiError((body && body.error) || `请求失败（${res.statusCode}）`, body && body.code))
        }
      },
      fail() {
        reject(new Error('连不上服务，请确认后端已启动'))
      },
    })
  })
}

function wxLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res.code) resolve(res.code)
        else reject(new Error('微信登录失败'))
      },
      fail() {
        reject(new Error('微信登录失败'))
      },
    })
  })
}

export async function login(invite?: string): Promise<IUser> {
  const code = await wxLoginCode()
  const data = await request<{ token: string; user: IUser }>('/api/login', {
    method: 'POST',
    data: { code, invite },
    auth: false,
  })
  setToken(data.token)
  setCachedUser(data.user)
  return data.user
}

/**
 * 静默登录：有缓存直接用；没有就悄悄 wx.login，用户无感知。
 * 只有两种情况会打扰用户：
 *   1. 新用户 → 邀请码页
 *   2. 静默失败（网络/配置问题）→ 登录页兜底，可手动重试
 */
export async function ensureLogin(): Promise<IUser> {
  const cached = getCachedUser()
  if (getToken() && cached) return cached

  try {
    return await login()
  } catch (err) {
    if (err instanceof ApiError && err.code === 'NEED_INVITE') {
      goInvite()
    } else {
      // 记录失败原因，登录页会显示出来，避免用户一脸茫然
      wx.setStorageSync(LAST_ERROR_KEY, err instanceof Error ? err.message : '登录失败')
      goLogin()
    }
    throw err
  }
}

let navigatedAt = 0

function navigateOnce(url: string): void {
  if (Date.now() - navigatedAt < 2000) return
  navigatedAt = Date.now()
  const pages = getCurrentPages()
  const current = pages.length ? `/${pages[pages.length - 1].route}` : ''
  if (current === url) return
  wx.navigateTo({ url })
}

export function goLogin(): void {
  navigateOnce('/pages/login/index')
}

export function goInvite(): void {
  navigateOnce('/pages/invite/index')
}

export async function refreshUser(): Promise<IUser> {
  return login()
}

export function uploadAvatar(filePath: string): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${API_BASE}/api/upload`,
      filePath,
      name: 'file',
      header: { Authorization: `Bearer ${getToken()}` },
      success(res) {
        try {
          const body = JSON.parse(res.data) as ApiResponse<{ url: string }>
          if (body.ok) resolve(body.data as { url: string })
          else reject(new ApiError(body.error || '上传失败', body.code))
        } catch (err) {
          reject(new ApiError('上传返回异常'))
        }
      },
      fail() {
        reject(new ApiError('头像上传失败'))
      },
    })
  })
}

export async function updateProfile(patch: { nickname?: string; avatarUrl?: string }): Promise<IUser> {
  const data = await request<{ user: IUser }>('/api/profile', { method: 'POST', data: patch })
  setCachedUser(data.user)
  return data.user
}

export function toastError(err: unknown): void {
  // 邀请码页面自己会提示，这里不重复弹
  if (err instanceof ApiError && (err.code === 'NEED_INVITE' || err.code === 'NEED_LOGIN')) return
  const message = err instanceof Error ? err.message : String(err)
  wx.showToast({ title: message.slice(0, 30), icon: 'none', duration: 2500 })
}
