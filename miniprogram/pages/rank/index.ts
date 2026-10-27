import { callApi, toastError, ensureLogin } from '../../utils/api'
import { resolveAvatar } from '../../utils/avatar'

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
    void this.load()
  },

  async onPullDownRefresh() {
    await this.load()
    wx.stopPullDownRefresh()
  },

  switchPeriod(e: WechatMiniprogram.TouchEvent) {
    const period = String(e.currentTarget.dataset.period || 'week')
    if (period === this.data.period) return
    this.setData({ period })
    void this.load()
  },

  async load() {
    this.setData({ loading: true })
    try {
      await ensureLogin()
      const res = await callApi<RankResult>('rank', { period: this.data.period })
      this.setData({
        list: res.list.map((row) => ({ ...row, avatarUrl: resolveAvatar(row.avatarUrl, row.openid) })),
        myRank: res.myRank,
        memberCount: res.memberCount,
        updatedAt: res.updatedAt,
        statsSince: res.statsSince || '',
        loading: false,
      })
    } catch (err) {
      this.setData({ loading: false })
      toastError(err)
    }
  },

  goBind() {
    wx.navigateTo({ url: '/pages/bind/index' })
  },
})
