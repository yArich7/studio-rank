import { callApi, toastError, ensureLogin } from '../../utils/api'

const CACHE_KEY = 'stats_cache'
const CACHE_FRESH = 60 * 1000

Page({
  data: {
    stats: null as StatsResult | null,
    bars: { easy: 0, medium: 0, hard: 0 },
    loading: true,
  },

  onShow() {
    this.applyCache()
  },

  async onPullDownRefresh() {
    await this.load(true)
    wx.stopPullDownRefresh()
  },

  applyCache() {
    const cached = wx.getStorageSync(CACHE_KEY)
    if (!cached) {
      void this.load()
      return
    }
    this.setData({ ...cached.data, loading: false })
    if (Date.now() - cached.at >= CACHE_FRESH) void this.load(true)
  },

  async load(silent = false) {
    if (!silent) this.setData({ loading: true })
    try {
      await ensureLogin()
      const stats = await callApi<StatsResult>('stats')

      // 难度分布：显示数量，条形宽度按三档里的最大值等比缩放
      let bars = { easy: 0, medium: 0, hard: 0 }
      if (stats && stats.byDifficulty) {
        const { easy, medium, hard } = stats.byDifficulty
        const max = Math.max(easy, medium, hard, 1)
        bars = {
          easy: Math.round((easy / max) * 100),
          medium: Math.round((medium / max) * 100),
          hard: Math.round((hard / max) * 100),
        }
      }

      const data = { stats, bars, loading: false }
      this.setData(data)
      wx.setStorageSync(CACHE_KEY, { data, at: Date.now() })
    } catch (err) {
      this.setData({ loading: false })
      if (!silent) toastError(err)
    }
  },

  copyProfileUrl() {
    const url = this.data.stats && this.data.stats.profile && this.data.stats.profile.url
    if (!url) return
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '主页链接已复制', icon: 'none' }),
    })
  },

  goBind() {
    wx.navigateTo({ url: '/pages/bind/index' })
  },
})
