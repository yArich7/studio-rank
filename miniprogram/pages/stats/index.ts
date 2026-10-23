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

  goBind() {
    wx.navigateTo({ url: '/pages/bind/index' })
  },
})
