import { ensureLogin, refreshUser, toastError } from '../../utils/api'

Page({
  data: {
    user: null as IUser | null,
    loading: true,
  },

  onShow() {
    void this.load()
  },

  async load() {
    try {
      const user = await ensureLogin()
      getApp<IAppOption>().globalData.user = user
      this.setData({ user, loading: false })
    } catch (err) {
      this.setData({ loading: false })
      toastError(err)
    }
  },

  async reLogin() {
    try {
      const user = await refreshUser()
      this.setData({ user })
      wx.showToast({ title: '已刷新', icon: 'success' })
    } catch (err) {
      toastError(err)
    }
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/index' })
  },

  goBind() {
    wx.navigateTo({ url: '/pages/bind/index' })
  },
})
