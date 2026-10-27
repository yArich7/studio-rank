import { callApi, toastError, ensureLogin } from '../../utils/api'
import { resolveAvatar } from '../../utils/avatar'

// 缓存 60 秒内不重复请求：切 tab 时先渲染缓存，后台再刷新
const CACHE_FRESH = 60 * 1000

Page({
  data: {
    periods: [
      { key: 'day', label: '日榜' },
      { key: 'week', label: '周榜' },
      { key: 'month', label: '月榜' },
      { key: 'total', label: '总榜' },
    ],
    period: 'total',
    list: [] as RankRow[],
    myRank: null as { rank: number; score: number; totalAc: number } | null,
    memberCount: 0,
    updatedAt: '',
    statsSince: '',
    loading: true,
  },

  onShow() {
    this.applyCache()
  },

  async onPullDownRefresh() {
    await this.load(true)
    wx.stopPullDownRefresh()
  },

  switchPeriod(e: WechatMiniprogram.TouchEvent) {
    const period = String(e.currentTarget.dataset.period || 'week')
    if (period === this.data.period) return
    this.setData({ period })
    this.applyCache()
  },

  cacheKey(): string {
    return `rank_cache_${this.data.period}`
  },

  /** 有缓存先渲染，避免切 tab 白屏 */
  applyCache() {
    const cached = wx.getStorageSync(this.cacheKey())
    if (!cached) {
      void this.load()
      return
    }
    this.setData({ ...cached.data, loading: false })
    if (Date.now() - cached.at >= CACHE_FRESH) void this.load(true)
  },

  async load(silent = false) {
    const key = this.cacheKey()
    if (!silent) this.setData({ loading: true })
    try {
      await ensureLogin()
      const res = await callApi<RankResult>('rank', { period: this.data.period })
      const data = {
        list: res.list.map((row) => ({ ...row, avatarUrl: resolveAvatar(row.avatarUrl, row.openid) })),
        myRank: res.myRank,
        memberCount: res.memberCount,
        updatedAt: res.updatedAt,
        statsSince: res.statsSince || '',
        loading: false,
      }
      this.setData(data)
      wx.setStorageSync(key, { data, at: Date.now() })
    } catch (err) {
      this.setData({ loading: false })
      if (!silent) toastError(err)
    }
  },

  goBind() {
    wx.navigateTo({ url: '/pages/bind/index' })
  },
})
