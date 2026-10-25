import { request, toastError, ensureLogin } from '../../utils/api'

Page({
  data: {
    stats: null as StatsResult | null,
    bars: { easy: 0, medium: 0, hard: 0 },
    loading: true,
  },

  onShow() {
    void this.load()
  },

  async load() {
    this.setData({ loading: true })
    try {
      await ensureLogin()
      const stats = await request<StatsResult>('/api/stats')

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

      this.setData({ stats, bars, loading: false })
    } catch (err) {
      this.setData({ loading: false })
      toastError(err)
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
