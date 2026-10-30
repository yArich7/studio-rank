import { ensureLogin, login, logout, toastError } from '../../utils/api'
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

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '会清除本机缓存，并删除你的力扣绑定和刷题记录。下次绑定需要重新输入邀请码。',
      confirmText: '退出',
      confirmColor: '#E5484D',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '退出中', mask: true })
        try {
          await logout()
          wx.hideLoading()
          wx.showToast({ title: '已退出', icon: 'success' })
          setTimeout(() => wx.switchTab({ url: '/pages/rank/index' }), 600)
        } catch (err) {
          wx.hideLoading()
          toastError(err)
        }
      },
    })
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/index' })
  },

  goBind() {
    wx.navigateTo({ url: '/pages/bind/index' })
  },
})
