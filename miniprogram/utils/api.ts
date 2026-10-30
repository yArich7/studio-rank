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

/** 把云函数返回的原始错误翻译成能看懂的话 */
function describeCloudError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const msg = (err as { errMsg?: string })?.errMsg || raw

  if (/env.*(not exist|invalid)|环境不存在|invalid env/i.test(msg)) return '云环境不存在，检查 config.local.ts 的 CLOUD_ENV'
  if (/FunctionName|function.*not.*found|云函数不存在/i.test(msg)) return '云函数未部署，请在开发者工具重新上传 api'
  if (/timeout|timed out|超时/i.test(msg)) return '请求超时，请重试'
  if (/network|发送失败|ERR_INTERNET/i.test(msg)) return '网络异常，请检查手机网络'
  if (/-504002|functions execute fail/i.test(msg)) return '云函数执行失败，请查看云函数日志'
  return msg.slice(0, 80)
}

/** 网络抖动（发送失败 / 超时）时重试一次，云函数冷启动也常被兜住 */
function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /fail|timeout|超时|发送失败|network/i.test(msg)
}

async function callOnce<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  let res: { result: unknown }
  try {
    res = await wx.cloud.callFunction({
      name: 'api',
      data: { action, ...payload },
    })
  } catch (err) {
    console.error('[cloud] 调用失败', action, err)
    throw new ApiError(describeCloudError(err), 'CLOUD_ERROR')
  }
  const body = res.result as CloudResult<T> | undefined
  if (!body || body.ok !== true) {
    throw new ApiError((body && body.error) || '服务异常', body && body.code)
  }
  return body.data as T
}

/** 统一调用云函数 api，把 { ok, data } 解包成 data */
export async function callApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  try {
    return await callOnce<T>(action, payload)
  } catch (err) {
    // 业务错误（邀请码、参数校验）不重试，只重试网络层失败
    if (err instanceof ApiError && err.code) throw err
    if (!isNetworkError(err)) throw err

    await new Promise((resolve) => setTimeout(resolve, 400))
    return callOnce<T>(action, payload)
  }
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
    if (cached) return cached

    wx.setStorageSync(LAST_ERROR_KEY, err instanceof Error ? err.message : '登录失败')
    goLogin()
    throw err
  }
}

/** 清掉榜单/数据页缓存，绑定或资料变更后调用，避免看到旧数据 */
export function clearPageCaches(): void {
  wx.removeStorageSync('stats_cache')
  for (const period of ['day', 'week', 'month', 'total']) {
    wx.removeStorageSync(`rank_cache_${period}`)
  }
  try {
    const info = wx.getStorageInfoSync()
    for (const key of info.keys) {
      if (key.startsWith('avatar_')) wx.removeStorageSync(key)
    }
  } catch (err) {
    console.error('清理头像缓存失败', err)
  }
}

/** 退出：清掉云端绑定与统计，再清掉本地所有相关缓存 */
export async function logout(): Promise<void> {
  await callApi('logout')
  clearAuth()
  lastRefreshAt = 0
  clearPageCaches()
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

export function toastError(err: unknown): void {
  if (err instanceof ApiError && (err.code === 'NEED_INVITE' || err.code === 'NEED_LOGIN')) return
  const message = err instanceof Error ? err.message : String(err)
  wx.showToast({ title: message.slice(0, 30), icon: 'none', duration: 2500 })
}

export { CLOUD_ENV }
