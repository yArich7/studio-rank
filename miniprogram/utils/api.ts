import { CLOUD_ENV, USER_KEY, LAST_ERROR_KEY } from '../config'

export class ApiError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

interface CloudResult<T> {
  ok: boolean
  data?: T
  error?: string
  code?: string
}

export function getCachedUser(): IUser | null {
  return wx.getStorageSync(USER_KEY) || null
}

export function setCachedUser(user: IUser): void {
  wx.setStorageSync(USER_KEY, user)
}

export function clearAuth(): void {
  wx.removeStorageSync(USER_KEY)
}

/** 统一调用云函数 api，把 { ok, data } 解包成 data */
export async function callApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await wx.cloud.callFunction({
    name: 'api',
    data: { action, ...payload },
  })
  const body = res.result as CloudResult<T> | undefined
  if (!body || body.ok !== true) {
    throw new ApiError((body && body.error) || '服务异常', body && body.code)
  }
  return body.data as T
}

/** 云函数里直接能取到 openid，不需要 wx.login 换 code */
export async function login(invite?: string): Promise<IUser> {
  const data = await callApi<{ user: IUser }>('login', { invite })
  setCachedUser(data.user)
  return data.user
}

/**
 * 静默登录：有缓存直接用；没有就调一次云函数。
 * 只有新用户（NEED_INVITE）和失败时会打扰用户。
 */
const REFRESH_INTERVAL = 5 * 60 * 1000
let lastRefreshAt = 0

export async function ensureLogin(): Promise<IUser> {
  const cached = getCachedUser()
  if (cached && Date.now() - lastRefreshAt < REFRESH_INTERVAL) return cached

  try {
    const user = await login()
    lastRefreshAt = Date.now()
    return user
  } catch (err) {
    if (err instanceof ApiError && err.code === 'NEED_INVITE') {
      goInvite()
      throw err
    }
    if (cached) return cached

    wx.setStorageSync(LAST_ERROR_KEY, err instanceof Error ? err.message : '登录失败')
    goLogin()
    throw err
  }
}

export async function updateProfile(patch: { nickname?: string; avatarUrl?: string }): Promise<IUser> {
  const data = await callApi<{ user: IUser }>('profile', patch)
  setCachedUser(data.user)
  return data.user
}

/** 头像直接传到云存储，返回 fileID，<image> 可直接渲染 */
export async function uploadAvatar(filePath: string): Promise<string> {
  const ext = (filePath.split('.').pop() || 'jpg').toLowerCase()
  const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const res = await wx.cloud.uploadFile({ cloudPath, filePath })
  return res.fileID
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

export function toastError(err: unknown): void {
  if (err instanceof ApiError && (err.code === 'NEED_INVITE' || err.code === 'NEED_LOGIN')) return
  const message = err instanceof Error ? err.message : String(err)
  wx.showToast({ title: message.slice(0, 30), icon: 'none', duration: 2500 })
}

export { CLOUD_ENV }
