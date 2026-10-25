import { login, ApiError, getToken, goInvite } from '../../utils/api'
import { LAST_ERROR_KEY } from '../../config'

Page({
  data: {
    agreed: false,
    loading: false,
    error: '',
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed })
  },

  showAgreement() {
    wx.showModal({
      title: '用户协议与隐私政策',
      content: '本小程序仅读取你在力扣公开主页上的刷题数据，用于小范围内展示与排行。不会获取你的力扣密码，也不会保存除昵称、头像外的个人信息。',
      showCancel: false,
    })
  },

  async onWechatLogin() {
    if (!this.data.agreed) {
      this.setData({ error: '请先阅读并同意用户协议' })
      return
    }

    this.setData({ loading: true, error: '' })
    try {
      await login()
      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => wx.switchTab({ url: '/pages/rank/index' }), 500)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NEED_INVITE') {
        // 新用户：登录成功但需要邀请码才能进
        wx.redirectTo({ url: '/pages/invite/index' })
        return
      }
      this.setData({ error: err instanceof Error ? err.message : '登录失败' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onShow() {
    // 已登录则直接回榜单
    if (getToken()) {
      wx.switchTab({ url: '/pages/rank/index' })
      return
    }
    const reason = wx.getStorageSync(LAST_ERROR_KEY)
    if (reason) {
      this.setData({ error: `自动登录失败：${reason}` })
      wx.removeStorageSync(LAST_ERROR_KEY)
    }
  },
})
