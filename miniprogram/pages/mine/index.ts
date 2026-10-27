import { ensureLogin, login, toastError } from '../../utils/api'
import { resolveAvatar } from '../../utils/avatar'
import { BUILD } from '../../config'

Page({
  data: {
    user: null as IUser | null,
    loading: true,
    avatarError: false,
    build: BUILD,
  },

  onShow() {
    void this.load()
  },

  async load() {
    try {
      const user = await ensureLogin()
      getApp<IAppOption>().globalData.user = user
      this.setData({
        user: { ...user, avatarUrl: resolveAvatar(user.avatarUrl, 'me') },
        loading: false,
      })
    } catch (err) {
      this.setData({ loading: false })
      toastError(err)
    }
  },

  async reLogin() {
    try {
      const user = await login()
      this.setData({ user })
      wx.showToast({ title: '已刷新', icon: 'success' })
    } catch (err) {
      toastError(err)
    }
  },

  onAvatarError() {
    this.setData({ avatarError: true })
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/index' })
  },

  goBind() {
    wx.navigateTo({ url: '/pages/bind/index' })
  },
})
