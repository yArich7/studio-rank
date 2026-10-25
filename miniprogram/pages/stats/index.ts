import { request, toastError, ensureLogin } from '../../utils/api'

Page({
  data: {
    stats: null as StatsResult | null,
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
      this.setData({ stats, loading: false })
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
